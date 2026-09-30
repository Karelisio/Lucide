import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { CURRENT_VERSION } from "../changelog";
import { isVersionNewer } from "./version";
import ApkInstaller from "../native/apkInstaller";

/** Dépôt GitHub public contenant les releases (voir .github/workflows/android-release.yml). */
const REPO = "Karelisio/Lucide";

export interface AvailableUpdate {
  version: string;
  notes: string[];
  assetName: string;
  downloadUrl: string;
}

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  body: string;
  assets: GithubAsset[];
}

/**
 * Récupère la dernière release via le client HTTP natif Android plutôt que
 * `fetch` de la WebView : sur certains réseaux/téléphones, `fetch` vers un
 * domaine tiers échoue silencieusement ("Failed to fetch") alors que le
 * client réseau natif fonctionne normalement.
 */
async function fetchLatestRelease(): Promise<GithubRelease> {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`;
  const headers = { Accept: "application/vnd.github+json" };

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        res.status === 404
          ? "Aucune release trouvée (le dépôt est peut-être privé)."
          : `Impossible de vérifier les mises à jour (HTTP ${res.status}).`,
      );
    }
    return res.data as GithubRelease;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Aucune release trouvée (le dépôt est peut-être privé)."
        : `Impossible de vérifier les mises à jour (HTTP ${res.status}).`,
    );
  }
  return (await res.json()) as GithubRelease;
}

/**
 * Vérifie s'il existe une release GitHub plus récente que la version installée.
 * Seule requête réseau de l'app, déclenchée uniquement à la demande de l'utilisateur.
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const data = await fetchLatestRelease();
  const version = String(data.tag_name ?? "").replace(/^v/, "");
  if (!version || !isVersionNewer(version, CURRENT_VERSION)) {
    return null;
  }
  const asset = data.assets?.find((a) => a.name.endsWith(".apk"));
  if (!asset) {
    throw new Error("La dernière release ne contient pas d'APK téléchargeable.");
  }
  const notes = (data.body ?? "")
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
  return { version, notes, assetName: asset.name, downloadUrl: asset.browser_download_url };
}

/**
 * Télécharge l'APK d'une mise à jour disponible puis ouvre l'installateur système Android.
 *
 * Téléchargement natif (client HTTP d'Android, écriture directe sur le disque) et pas `fetch` :
 * le lien github.com/.../releases/download/... redirige (302) vers un hôte de stockage qui ne
 * renvoie aucun en-tête CORS, ce qui fait échouer `fetch` dans la WebView (« Failed to fetch »).
 */
export async function downloadAndInstall(update: AvailableUpdate, onProgress?: (pct: number) => void): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    throw new Error("L'installation automatique n'est disponible que depuis l'app Android installée.");
  }

  const dir = "update";
  // Le téléchargement natif ne crée pas lui-même le dossier de destination.
  await Filesystem.mkdir({ path: dir, directory: Directory.Cache, recursive: true }).catch(() => {});

  const progressListener = await Filesystem.addListener("progress", ({ bytes, contentLength }) => {
    if (onProgress && contentLength > 0) onProgress(Math.min(100, Math.round((bytes / contentLength) * 100)));
  });
  let apkPath: string | undefined;
  try {
    const result = await Filesystem.downloadFile({
      url: update.downloadUrl,
      path: `${dir}/${update.assetName}`,
      directory: Directory.Cache,
      progress: true,
    });
    apkPath = result.path;
  } catch (e) {
    throw new Error(`Échec du téléchargement de la mise à jour${e instanceof Error ? ` (${e.message})` : ""}.`);
  } finally {
    await progressListener.remove();
  }
  if (!apkPath) throw new Error("Échec du téléchargement de la mise à jour.");

  // Chemin disque absolu (…/cache/update/…apk) : ce qu'attend ApkInstallerPlugin (new File(path)),
  // couvert par le <cache-path> du FileProvider.
  await ApkInstaller.install({ path: apkPath });
}
