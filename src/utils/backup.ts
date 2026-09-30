import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import {
  insertEmotionsAndTags,
  insertRestoredDream,
  listDreamIds,
  listDreams,
  listEmotions,
  listTags,
} from "../db/dreamRepository";
import { persist } from "../db/database";
import { AUDIO_DIRECTORY, AUDIO_SUBDIR, deleteAudioFile } from "../audio/audioRecorder";
import { CURRENT_VERSION } from "../changelog";
import type { AudioNote } from "../types";
import {
  BACKUP_FORMAT_VERSION,
  audioExtension,
  base64Chunks,
  buildBackupZip,
  bytesToBase64,
  planRestore,
  readBackupFile,
  type BackupAudioFile,
  type BackupBundle,
  type ExportedAudioNote,
  type RestoreReport,
} from "./backupFormat";

const BACKUP_ROOT = "Lucide_backups";

export interface BackupResult {
  /** Documents/Lucide_backups/… sur le téléphone, nom du fichier téléchargé sur le web. */
  location: string;
  /** Web : le fichier est proposé au téléchargement (le « Documents » du web n'est pas accessible). */
  downloaded: boolean;
  dreamCount: number;
  audioCount: number;
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: Directory.Documents });
    return true;
  } catch {
    return false;
  }
}

/** Nom à la seconde ; suffixe _2, _3… si le fichier existe quand même. */
async function uniqueBackupPath(): Promise<string> {
  const base = `${BACKUP_ROOT}/lucide_backup_${timestampSlug()}`;
  let path = `${base}.zip`;
  for (let n = 2; n < 100 && (await pathExists(path)); n++) {
    path = `${base}_${n}.zip`;
  }
  return path;
}

/** Écrit un fichier binaire par morceaux (voir base64Chunks), dossiers parents compris. */
async function writeBinaryFile(path: string, directory: Directory, bytes: Uint8Array): Promise<void> {
  const [first = "", ...rest] = base64Chunks(bytes);
  await Filesystem.writeFile({ path, directory, data: first, recursive: true });
  for (const chunk of rest) {
    await Filesystem.appendFile({ path, directory, data: chunk });
  }
}

/**
 * Écrire dans Documents exige la permission de stockage sur Android 10 et moins (déclarée avec
 * maxSdkVersion="29" dans le manifeste) ; le plugin la considère toujours accordée à partir
 * d'Android 11, où l'app crée ses propres fichiers dans Documents sans permission.
 */
async function ensureDocumentsPermission(): Promise<void> {
  if ((await Filesystem.checkPermissions()).publicStorage === "granted") return;
  if ((await Filesystem.requestPermissions()).publicStorage !== "granted") {
    throw new Error(
      "accès au stockage refusé. Autorise « Stockage » (ou « Fichiers et contenus multimédias ») pour Lucide dans les paramètres Android, puis réessaie.",
    );
  }
}

function downloadInBrowser(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Une seule archive .zip (data.json + mémos audio), dans Documents/Lucide_backups. */
export async function exportBackup(): Promise<BackupResult> {
  const web = Capacitor.getPlatform() === "web";
  if (!web) await ensureDocumentsPermission();
  const [dreams, emotions, tags] = await Promise.all([listDreams(), listEmotions(), listTags()]);

  const audioFiles: BackupAudioFile[] = [];
  const exportedDreams: BackupBundle["dreams"] = [];
  for (const dream of dreams) {
    const audioNotes: ExportedAudioNote[] = [];
    for (const note of dream.audioNotes) {
      let exportedFile: string | null = null;
      try {
        const { data } = await Filesystem.readFile({ path: note.filePath, directory: AUDIO_DIRECTORY });
        const base64 = typeof data === "string" ? data : bytesToBase64(new Uint8Array(await data.arrayBuffer()));
        exportedFile = `audio/${note.id}.${audioExtension(note.filePath)}`;
        audioFiles.push({ path: exportedFile, base64 });
      } catch {
        // Fichier introuvable : le mémo est exporté sans son audio.
      }
      audioNotes.push({ ...note, exportedFile });
    }
    exportedDreams.push({ ...dream, audioNotes });
  }

  const bundle: BackupBundle = {
    app: "Lucide",
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    emotions,
    tags,
    dreams: exportedDreams,
  };
  const zip = await buildBackupZip(bundle, audioFiles);
  const counts = { dreamCount: dreams.length, audioCount: audioFiles.length };

  if (web) {
    const fileName = `lucide_backup_${timestampSlug()}.zip`;
    downloadInBrowser(zip, fileName);
    return { location: fileName, downloaded: true, ...counts };
  }
  const path = await uniqueBackupPath();
  await writeBinaryFile(path, Directory.Documents, zip);
  return { location: `Documents/${path}`, downloaded: false, ...counts };
}

/**
 * Restaure une sauvegarde choisie par l'utilisateur (sélecteur de fichiers du système : sur un
 * nouveau téléphone, un fichier copié dans Documents n'appartient pas à l'app et n'est en général
 * pas lisible via Filesystem). Fusion sans rien écraser : un rêve déjà présent (même identifiant)
 * est laissé tel quel ; émotions et tags sont rapprochés par leur nom.
 */
export async function restoreBackup(file: Blob): Promise<RestoreReport> {
  const { backup, jsonOnly, readAudio } = await readBackupFile(new Uint8Array(await file.arrayBuffer()));
  const [dreamIds, emotions, tags] = await Promise.all([listDreamIds(), listEmotions(), listTags()]);
  const plan = planRestore(backup, { dreamIds, emotions, tags }, () => crypto.randomUUID());
  await insertEmotionsAndTags(plan.emotionsToCreate, plan.tagsToCreate);

  const report: RestoreReport = {
    added: 0,
    skipped: plan.skipped,
    errors: plan.invalid,
    audioRestored: 0,
    audioMissing: 0,
    jsonOnly,
  };
  for (const dream of plan.dreams) {
    const written: string[] = [];
    try {
      // Fichiers d'abord, lignes ensuite : un fichier écrit sans sa ligne (app tuée entre les deux)
      // est ramassé par purgeOrphanAudioFiles, l'inverse laisserait un mémo sans fichier.
      const notes: AudioNote[] = [];
      let missing = 0;
      for (const note of dream.audioNotes) {
        const bytes = note.exportedFile ? await readAudio(note.exportedFile) : null;
        if (!bytes || !note.exportedFile) {
          missing++;
          continue;
        }
        const filePath = `${AUDIO_SUBDIR}/${crypto.randomUUID()}.${audioExtension(note.exportedFile)}`;
        written.push(filePath);
        await writeBinaryFile(filePath, AUDIO_DIRECTORY, bytes);
        notes.push({ id: crypto.randomUUID(), dreamId: dream.id, filePath, durationMs: note.durationMs, createdAt: note.createdAt });
      }
      await insertRestoredDream(dream, notes);
      report.added++;
      report.audioRestored += notes.length;
      report.audioMissing += missing;
    } catch {
      report.errors++;
      for (const path of written) await deleteAudioFile(path);
    }
  }
  await persist();
  return report;
}
