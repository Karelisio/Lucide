import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  BackupFormatError,
  base64Chunks,
  buildBackupZip,
  bytesToBase64,
  describeRestoreReport,
  parseBackup,
  planRestore,
  readBackupFile,
  type BackupBundle,
  type ParsedBackup,
} from "./backupFormat";

const NOW = "2026-09-30T08:00:00.000Z";

function bundle(overrides: Partial<BackupBundle> = {}): BackupBundle {
  return {
    app: "Lucide",
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: "1.3.0",
    exportedAt: NOW,
    emotions: [
      { id: "e-peur", label: "Peur", emoji: "😨", isDefault: true },
      { id: "e-nostalgie", label: "Nostalgie", emoji: "🥲", isDefault: false },
    ],
    tags: [{ id: "t-vol", label: "Vol" }],
    dreams: [
      {
        id: "d1",
        nightDate: "2026-09-20",
        createdAt: "2026-09-21T06:00:00.000Z",
        updatedAt: "2026-09-21T06:30:00.000Z",
        text: "Un rêve",
        locations: ["Paris"],
        characters: ["Élodie"],
        emotionIds: ["e-peur", "e-nostalgie"],
        tagIds: ["t-vol"],
        moodRating: 0,
        realismRating: 10,
        sleepQuality: 4,
        audioNotes: [
          {
            id: "n1",
            dreamId: "d1",
            filePath: "dream_audio/recording-1.aac",
            durationMs: 4321,
            createdAt: "2026-09-21T06:01:00.000Z",
            exportedFile: "audio/n1.aac",
          },
        ],
      },
    ],
    ...overrides,
  };
}

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("archive .zip", () => {
  it("aller-retour : données et octets audio intacts", async () => {
    const audio = new Uint8Array(7000).map((_, i) => (i * 13) % 256);
    const zip = await buildBackupZip(bundle(), [{ path: "audio/n1.aac", base64: bytesToBase64(audio) }]);
    const file = await readBackupFile(zip);
    expect(file.jsonOnly).toBe(false);
    expect(file.backup.formatVersion).toBe(2);
    expect(file.backup.invalidDreams).toBe(0);
    const [d1] = file.backup.dreams;
    expect(d1).toMatchObject({
      id: "d1",
      nightDate: "2026-09-20",
      createdAt: "2026-09-21T06:00:00.000Z",
      moodRating: 0,
      realismRating: 10,
      sleepQuality: 4,
      locations: ["Paris"],
      characters: ["Élodie"],
    });
    expect(d1.audioNotes).toEqual([{ exportedFile: "audio/n1.aac", durationMs: 4321, createdAt: "2026-09-21T06:01:00.000Z" }]);
    expect(await file.readAudio("audio/n1.aac")).toEqual(audio);
    expect(await file.readAudio("audio/absent.aac")).toBeNull();
  });

  it("data.json dans un sous-dossier (ancien dossier de sauvegarde compressé)", async () => {
    const zip = new JSZip();
    zip.file("backup_20260920_0800/data.json", JSON.stringify(bundle({ formatVersion: undefined as unknown as number })));
    zip.file("backup_20260920_0800/audio/n1.aac", "abc");
    const file = await readBackupFile(await zip.generateAsync({ type: "uint8array" }));
    expect(file.backup.formatVersion).toBe(1);
    expect(await file.readAudio("audio/n1.aac")).toEqual(utf8("abc"));
  });

  it("archive sans data.json ou illisible : erreur explicite", async () => {
    const zip = new JSZip();
    zip.file("photo.jpg", "x");
    await expect(readBackupFile(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(/data\.json/);
    await expect(readBackupFile(utf8("PK\u0003\u0004 tronqué"))).rejects.toThrow(BackupFormatError);
  });
});

describe("data.json seul (Lucide ≤ 1.2)", () => {
  it("ancien format sans formatVersion ; ancienne note /10 reprise en ressenti", async () => {
    const legacy = {
      app: "Lucide",
      exportedAt: NOW,
      emotions: [],
      tags: [],
      dreams: [{ id: "old", nightDate: "2026-09-01", text: "x", dreamRating: 7, audioNotes: [{ exportedFile: "audio/a.aac" }] }],
    };
    const file = await readBackupFile(utf8(`﻿${JSON.stringify(legacy)}`));
    expect(file.jsonOnly).toBe(true);
    expect(file.backup.formatVersion).toBe(1);
    expect(file.backup.dreams[0]).toMatchObject({ moodRating: 7, realismRating: null, sleepQuality: null, emotionIds: [] });
    expect(await file.readAudio("audio/a.aac")).toBeNull();
  });

  it("fichier illisible ou d'une autre app", async () => {
    await expect(readBackupFile(utf8("pas du json"))).rejects.toThrow(BackupFormatError);
    await expect(readBackupFile(utf8(JSON.stringify({ app: "Autre", dreams: [] })))).rejects.toThrow(
      "Ce fichier n'est pas une sauvegarde Lucide.",
    );
  });
});

describe("parseBackup", () => {
  it("refuse une version plus récente", () => {
    expect(() => parseBackup(bundle({ formatVersion: BACKUP_FORMAT_VERSION + 1 }))).toThrow(/version plus récente/);
    expect(() => parseBackup({ ...bundle(), formatVersion: "2" })).toThrow(BackupFormatError);
  });

  it("ignore et compte les entrées invalides, borne les notes", () => {
    const parsed = parseBackup(
      {
        app: "Lucide",
        dreams: [
          { id: "ok", nightDate: "2026-09-01", moodRating: 11, realismRating: 2.5, sleepQuality: 0, locations: ["a", 3] },
          { id: "", nightDate: "2026-09-01" },
          { id: "bad-date", nightDate: "2026-02-30" },
          { id: "bad-format", nightDate: "01/09/2026" },
          "pas un objet",
        ],
      },
      NOW,
    );
    expect(parsed.invalidDreams).toBe(4);
    expect(parsed.dreams).toHaveLength(1);
    expect(parsed.dreams[0]).toMatchObject({
      id: "ok",
      createdAt: NOW,
      updatedAt: NOW,
      text: "",
      moodRating: null,
      realismRating: null,
      sleepQuality: null,
      locations: ["a"],
      audioNotes: [],
    });
  });
});

describe("planRestore", () => {
  const counter = () => {
    let n = 0;
    return () => `new-${++n}`;
  };

  it("ne remplace jamais un rêve existant et rapproche émotions et tags par leur nom", () => {
    const backup: ParsedBackup = parseBackup(
      bundle({
        emotions: [
          { id: "e-peur", label: "peur ", emoji: "😨", isDefault: true },
          { id: "e-nostalgie", label: "Nostalgie", emoji: "🥲", isDefault: false },
          { id: "e-doublon", label: "NOSTALGIE", emoji: "🥲", isDefault: false },
        ],
        tags: [{ id: "t-vol", label: "VOL" }, { id: "t-eau", label: "eau" }],
        dreams: [
          { ...bundle().dreams[0], id: "existant" },
          { ...bundle().dreams[0], id: "nouveau", emotionIds: ["e-peur", "e-nostalgie", "e-doublon", "inconnue"], tagIds: ["t-vol", "t-eau"] },
          { ...bundle().dreams[0], id: "nouveau" },
        ],
      }),
    );
    const plan = planRestore(
      backup,
      {
        dreamIds: new Set(["existant"]),
        emotions: [{ id: "local-peur", label: "Peur" }],
        tags: [{ id: "local-vol", label: "Vol" }],
      },
      counter(),
    );
    expect(plan.skipped).toBe(2);
    expect(plan.dreams.map((d) => d.id)).toEqual(["nouveau"]);
    expect(plan.emotionsToCreate).toEqual([{ id: "new-1", label: "Nostalgie", emoji: "🥲" }]);
    expect(plan.tagsToCreate).toEqual([{ id: "new-2", label: "eau" }]);
    expect(plan.dreams[0].emotionIds).toEqual(["local-peur", "new-1"]);
    expect(plan.dreams[0].tagIds).toEqual(["local-vol", "new-2"]);
  });
});

describe("describeRestoreReport", () => {
  it("bilan de la restauration", () => {
    const base = { added: 3, skipped: 1, errors: 0, audioRestored: 2, audioMissing: 0, jsonOnly: false };
    expect(describeRestoreReport(base)).toBe(
      "Restauration terminée : 3 rêve(s) ajouté(s), 1 déjà présent(s), laissé(s) tel(s) quel(s). 2 mémo(s) audio restauré(s).",
    );
    expect(describeRestoreReport({ ...base, errors: 2, audioMissing: 1 })).toContain("2 illisible(s) ou en erreur");
    expect(describeRestoreReport({ ...base, audioRestored: 0, audioMissing: 4, jsonOnly: true })).toContain(
      "Fichier .json seul : 4 mémo(s) audio non inclus",
    );
  });
});

describe("base64Chunks", () => {
  it("morceaux indépendants dont la concaténation redonne les octets", () => {
    const bytes = new Uint8Array(10_001).map((_, i) => (i * 31 + 7) % 256);
    const chunks = base64Chunks(bytes, 1000);
    expect(chunks).toHaveLength(11); // morceaux de 999 octets
    expect(chunks.slice(0, -1).every((c) => !c.includes("="))).toBe(true);
    const decoded = chunks.flatMap((c) => [...atob(c)].map((ch) => ch.charCodeAt(0)));
    expect(new Uint8Array(decoded)).toEqual(bytes);
    expect(base64Chunks(new Uint8Array(0))).toEqual([]);
  });
});
