import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { listDreams, listEmotions, listTags } from "../db/dreamRepository";

const BACKUP_ROOT = "Lucide_backups";

export interface BackupResult {
  folder: string;
  dreamCount: number;
  audioCount: number;
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function exportBackup(): Promise<BackupResult> {
  const [dreams, emotions, tags] = await Promise.all([listDreams(), listEmotions(), listTags()]);

  const folder = `${BACKUP_ROOT}/backup_${timestampSlug()}`;
  const audioFolder = `${folder}/audio`;
  await Filesystem.mkdir({ path: audioFolder, directory: Directory.Documents, recursive: true });

  let audioCount = 0;
  const exportedDreams = [];
  for (const dream of dreams) {
    const exportedNotes = [];
    for (const note of dream.audioNotes) {
      try {
        const { data } = await Filesystem.readFile({ path: note.filePath, directory: Directory.Data });
        const base64 = typeof data === "string" ? data : await (data as Blob).arrayBuffer().then(bufferToBase64);
        const fileName = note.filePath.split("/").pop() ?? `${note.id}.audio`;
        await Filesystem.writeFile({
          path: `${audioFolder}/${fileName}`,
          directory: Directory.Documents,
          data: base64,
        });
        exportedNotes.push({ ...note, exportedFile: `audio/${fileName}` });
        audioCount++;
      } catch {
        exportedNotes.push({ ...note, exportedFile: null });
      }
    }
    exportedDreams.push({ ...dream, audioNotes: exportedNotes });
  }

  const bundle = {
    app: "Lucide",
    exportedAt: new Date().toISOString(),
    emotions,
    tags,
    dreams: exportedDreams,
  };

  await Filesystem.writeFile({
    path: `${folder}/data.json`,
    directory: Directory.Documents,
    data: JSON.stringify(bundle, null, 2),
    encoding: Encoding.UTF8,
  });

  return { folder, dreamCount: dreams.length, audioCount };
}

function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
