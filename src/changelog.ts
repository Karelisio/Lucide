import raw from "../changelog.json";

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

/** Plus récent en premier. Source unique aussi utilisée par la CI pour numéroter l'APK Android. */
export const CHANGELOG: ChangelogEntry[] = raw;

export const CURRENT_VERSION: string = CHANGELOG[0]?.version ?? "0.0.0";
