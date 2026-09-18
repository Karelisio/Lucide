import { Capacitor } from "@capacitor/core";
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
 * Vérifie s'il existe une release GitHub plus récente que la version installée.
 * Seule requête réseau de l'app, déclenchée uniquement à la demande de l'utilisateur.
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Aucune release trouvée (le dépôt est peut-être privé)."
        : `Impossible de vérifier les mises à jour (HTTP ${res.status}).`,
    );
  }
  const data = (await res.json()) as GithubRelease;
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

async function fetchWithProgress(url: string, onProgress?: (pct: number) => void): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Échec du téléchargement (HTTP ${res.status}).`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !total || !onProgress) return res.blob();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(100, Math.round((received / total) * 100)));
  }
  return new Blob(chunks as BlobPart[]);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(((reader.result as string) ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier échouée."));
    reader.readAsDataURL(blob);
  });
}

/** Télécharge l'APK d'une mise à jour disponible puis ouvre l'installateur système Android. */
export async function downloadAndInstall(update: AvailableUpdate, onProgress?: (pct: number) => void): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    throw new Error("L'installation automatique n'est disponible que depuis l'app Android installée.");
  }

  const blob = await fetchWithProgress(update.downloadUrl, onProgress);
  const base64 = await blobToBase64(blob);

  const dir = "update";
  const path = `${dir}/${update.assetName}`;
  await Filesystem.mkdir({ path: dir, directory: Directory.Cache, recursive: true }).catch(() => {});
  await Filesystem.writeFile({ path, directory: Directory.Cache, data: base64 });

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  await ApkInstaller.install({ path: uri.replace(/^file:\/\//, "") });
}
