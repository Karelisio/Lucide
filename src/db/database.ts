import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";

const DB_NAME = "lucide";
const DB_VERSION = 1;

export const isWebPlatform = Capacitor.getPlatform() === "web";

const sqlite = new SQLiteConnection(CapacitorSQLite);

let dbPromise: Promise<SQLiteDBConnection> | null = null;

const SCHEMA_STATEMENTS = `
CREATE TABLE IF NOT EXISTS dreams (
  id TEXT PRIMARY KEY NOT NULL,
  night_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  locations TEXT NOT NULL DEFAULT '[]',
  characters TEXT NOT NULL DEFAULT '[]',
  dream_rating INTEGER,
  dream_mood INTEGER,
  dream_realism INTEGER,
  sleep_quality INTEGER,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dreams_night_date ON dreams(night_date);

CREATE TABLE IF NOT EXISTS emotions (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dream_emotions (
  dream_id TEXT NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  emotion_id TEXT NOT NULL REFERENCES emotions(id) ON DELETE CASCADE,
  PRIMARY KEY (dream_id, emotion_id)
);

CREATE TABLE IF NOT EXISTS dream_tags (
  dream_id TEXT NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (dream_id, tag_id)
);

CREATE TABLE IF NOT EXISTS audio_notes (
  id TEXT PRIMARY KEY NOT NULL,
  dream_id TEXT NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

const DEFAULT_EMOTIONS: Array<{ label: string; emoji: string }> = [
  { label: "Peur", emoji: "😨" },
  { label: "Joie", emoji: "😄" },
  { label: "Confusion", emoji: "😵" },
  { label: "Tristesse", emoji: "😢" },
  { label: "Colère", emoji: "😠" },
  { label: "Sérénité", emoji: "😌" },
  { label: "Surprise", emoji: "😲" },
  { label: "Dégoût", emoji: "🤢" },
  { label: "Anxiété", emoji: "😰" },
  { label: "Émerveillement", emoji: "🤩" },
];

const DEFAULT_EMOTIONS_SEEDED_KEY = "default_emotions_seeded_v1";

/**
 * Émotions par défaut insérées une seule fois (drapeau dans `settings`) : avant, elles revenaient
 * à chaque lancement dès que l'utilisateur les avait toutes supprimées. Installation existante
 * (émotions déjà là) : seul le drapeau est posé.
 */
async function seedDefaults(db: SQLiteDBConnection) {
  const flag = await db.query("SELECT value FROM settings WHERE key = ?;", [DEFAULT_EMOTIONS_SEEDED_KEY]);
  if (flag.values?.[0]?.value) return;
  const countRes = await db.query("SELECT COUNT(*) as n FROM emotions;");
  const n = countRes.values?.[0]?.n ?? 0;
  const inserts =
    n === 0
      ? DEFAULT_EMOTIONS.map((e) => ({
          statement: "INSERT INTO emotions (id, label, emoji, is_default) VALUES (?, ?, ?, 1);",
          values: [cryptoId(), e.label, e.emoji],
        }))
      : [];
  // Émotions et drapeau dans une même transaction : jamais l'un sans l'autre.
  await db.executeSet([
    ...inserts,
    { statement: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, '1');", values: [DEFAULT_EMOTIONS_SEEDED_KEY] },
  ]);
}

function cryptoId(): string {
  return crypto.randomUUID();
}

/**
 * `CREATE TABLE IF NOT EXISTS` n'ajoute aucune colonne à une table déjà créée par une
 * version antérieure de l'app : on complète ici le schéma des installations existantes.
 */
async function ensureColumn(db: SQLiteDBConnection, table: string, column: string, ddl: string) {
  const res = await db.query(`PRAGMA table_info(${table});`);
  const exists = (res.values ?? []).some((r) => r.name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  }
}

const RATING_TO_MOOD_MIGRATION_KEY = "migration_rating_to_mood_v1";

/**
 * Jusqu'à la 1.1.x, la note du rêve (/10) était stockée dans `dream_rating`. La 1.2.0 l'a
 * remplacée par « Ressenti » (`dream_mood`) + « Réalisme » (`dream_realism`) sans recopier les
 * données : les anciennes notes n'étaient plus affichées nulle part, ni exportées.
 * L'ancienne note devient le ressenti, qui a pris sa place partout en 1.2.0 (badge de la liste,
 * corrélation avec le sommeil) : même curseur entier 0–10, même sens (plus haut = meilleur
 * rêve), donc aucune conversion. Exécutée une seule fois (drapeau dans `settings`) pour ne
 * jamais réécrire un ressenti que l'utilisateur aurait effacé depuis.
 */
async function migrateRatingToMood(db: SQLiteDBConnection) {
  const res = await db.query("SELECT value FROM settings WHERE key = ?;", [RATING_TO_MOOD_MIGRATION_KEY]);
  if (res.values?.[0]?.value) return;
  // Copie et drapeau dans une même transaction : jamais l'un sans l'autre.
  await db.execute(`
UPDATE dreams SET dream_mood = dream_rating WHERE dream_mood IS NULL AND dream_rating IS NOT NULL;
INSERT OR REPLACE INTO settings (key, value) VALUES ('${RATING_TO_MOOD_MIGRATION_KEY}', '1');
`);
}

async function migrateSchema(db: SQLiteDBConnection) {
  await ensureColumn(db, "dreams", "dream_mood", "dream_mood INTEGER");
  await ensureColumn(db, "dreams", "dream_realism", "dream_realism INTEGER");
  // Suppression en attente (annulable quelques secondes), voir db/pendingDeletions.ts.
  await ensureColumn(db, "dreams", "deleted_at", "deleted_at TEXT");
  await migrateRatingToMood(db);
}

async function openConnection(): Promise<SQLiteDBConnection> {
  if (isWebPlatform) {
    await customElements.whenDefined("jeep-sqlite");
    await sqlite.initWebStore();
  }

  const consistency = await sqlite.checkConnectionsConsistency();
  const alreadyOpen = (await sqlite.isConnection(DB_NAME, false)).result;

  let db: SQLiteDBConnection;
  if (consistency.result && alreadyOpen) {
    db = await sqlite.retrieveConnection(DB_NAME, false);
  } else {
    db = await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
  }
  await db.open();
  await db.execute(SCHEMA_STATEMENTS);
  await migrateSchema(db);
  await seedDefaults(db);
  if (isWebPlatform) {
    await sqlite.saveToStore(DB_NAME);
  }
  return db;
}

export function getDatabase(): Promise<SQLiteDBConnection> {
  if (!dbPromise) {
    dbPromise = openConnection();
  }
  return dbPromise;
}

/** À appeler après toute écriture pour persister sur le web (IndexedDB). No-op sur natif. */
export async function persist(): Promise<void> {
  if (isWebPlatform) {
    await sqlite.saveToStore(DB_NAME);
  }
}
