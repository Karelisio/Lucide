import { getDatabase, persist } from "./database";
import type { AudioNote, Dream, DreamFormValues, EmotionDef, TagDef } from "../types";

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface DreamFilter {
  query?: string;
  tagIds?: string[];
  emotionIds?: string[];
}

async function loadEmotionIds(dreamId: string): Promise<string[]> {
  const db = await getDatabase();
  const res = await db.query("SELECT emotion_id FROM dream_emotions WHERE dream_id = ?;", [dreamId]);
  return (res.values ?? []).map((r) => r.emotion_id as string);
}

async function loadTagIds(dreamId: string): Promise<string[]> {
  const db = await getDatabase();
  const res = await db.query("SELECT tag_id FROM dream_tags WHERE dream_id = ?;", [dreamId]);
  return (res.values ?? []).map((r) => r.tag_id as string);
}

async function loadAudioNotes(dreamId: string): Promise<AudioNote[]> {
  const db = await getDatabase();
  const res = await db.query(
    "SELECT * FROM audio_notes WHERE dream_id = ? ORDER BY created_at ASC;",
    [dreamId],
  );
  return (res.values ?? []).map(rowToAudioNote);
}

function rowToAudioNote(row: Record<string, unknown>): AudioNote {
  return {
    id: row.id as string,
    dreamId: row.dream_id as string,
    filePath: row.file_path as string,
    durationMs: Number(row.duration_ms ?? 0),
    createdAt: row.created_at as string,
  };
}

async function rowToDream(row: Record<string, unknown>): Promise<Dream> {
  const id = row.id as string;
  const [emotionIds, tagIds, audioNotes] = await Promise.all([
    loadEmotionIds(id),
    loadTagIds(id),
    loadAudioNotes(id),
  ]);
  return {
    id,
    nightDate: row.night_date as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    text: (row.text as string) ?? "",
    locations: JSON.parse((row.locations as string) ?? "[]"),
    characters: JSON.parse((row.characters as string) ?? "[]"),
    emotionIds,
    tagIds,
    moodRating: row.dream_mood === null || row.dream_mood === undefined ? null : Number(row.dream_mood),
    realismRating: row.dream_realism === null || row.dream_realism === undefined ? null : Number(row.dream_realism),
    sleepQuality: row.sleep_quality === null || row.sleep_quality === undefined ? null : Number(row.sleep_quality),
    audioNotes,
  };
}

export async function listDreams(filter: DreamFilter = {}): Promise<Dream[]> {
  const db = await getDatabase();
  const res = await db.query("SELECT * FROM dreams ORDER BY night_date DESC, created_at DESC;");
  let dreams = await Promise.all((res.values ?? []).map(rowToDream));

  if (filter.query && filter.query.trim()) {
    const q = filter.query.trim().toLowerCase();
    dreams = dreams.filter(
      (d) =>
        d.text.toLowerCase().includes(q) ||
        d.locations.some((l) => l.toLowerCase().includes(q)) ||
        d.characters.some((c) => c.toLowerCase().includes(q)),
    );
  }
  if (filter.tagIds && filter.tagIds.length > 0) {
    dreams = dreams.filter((d) => filter.tagIds!.every((t) => d.tagIds.includes(t)));
  }
  if (filter.emotionIds && filter.emotionIds.length > 0) {
    dreams = dreams.filter((d) => filter.emotionIds!.every((e) => d.emotionIds.includes(e)));
  }
  return dreams;
}

/**
 * Retourne la première entrée existante pour une nuit donnée, ou en crée une vide.
 * Utilisé pour la saisie rapide (étoiles de sommeil / audio) depuis l'écran d'accueil,
 * sans forcer l'utilisateur à remplir le formulaire complet.
 */
export async function getOrCreateNightPlaceholder(nightDate: string): Promise<Dream> {
  const db = await getDatabase();
  const res = await db.query(
    "SELECT id FROM dreams WHERE night_date = ? ORDER BY created_at ASC LIMIT 1;",
    [nightDate],
  );
  const existingId = res.values?.[0]?.id as string | undefined;
  if (existingId) {
    return (await getDream(existingId))!;
  }
  return createDream({
    nightDate,
    text: "",
    locations: [],
    characters: [],
    emotionIds: [],
    tagIds: [],
    moodRating: null,
    realismRating: null,
    sleepQuality: null,
  });
}

export async function getDream(id: string): Promise<Dream | null> {
  const db = await getDatabase();
  const res = await db.query("SELECT * FROM dreams WHERE id = ?;", [id]);
  const row = res.values?.[0];
  if (!row) return null;
  return rowToDream(row);
}

async function linkEmotionsAndTags(db: Awaited<ReturnType<typeof getDatabase>>, dreamId: string, values: DreamFormValues) {
  await db.run("DELETE FROM dream_emotions WHERE dream_id = ?;", [dreamId]);
  for (const emotionId of values.emotionIds) {
    await db.run("INSERT OR IGNORE INTO dream_emotions (dream_id, emotion_id) VALUES (?, ?);", [dreamId, emotionId]);
  }
  await db.run("DELETE FROM dream_tags WHERE dream_id = ?;", [dreamId]);
  for (const tagId of values.tagIds) {
    await db.run("INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?, ?);", [dreamId, tagId]);
  }
}

export async function createDream(values: DreamFormValues): Promise<Dream> {
  const db = await getDatabase();
  const id = newId();
  const now = nowIso();
  await db.run(
    `INSERT INTO dreams (id, night_date, created_at, updated_at, text, locations, characters, dream_mood, dream_realism, sleep_quality)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      values.nightDate,
      now,
      now,
      values.text,
      JSON.stringify(values.locations),
      JSON.stringify(values.characters),
      values.moodRating,
      values.realismRating,
      values.sleepQuality,
    ],
  );
  await linkEmotionsAndTags(db, id, values);
  await persist();
  return (await getDream(id))!;
}

export async function updateDream(id: string, values: DreamFormValues): Promise<Dream> {
  const db = await getDatabase();
  await db.run(
    `UPDATE dreams SET night_date = ?, updated_at = ?, text = ?, locations = ?, characters = ?, dream_mood = ?, dream_realism = ?, sleep_quality = ?
     WHERE id = ?;`,
    [
      values.nightDate,
      nowIso(),
      values.text,
      JSON.stringify(values.locations),
      JSON.stringify(values.characters),
      values.moodRating,
      values.realismRating,
      values.sleepQuality,
      id,
    ],
  );
  await linkEmotionsAndTags(db, id, values);
  await persist();
  return (await getDream(id))!;
}

export async function deleteDream(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run("DELETE FROM dreams WHERE id = ?;", [id]);
  await persist();
}

export async function updateSleepQualityOnly(dreamId: string, sleepQuality: number | null): Promise<void> {
  const db = await getDatabase();
  await db.run("UPDATE dreams SET sleep_quality = ?, updated_at = ? WHERE id = ?;", [sleepQuality, nowIso(), dreamId]);
  await persist();
}

// ---------------------------------------------------------------------------
// Émotions
// ---------------------------------------------------------------------------

export async function listEmotions(): Promise<EmotionDef[]> {
  const db = await getDatabase();
  const res = await db.query("SELECT * FROM emotions ORDER BY is_default DESC, label ASC;");
  return (res.values ?? []).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    emoji: (r.emoji as string) ?? "",
    isDefault: Number(r.is_default) === 1,
  }));
}

export async function createEmotion(label: string, emoji = ""): Promise<EmotionDef> {
  const db = await getDatabase();
  const id = newId();
  await db.run("INSERT INTO emotions (id, label, emoji, is_default) VALUES (?, ?, ?, 0);", [id, label, emoji]);
  await persist();
  return { id, label, emoji, isDefault: false };
}

export async function deleteEmotion(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run("DELETE FROM emotions WHERE id = ?;", [id]);
  await persist();
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function listTags(): Promise<TagDef[]> {
  const db = await getDatabase();
  const res = await db.query("SELECT * FROM tags ORDER BY label ASC;");
  return (res.values ?? []).map((r) => ({ id: r.id as string, label: r.label as string }));
}

export async function findOrCreateTag(label: string): Promise<TagDef> {
  const clean = label.trim();
  const db = await getDatabase();
  const existing = await db.query("SELECT * FROM tags WHERE label = ? COLLATE NOCASE;", [clean]);
  if (existing.values && existing.values.length > 0) {
    const r = existing.values[0];
    return { id: r.id as string, label: r.label as string };
  }
  const id = newId();
  await db.run("INSERT INTO tags (id, label) VALUES (?, ?);", [id, clean]);
  await persist();
  return { id, label: clean };
}

export async function addTagToDreams(dreamIds: string[], tagId: string): Promise<void> {
  const db = await getDatabase();
  for (const dreamId of dreamIds) {
    await db.run("INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?, ?);", [dreamId, tagId]);
  }
  await persist();
}

export async function deleteTag(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run("DELETE FROM tags WHERE id = ?;", [id]);
  await persist();
}

// ---------------------------------------------------------------------------
// Notes audio
// ---------------------------------------------------------------------------

export async function addAudioNote(dreamId: string, filePath: string, durationMs: number): Promise<AudioNote> {
  const db = await getDatabase();
  const id = newId();
  const createdAt = nowIso();
  await db.run(
    "INSERT INTO audio_notes (id, dream_id, file_path, duration_ms, created_at) VALUES (?, ?, ?, ?, ?);",
    [id, dreamId, filePath, durationMs, createdAt],
  );
  await persist();
  return { id, dreamId, filePath, durationMs, createdAt };
}

export async function deleteAudioNoteRow(id: string): Promise<AudioNote | null> {
  const db = await getDatabase();
  const res = await db.query("SELECT * FROM audio_notes WHERE id = ?;", [id]);
  const row = res.values?.[0];
  if (!row) return null;
  await db.run("DELETE FROM audio_notes WHERE id = ?;", [id]);
  await persist();
  return rowToAudioNote(row);
}

// ---------------------------------------------------------------------------
// Réglages simples clé/valeur
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const res = await db.query("SELECT value FROM settings WHERE key = ?;", [key]);
  return (res.values?.[0]?.value as string) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
    [key, value],
  );
  await persist();
}
