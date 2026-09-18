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
  sleep_quality INTEGER
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

async function seedDefaults(db: SQLiteDBConnection) {
  const countRes = await db.query("SELECT COUNT(*) as n FROM emotions;");
  const n = countRes.values?.[0]?.n ?? 0;
  if (n === 0) {
    for (const e of DEFAULT_EMOTIONS) {
      await db.run(
        "INSERT INTO emotions (id, label, emoji, is_default) VALUES (?, ?, ?, 1);",
        [cryptoId(), e.label, e.emoji],
      );
    }
  }
}

function cryptoId(): string {
  return crypto.randomUUID();
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
