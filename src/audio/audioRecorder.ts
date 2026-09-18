import { Directory, Filesystem } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { VoiceRecorder } from "capacitor-voice-recorder";

export const AUDIO_SUBDIR = "dream_audio";
const AUDIO_DIRECTORY = Directory.Data;

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
