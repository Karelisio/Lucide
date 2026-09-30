import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Fuseau fixe (celui de l'utilisateur, avec changements d'heure) : les tests de dates en
    // dépendent (minuit local ≠ minuit UTC, nuit de 25 h fin octobre).
    env: { TZ: "Europe/Paris" },
  },
});
