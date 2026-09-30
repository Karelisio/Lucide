import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { containsGlob } from "./search";

const TEXTS = [
  "École de nuit",
  "retour à l'école",
  "ECOLE sans accent",
  "Ça commence",
  "Straße",
  "50% [crochets] *étoiles* a_b ?",
  '["Paris","Île de Ré"]',
  "rien",
];

describe("containsGlob (SQLite, même moteur que jeep-sqlite)", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE t (s TEXT)");
  for (const text of TEXTS) db.run("INSERT INTO t VALUES (?)", [text]);
  const search = (term: string): string[] =>
    db.exec("SELECT s FROM t WHERE s GLOB ?", [containsGlob(term)])[0]?.values.map((row: unknown[]) => row[0] as string) ??
    [];
  // Référence : l'ancien filtre JS de la liste.
  const reference = (term: string) => TEXTS.filter((text) => text.toLowerCase().includes(term.toLowerCase()));

  it.each(["école", "ÉCOLE", "ecole", "ça", "ß", "île", "%", "_", "[c", "*é", "?", "] *", "paris", "x"])(
    "« %s » comme toLowerCase().includes",
    (term) => {
      expect(search(term)).toEqual(reference(term));
    },
  );

  it("LIKE n'aurait pas suffi (casse ASCII seulement)", () => {
    const like = db.exec("SELECT s FROM t WHERE s LIKE '%école%'")[0].values.map((row: unknown[]) => row[0]);
    expect(like).toEqual(["retour à l'école"]);
    expect(search("école")).toEqual(["École de nuit", "retour à l'école"]);
  });
});
