import { Directory, Filesystem } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { RecordingStatus, VoiceRecorder } from "capacitor-voice-recorder";
import { listAudioFilePaths } from "../db/dreamRepository";

export const AUDIO_SUBDIR = "dream_audio";
const AUDIO_DIRECTORY = Directory.Data;
/** Un fichier audio non rattaché à un rêve n'est considéré comme abandonné qu'au-delà de cet âge. */
const ORPHAN_FILE_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export interface RecordingResult {
  /** Chemin relatif dans Directory.Data, à stocker en base pour retrouver le fichier plus tard. */
  filePath: string;
  durationMs: number;
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  return "audio";
}

export async function hasMicrophonePermission(): Promise<boolean> {
  const res = await VoiceRecorder.hasAudioRecordingPermission();
  return res.value;
}

export async function requestMicrophonePermission(): Promise<boolean> {
  const res = await VoiceRecorder.requestAudioRecordingPermission();
  return res.value;
}

export async function startRecording(): Promise<void> {
  const canRecord = await VoiceRecorder.canDeviceVoiceRecord();
  if (!canRecord.value) {
    throw new Error("Cet appareil ne peut pas enregistrer de son.");
  }
  let hasPerm = await hasMicrophonePermission();
  if (!hasPerm) {
    hasPerm = await requestMicrophonePermission();
  }
  if (!hasPerm) {
    throw new Error("Permission microphone refusée.");
  }
  await VoiceRecorder.startRecording({
    directory: AUDIO_DIRECTORY,
    subDirectory: AUDIO_SUBDIR,
  });
}

export async function stopRecording(): Promise<RecordingResult> {
  const result = await VoiceRecorder.stopRecording();
  const { path, recordDataBase64, mimeType, msDuration } = result.value;

  if (path) {
    // Natif : le fichier est déjà écrit sur le disque par le plugin.
    return { filePath: path, durationMs: msDuration };
  }

  if (recordDataBase64) {
    // Web (ou plateforme sans écriture directe) : on écrit nous-mêmes le fichier.
    await Filesystem.mkdir({ path: AUDIO_SUBDIR, directory: AUDIO_DIRECTORY, recursive: true }).catch(() => {});
    const fileName = `${AUDIO_SUBDIR}/${crypto.randomUUID()}.${extensionFromMime(mimeType)}`;
    await Filesystem.writeFile({
      path: fileName,
      directory: AUDIO_DIRECTORY,
      data: recordDataBase64,
    });
    return { filePath: fileName, durationMs: msDuration };
  }

  throw new Error("Aucune donnée audio reçue.");
}

/**
 * Arrête l'enregistrement en cours et supprime son fichier (enregistrement abandonné). Ne lève
 * jamais : sans enregistrement actif il n'y a rien à faire, et si l'arrêt échoue le plugin se
 * remet quand même à zéro (le fichier éventuel sera ramassé par purgeOrphanAudioFiles).
 */
export async function discardRecording(): Promise<void> {
  try {
    const { filePath } = await stopRecording();
    await deleteAudioFile(filePath);
  } catch {
    // rien en cours, ou enregistrement vide/illisible
  }
}

/**
 * L'enregistrement natif peut survivre à l'écran qui l'a lancé (WebView rechargée, nettoyage
 * interrompu…) : micro ouvert, fichier qui grossit, et le plugin refuse tout nouvel
 * enregistrement (ALREADY_RECORDING). Personne ne pouvant plus le terminer, on le jette.
 */
export async function discardOrphanRecording(): Promise<void> {
  try {
    const { status } = await VoiceRecorder.getCurrentStatus();
    if (status === RecordingStatus.NONE) return;
  } catch {
    return;
  }
  await discardRecording();
}

export async function getPlayableUrl(filePath: string): Promise<string> {
  if (Capacitor.getPlatform() === "web") {
    const { data } = await Filesystem.readFile({ path: filePath, directory: AUDIO_DIRECTORY });
    const base64 = typeof data === "string" ? data : await blobToBase64(data as Blob);
    return `data:audio/webm;base64,${base64}`;
  }
  const { uri } = await Filesystem.getUri({ path: filePath, directory: AUDIO_DIRECTORY });
  return Capacitor.convertFileSrc(uri);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function deleteAudioFile(filePath: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ path: filePath, directory: AUDIO_DIRECTORY });
  } catch {
    // fichier déjà absent : rien à faire
  }
}

/**
 * Supprime les fichiers du dossier audio qu'aucun mémo en base ne référence (enregistrements
 * abandonnés, y compris ceux laissés par les versions précédentes). Seulement au-delà de 24 h :
 * un fichier récent peut être un enregistrement en cours, pas encore rattaché à son rêve.
 * Ne lève jamais : c'est du ménage.
 */
export async function purgeOrphanAudioFiles(): Promise<void> {
  try {
    const { files } = await Filesystem.readdir({ path: AUDIO_SUBDIR, directory: AUDIO_DIRECTORY });
    const referenced = new Set((await listAudioFilePaths()).map((p) => p.split("/").pop()));
    const cutoff = Date.now() - ORPHAN_FILE_MIN_AGE_MS;
    for (const file of files) {
      // Date de modification inconnue (0) : dans le doute, on garde le fichier.
      const old = file.mtime > 0 && file.mtime < cutoff;
      if (file.type === "file" && old && !referenced.has(file.name)) {
        await deleteAudioFile(`${AUDIO_SUBDIR}/${file.name}`);
      }
    }
  } catch {
    // dossier pas encore créé (aucun enregistrement) ou illisible : rien à purger
  }
}
