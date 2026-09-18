export type ThemeMode = "system" | "light" | "dark" | "oled";
export type ResolvedTheme = "light" | "dark" | "oled";

export interface EmotionDef {
  id: string;
  label: string;
  emoji: string;
  isDefault: boolean;
}

export interface TagDef {
  id: string;
  label: string;
}

export interface AudioNote {
  id: string;
  dreamId: string;
  filePath: string;
  durationMs: number;
  createdAt: string;
}

export interface Dream {
  id: string;
  /** Nuit du ... au ... : on stocke la date de la nuit (date du coucher), format ISO yyyy-MM-dd */
  nightDate: string;
  createdAt: string;
  updatedAt: string;
  text: string;
  locations: string[];
  characters: string[];
  emotionIds: string[];
  tagIds: string[];
  dreamRating: number | null; // note /10
  sleepQuality: number | null; // 1-5 étoiles, peut exister sans rêve
  audioNotes: AudioNote[];
}

export interface DreamFormValues {
  nightDate: string;
  text: string;
  locations: string[];
  characters: string[];
  emotionIds: string[];
  tagIds: string[];
  dreamRating: number | null;
  sleepQuality: number | null;
}

export type StatsRange = "week" | "month" | "year";

export interface ExportBundlePaths {
  jsonPath: string;
  audioDir: string;
}
