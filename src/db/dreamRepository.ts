import type { capSQLiteSet } from "@capacitor-community/sqlite";
import { getDatabase, persist } from "./database";
import { containsGlob } from "./search";
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

function rowToAudioNote(row: Record<string, unknown>): AudioNote {
  return {
    id: row.id as string,
    dreamId: row.dream_id as string,
    filePath: row.file_path as string,
    durationMs: Number(row.duration_ms ?? 0),
    createdAt: row.created_at as string,
  };
}

/** GROUP_CONCAT → liste (identifiants UUID, jamais de virgule). */
function splitIds(value: unknown): string[] {
  return typeof value === "string" && value !== "" ? value.split(",") : [];
}

function rowToDream(row: Record<string, unknown>, audioNotes: AudioNote[]): Dream {
  return {
    id: row.id as string,
    nightDate: row.night_date as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    text: (row.text as string) ?? "",
    locations: JSON.parse((row.locations as string) ?? "[]"),
    characters: JSON.parse((row.characters as string) ?? "[]"),
    emotionIds: splitIds(row.emotion_ids),
    tagIds: splitIds(row.tag_ids),
    moodRating: row.dream_mood === null || row.dream_mood === undefined ? null : Number(row.dream_mood),
    realismRating: row.dream_realism === null || row.dream_realism === undefined ? null : Number(row.dream_realism),
    sleepQuality: row.sleep_quality === null || row.sleep_quality === undefined ? null : Number(row.sleep_quality),
    audioNotes,
  };
}

/**
 * Rêves (non supprimés) qui vérifient `where` (alias d), avec émotions, tags et mémos audio : deux
 * requêtes quel que soit le nombre de rêves, au lieu de trois par rêve.
 */
async function queryDreams(where: string, params: unknown[]): Promise<Dream[]> {
  const db = await getDatabase();
  const filter = `d.deleted_at IS NULL AND ${where}`;
  const [dreamRows, audioRows] = await Promise.all([
    db.query(
      `SELECT d.*,
         (SELECT GROUP_CONCAT(emotion_id) FROM dream_emotions WHERE dream_id = d.id) AS emotion_ids,
         (SELECT GROUP_CONCAT(tag_id) FROM dream_tags WHERE dream_id = d.id) AS tag_ids
       FROM dreams d WHERE ${filter}
       ORDER BY d.night_date DESC, d.created_at DESC;`,
      params,
    ),
    db.query(
      `SELECT * FROM audio_notes WHERE dream_id IN (SELECT d.id FROM dreams d WHERE ${filter}) ORDER BY created_at ASC;`,
      params,
    ),
  ]);
  const audioByDream = new Map<string, AudioNote[]>();
  for (const note of (audioRows.values ?? []).map(rowToAudioNote)) {
    audioByDream.set(note.dreamId, [...(audioByDream.get(note.dreamId) ?? []), note]);
  }
  return (dreamRows.values ?? []).map((row) => rowToDream(row, audioByDream.get(row.id as string) ?? []));
}

/**
 * Recherche et filtres en SQL (appelé à chaque frappe dans la liste) : texte, lieux ou personnages
 * contenant la recherche (containsGlob), et tous les tags / toutes les émotions sélectionnés.
 */
export async function listDreams(filter: DreamFilter = {}): Promise<Dream[]> {
  const clauses = ["1"];
  const params: unknown[] = [];
  const query = filter.query?.trim();
  if (query) {
    const pattern = containsGlob(query);
    clauses.push("(d.text GLOB ? OR d.locations GLOB ? OR d.characters GLOB ?)");
    params.push(pattern, pattern, pattern);
  }
  const links = [
    { table: "dream_tags", column: "tag_id", ids: filter.tagIds },
    { table: "dream_emotions", column: "emotion_id", ids: filter.emotionIds },
  ];
  for (const { table, column, ids } of links) {
    const unique = [...new Set(ids ?? [])];
    if (unique.length === 0) continue;
    clauses.push(
      `d.id IN (SELECT dream_id FROM ${table} WHERE ${column} IN (${unique.map(() => "?").join(", ")}) GROUP BY dream_id HAVING COUNT(*) = ?)`,
    );
    params.push(...unique, unique.length);
  }
  return queryDreams(clauses.join(" AND "), params);
}

/**
 * Entrée d'une nuit utilisée par la saisie rapide de l'accueil : la plus ancienne qui porte déjà
 * une qualité de sommeil, sinon la plus ancienne tout court. Même règle pour l'affichage des
 * étoiles et pour l'écriture (getOrCreateNightPlaceholder) : sinon les étoiles affichées ne
 * sont pas celles qu'on modifie dès qu'une nuit a plusieurs entrées.
 */
export async function findNightEntry(nightDate: string): Promise<Dream | null> {
  const db = await getDatabase();
  const res = await db.query(
    "SELECT id FROM dreams WHERE night_date = ? AND deleted_at IS NULL ORDER BY sleep_quality IS NULL, created_at ASC LIMIT 1;",
    [nightDate],
  );
  const existingId = res.values?.[0]?.id as string | undefined;
  return existingId ? getDream(existingId) : null;
}

/**
 * Retourne l'entrée de la nuit (voir findNightEntry), ou en crée une vide.
 * Utilisé pour la saisie rapide (étoiles de sommeil / audio) depuis l'écran d'accueil,
 * sans forcer l'utilisateur à remplir le formulaire complet.
 */
export async function getOrCreateNightPlaceholder(nightDate: string): Promise<Dream> {
  const existing = await findNightEntry(nightDate);
  if (existing) return existing;
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
  return (await queryDreams("d.id = ?", [id]))[0] ?? null;
}

/**
 * Remplace les émotions et tags d'un rêve. Toujours exécuté dans le même executeSet que l'écriture
 * du rêve, c'est-à-dire une seule transaction (Android comme web) : une app tuée en plein
 * enregistrement ne laisse plus un rêve sans ses émotions ou avec des tags à moitié remplacés.
 */
function emotionAndTagLinks(dreamId: string, values: DreamFormValues): capSQLiteSet[] {
  return [
    { statement: "DELETE FROM dream_emotions WHERE dream_id = ?;", values: [dreamId] },
    ...values.emotionIds.map((emotionId) => ({
      statement: "INSERT OR IGNORE INTO dream_emotions (dream_id, emotion_id) VALUES (?, ?);",
      values: [dreamId, emotionId],
    })),
    { statement: "DELETE FROM dream_tags WHERE dream_id = ?;", values: [dreamId] },
    ...values.tagIds.map((tagId) => ({
      statement: "INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?, ?);",
      values: [dreamId, tagId],
    })),
  ];
}

function insertDreamStatement(id: string, values: DreamFormValues, createdAt: string, updatedAt: string): capSQLiteSet {
  return {
    statement: `INSERT INTO dreams (id, night_date, created_at, updated_at, text, locations, characters, dream_mood, dream_realism, sleep_quality)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    values: [
      id,
      values.nightDate,
      createdAt,
      updatedAt,
      values.text,
      JSON.stringify(values.locations),
      JSON.stringify(values.characters),
      values.moodRating,
      values.realismRating,
      values.sleepQuality,
    ],
  };
}

export async function createDream(values: DreamFormValues): Promise<Dream> {
  const db = await getDatabase();
  const id = newId();
  const now = nowIso();
  await db.executeSet([insertDreamStatement(id, values, now, now), ...emotionAndTagLinks(id, values)]);
  await persist();
  return (await getDream(id))!;
}

/** Identifiants de tous les rêves, pour ne jamais écraser un rêve existant à la restauration. */
export async function listDreamIds(): Promise<Set<string>> {
  const db = await getDatabase();
  const res = await db.query("SELECT id FROM dreams;");
  return new Set((res.values ?? []).map((r) => r.id as string));
}

/**
 * Rêve restauré depuis une sauvegarde, avec ses identifiants et dates d'origine, ses liens et ses
 * mémos audio (fichiers déjà écrits) : une seule transaction. persist() est à la charge de
 * l'appelant, une fois la restauration terminée.
 */
export async function insertRestoredDream(dream: Omit<Dream, "audioNotes">, audioNotes: AudioNote[]): Promise<void> {
  const db = await getDatabase();
  await db.executeSet([
    insertDreamStatement(dream.id, dream, dream.createdAt, dream.updatedAt),
    ...emotionAndTagLinks(dream.id, dream),
    ...audioNotes.map((n) => ({
      statement: "INSERT INTO audio_notes (id, dream_id, file_path, duration_ms, created_at) VALUES (?, ?, ?, ?, ?);",
      values: [n.id, n.dreamId, n.filePath, n.durationMs, n.createdAt],
    })),
  ]);
}

/** Émotions et tags créés par une restauration, avec leurs identifiants : une seule transaction. */
export async function insertEmotionsAndTags(
  emotions: Array<Pick<EmotionDef, "id" | "label" | "emoji">>,
  tags: TagDef[],
): Promise<void> {
  if (emotions.length === 0 && tags.length === 0) return;
  const db = await getDatabase();
  await db.executeSet([
    ...emotions.map((e) => ({
      statement: "INSERT INTO emotions (id, label, emoji, is_default) VALUES (?, ?, ?, 0);",
      values: [e.id, e.label, e.emoji],
    })),
    ...tags.map((t) => ({ statement: "INSERT INTO tags (id, label) VALUES (?, ?);", values: [t.id, t.label] })),
  ]);
  await persist();
}

export async function updateDream(id: string, values: DreamFormValues): Promise<Dream> {
  const db = await getDatabase();
  await db.executeSet([
    {
      statement: `UPDATE dreams SET night_date = ?, updated_at = ?, text = ?, locations = ?, characters = ?, dream_mood = ?, dream_realism = ?, sleep_quality = ?
     WHERE id = ?;`,
      values: [
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
    },
    ...emotionAndTagLinks(id, values),
  ]);
  await persist();
  return (await getDream(id))!;
}

export async function deleteDream(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run("DELETE FROM dreams WHERE id = ?;", [id]);
  await persist();
}

/**
 * Marque (ou démarque) des rêves comme supprimés : masqués partout (listes, fiche, accueil) en
 * attendant purgeDeletedDreams. Voir db/pendingDeletions.ts.
 */
export async function setDreamsDeleted(ids: string[], deleted: boolean): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const deletedAt = deleted ? nowIso() : null;
  await db.executeSet(
    ids.map((id) => ({ statement: "UPDATE dreams SET deleted_at = ? WHERE id = ?;", values: [deletedAt, id] })),
  );
  await persist();
}

function purgeStatements(where: string, values: string[]): capSQLiteSet[] {
  const doomed = `SELECT id FROM dreams WHERE ${where}`;
  return [
    { statement: `DELETE FROM audio_notes WHERE dream_id IN (${doomed});`, values },
    { statement: `DELETE FROM dream_emotions WHERE dream_id IN (${doomed});`, values },
    { statement: `DELETE FROM dream_tags WHERE dream_id IN (${doomed});`, values },
    { statement: `DELETE FROM dreams WHERE ${where};`, values },
  ];
}

/**
 * Supprime pour de bon les rêves marqués (tous, ou seulement ceux de `ids`), en une transaction.
 * Les lignes liées sont supprimées explicitement plutôt que par ON DELETE CASCADE : sur le web,
 * jeep-sqlite n'active les clés étrangères qu'après la première sauvegarde, donc pas encore au
 * démarrage. Renvoie les fichiers audio devenus inutiles, à supprimer par l'appelant.
 */
export async function purgeDeletedDreams(ids?: string[]): Promise<string[]> {
  const db = await getDatabase();
  const res = await db.query(
    "SELECT a.dream_id, a.file_path FROM audio_notes a JOIN dreams d ON d.id = a.dream_id WHERE d.deleted_at IS NOT NULL;",
  );
  const only = ids ? new Set(ids) : null;
  const filePaths = (res.values ?? [])
    .filter((r) => !only || only.has(r.dream_id as string))
    .map((r) => r.file_path as string);
  const set = ids
    ? ids.flatMap((id) => purgeStatements("id = ? AND deleted_at IS NOT NULL", [id]))
    : purgeStatements("deleted_at IS NOT NULL", []);
  if (set.length === 0) return [];
  await db.executeSet(set);
  await persist();
  return filePaths;
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
  if (dreamIds.length === 0) return;
  const db = await getDatabase();
  await db.executeSet(
    dreamIds.map((dreamId) => ({
      statement: "INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?, ?);",
      values: [dreamId, tagId],
    })),
  );
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

/** Chemins de tous les fichiers audio rattachés à un rêve (ménage des fichiers orphelins). */
export async function listAudioFilePaths(): Promise<string[]> {
  const db = await getDatabase();
  const res = await db.query("SELECT file_path FROM audio_notes;");
  return (res.values ?? []).map((r) => r.file_path as string);
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
