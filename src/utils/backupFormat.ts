import JSZip from "jszip";
import type { AudioNote, Dream, EmotionDef, TagDef } from "../types";

/*
 * Format des sauvegardes, sans dépendance à Capacitor (testable sous Node).
 * - Version 1 (Lucide ≤ 1.2, pas de champ formatVersion) : dossier data.json + audio/. Seul
 *   data.json se restaure, sans les mémos audio (ou le dossier entier compressé en .zip).
 * - Version 2 : une seule archive .zip, data.json à la racine + audio/<id du mémo>.<ext>.
 */
export const BACKUP_FORMAT_VERSION = 2;
const DATA_FILE = "data.json";

export interface ExportedAudioNote extends AudioNote {
  /** Chemin du fichier dans la sauvegarde, relatif à data.json ; null s'il n'a pas pu être lu. */
  exportedFile: string | null;
}

export interface BackupBundle {
  app: "Lucide";
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  emotions: EmotionDef[];
  tags: TagDef[];
  dreams: Array<Omit<Dream, "audioNotes"> & { audioNotes: ExportedAudioNote[] }>;
}

export interface BackupAudioFile {
  /** Chemin dans l'archive (ex. audio/<id>.aac), celui indiqué par exportedFile. */
  path: string;
  base64: string;
}

export async function buildBackupZip(bundle: BackupBundle, audioFiles: BackupAudioFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(DATA_FILE, JSON.stringify(bundle, null, 2));
  for (const file of audioFiles) {
    // Audio déjà compressé : stocké tel quel.
    zip.file(file.path, file.base64, { base64: true, compression: "STORE" });
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Extension d'un fichier audio, réduite à des caractères sûrs pour un nom de fichier. */
export function audioExtension(path: string): string {
  return /\.([a-z0-9]{1,5})$/i.exec(path)?.[1]?.toLowerCase() ?? "audio";
}

// ---------------------------------------------------------------------------
// Lecture et validation
// ---------------------------------------------------------------------------

/** Fichier impossible à restaurer ; le message s'affiche tel quel dans Réglages. */
export class BackupFormatError extends Error {}

export interface RestoredAudioNote {
  exportedFile: string | null;
  durationMs: number;
  createdAt: string;
}

export type RestoredDream = Omit<Dream, "audioNotes"> & { audioNotes: RestoredAudioNote[] };

export interface ParsedBackup {
  formatVersion: number;
  emotions: Array<Pick<EmotionDef, "id" | "label" | "emoji">>;
  tags: TagDef[];
  dreams: RestoredDream[];
  /** Entrées illisibles (identifiant ou date de nuit invalide), ignorées. */
  invalidDreams: number;
}

export interface BackupFile {
  backup: ParsedBackup;
  /** Sauvegarde .json seule : aucun fichier audio disponible. */
  jsonOnly: boolean;
  /** Contenu d'un fichier audio de la sauvegarde, null s'il est absent. */
  readAudio: (exportedFile: string) => Promise<Uint8Array | null>;
}

type RawObject = Record<string, unknown>;

function isObject(value: unknown): value is RawObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new BackupFormatError("Fichier illisible : ni une archive .zip de Lucide, ni un fichier data.json.");
  }
}

/** Accepte une archive .zip (export 1.3+) ou un data.json seul (ancien format, sans audio). */
export async function readBackupFile(bytes: Uint8Array): Promise<BackupFile> {
  if (!isZip(bytes)) {
    return { backup: parseBackup(parseJson(new TextDecoder().decode(bytes))), jsonOnly: true, readAudio: async () => null };
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new BackupFormatError("Archive .zip illisible ou incomplète.");
  }
  // data.json à la racine ; dans un sous-dossier pour un ancien dossier de sauvegarde compressé.
  const dataEntry = zip.file(/(^|\/)data\.json$/).sort((a, b) => a.name.length - b.name.length)[0];
  if (!dataEntry) {
    throw new BackupFormatError("Cette archive ne contient pas de data.json : ce n'est pas une sauvegarde Lucide.");
  }
  const baseDir = dataEntry.name.slice(0, dataEntry.name.length - DATA_FILE.length);
  return {
    backup: parseBackup(parseJson(await dataEntry.async("string"))),
    jsonOnly: false,
    readAudio: async (exportedFile) => {
      const entry = zip.file(baseDir + exportedFile);
      return entry ? entry.async("uint8array") : null;
    },
  };
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function rating(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function isoTimestamp(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function isNightDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function parseDream(raw: unknown, now: string): RestoredDream | null {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id || id.length > 100 || !isNightDate(raw.nightDate)) return null;
  const createdAt = isoTimestamp(raw.createdAt, now);
  return {
    id,
    nightDate: raw.nightDate,
    createdAt,
    updatedAt: isoTimestamp(raw.updatedAt, createdAt),
    text: text(raw.text),
    locations: strings(raw.locations),
    characters: strings(raw.characters),
    emotionIds: strings(raw.emotionIds),
    tagIds: strings(raw.tagIds),
    // Exports ≤ 1.1 : note unique dreamRating, devenue le ressenti (comme la migration de la base).
    moodRating: rating(raw.moodRating, 0, 10) ?? rating(raw.dreamRating, 0, 10),
    realismRating: rating(raw.realismRating, 0, 10),
    sleepQuality: rating(raw.sleepQuality, 1, 5),
    audioNotes: (Array.isArray(raw.audioNotes) ? raw.audioNotes : []).filter(isObject).map((note) => ({
      exportedFile: typeof note.exportedFile === "string" ? note.exportedFile : null,
      durationMs:
        typeof note.durationMs === "number" && Number.isFinite(note.durationMs) && note.durationMs > 0
          ? Math.round(note.durationMs)
          : 0,
      createdAt: isoTimestamp(note.createdAt, createdAt),
    })),
  };
}

export function parseBackup(raw: unknown, now = new Date().toISOString()): ParsedBackup {
  if (!isObject(raw) || raw.app !== "Lucide" || !Array.isArray(raw.dreams)) {
    throw new BackupFormatError("Ce fichier n'est pas une sauvegarde Lucide.");
  }
  const formatVersion = raw.formatVersion ?? 1;
  if (typeof formatVersion !== "number" || !Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new BackupFormatError("Version de sauvegarde inconnue.");
  }
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError("Sauvegarde créée par une version plus récente de Lucide : mets l'app à jour avant de la restaurer.");
  }
  const emotions = (Array.isArray(raw.emotions) ? raw.emotions : [])
    .filter(isObject)
    .filter((e) => typeof e.id === "string" && typeof e.label === "string" && e.label.trim() !== "")
    .map((e) => ({ id: e.id as string, label: (e.label as string).trim(), emoji: text(e.emoji) }));
  const tags = (Array.isArray(raw.tags) ? raw.tags : [])
    .filter(isObject)
    .filter((t) => typeof t.id === "string" && typeof t.label === "string" && t.label.trim() !== "")
    .map((t) => ({ id: t.id as string, label: (t.label as string).trim() }));
  const dreams: RestoredDream[] = [];
  let invalidDreams = 0;
  for (const entry of raw.dreams) {
    const dream = parseDream(entry, now);
    if (dream) dreams.push(dream);
    else invalidDreams++;
  }
  return { formatVersion, emotions, tags, dreams, invalidDreams };
}

// ---------------------------------------------------------------------------
// Fusion avec les données existantes
// ---------------------------------------------------------------------------

export interface LocalData {
  dreamIds: Set<string>;
  emotions: Array<Pick<EmotionDef, "id" | "label">>;
  tags: TagDef[];
}

export interface RestorePlan {
  emotionsToCreate: Array<Pick<EmotionDef, "id" | "label" | "emoji">>;
  tagsToCreate: TagDef[];
  /** Rêves à ajouter, émotions et tags traduits vers les identifiants de ce téléphone. */
  dreams: RestoredDream[];
  /** Rêves déjà présents (même identifiant) : jamais écrasés. */
  skipped: number;
  invalid: number;
}

const labelKey = (label: string) => label.trim().toLowerCase();

/**
 * Émotions et tags de la sauvegarde rapprochés des existants par leur nom (casse ignorée), créés
 * sinon. Renvoie la correspondance identifiant de la sauvegarde → identifiant local.
 */
function matchByLabel<T extends { id: string; label: string }>(
  incoming: T[],
  existing: Array<{ id: string; label: string }>,
  newId: () => string,
): { idMap: Map<string, string>; toCreate: T[] } {
  const byLabel = new Map<string, string>();
  for (const item of existing) {
    if (!byLabel.has(labelKey(item.label))) byLabel.set(labelKey(item.label), item.id);
  }
  const idMap = new Map<string, string>();
  const toCreate: T[] = [];
  for (const item of incoming) {
    let id = byLabel.get(labelKey(item.label));
    if (!id) {
      id = newId();
      byLabel.set(labelKey(item.label), id);
      toCreate.push({ ...item, id });
    }
    idMap.set(item.id, id);
  }
  return { idMap, toCreate };
}

function translateIds(ids: string[], idMap: Map<string, string>): string[] {
  return [...new Set(ids.map((id) => idMap.get(id)).filter((id): id is string => id !== undefined))];
}

/** Fusion sans rien écraser : un rêve dont l'identifiant existe déjà est laissé tel quel. */
export function planRestore(backup: ParsedBackup, local: LocalData, newId: () => string): RestorePlan {
  const emotions = matchByLabel(backup.emotions, local.emotions, newId);
  const tags = matchByLabel(backup.tags, local.tags, newId);
  const known = new Set(local.dreamIds);
  const dreams: RestoredDream[] = [];
  let skipped = 0;
  for (const dream of backup.dreams) {
    if (known.has(dream.id)) {
      skipped++;
      continue;
    }
    known.add(dream.id);
    dreams.push({
      ...dream,
      emotionIds: translateIds(dream.emotionIds, emotions.idMap),
      tagIds: translateIds(dream.tagIds, tags.idMap),
    });
  }
  return {
    emotionsToCreate: emotions.toCreate,
    tagsToCreate: tags.toCreate,
    dreams,
    skipped,
    invalid: backup.invalidDreams,
  };
}

export interface RestoreReport {
  added: number;
  skipped: number;
  errors: number;
  audioRestored: number;
  audioMissing: number;
  jsonOnly: boolean;
}

export function describeRestoreReport(report: RestoreReport): string {
  const counts = [`${report.added} rêve(s) ajouté(s)`, `${report.skipped} déjà présent(s), laissé(s) tel(s) quel(s)`];
  if (report.errors > 0) counts.push(`${report.errors} illisible(s) ou en erreur`);
  let message = `Restauration terminée : ${counts.join(", ")}. ${report.audioRestored} mémo(s) audio restauré(s).`;
  if (report.audioMissing > 0) {
    message += report.jsonOnly
      ? ` Fichier .json seul : ${report.audioMissing} mémo(s) audio non inclus (seule l'archive .zip contient l'audio).`
      : ` ${report.audioMissing} mémo(s) audio absent(s) de la sauvegarde.`;
  }
  return message;
}

// ---------------------------------------------------------------------------
// Écriture de gros fichiers
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Découpe en morceaux base64 indépendants (taille multiple de 3 : pas de « = » au milieu), pour
 * écrire un gros fichier en plusieurs appels au pont natif plutôt qu'en une chaîne géante.
 */
export function base64Chunks(bytes: Uint8Array, chunkSize = 3 * 1024 * 1024): string[] {
  const size = Math.max(3, chunkSize - (chunkSize % 3));
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytesToBase64(bytes.subarray(offset, offset + size)));
  }
  return chunks;
}
