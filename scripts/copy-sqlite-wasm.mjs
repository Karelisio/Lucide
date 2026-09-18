// jeep-sqlite (utilisé par @capacitor-community/sqlite sur le web) charge son moteur
// SQLite/WASM depuis /assets/sql-wasm.wasm au runtime. Ce script copie le binaire
// fourni par la dépendance sql.js vers public/assets avant le dev server / le build,
// pour éviter de committer un binaire qui doit rester synchronisé avec la dépendance.
//
// Important : le JS "glue" Emscripten de sql.js est inliné tel quel dans le bundle
// de jeep-sqlite (pas ré-importé depuis node_modules/sql.js au runtime). La version
// de sql.js déclarée dans devDependencies (1.11.0, épinglée) doit donc rester celle
// avec laquelle jeep-sqlite a été buildé, sous peine de LinkError WebAssembly
// ("function import requires a callable") au chargement — une version plus récente
// de sql.js (ex. 1.14.x) n'est pas binaire-compatible avec ce glue.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(rootDir, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const destDir = join(rootDir, "public", "assets");
const dest = join(destDir, "sql-wasm.wasm");

if (!existsSync(src)) {
  console.warn("[copy-sqlite-wasm] sql.js introuvable dans node_modules, saut de la copie.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-sqlite-wasm] ${dest} mis à jour.`);
