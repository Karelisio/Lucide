/**
 * Motif GLOB SQLite pour une recherche « contient », insensible à la casse, lettres accentuées
 * comprises. LIKE ne l'est que pour l'ASCII : « école » n'y trouverait pas « École ». Chaque lettre
 * devient une classe [xX] ; *, ? et [ deviennent des classes d'un seul caractère (littéraux).
 */
export function containsGlob(term: string): string {
  let pattern = "*";
  for (const ch of term) {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    if (lower !== upper && [...lower].length === 1 && [...upper].length === 1) {
      pattern += `[${lower}${upper}]`;
    } else if (ch === "*" || ch === "?" || ch === "[") {
      pattern += `[${ch}]`;
    } else {
      pattern += ch;
    }
  }
  return `${pattern}*`;
}
