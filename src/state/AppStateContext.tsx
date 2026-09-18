import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { EmotionDef, TagDef, ThemeMode } from "../types";
import { getDatabase } from "../db/database";
import {
  createEmotion,
  deleteEmotion as deleteEmotionRow,
  deleteTag as deleteTagRow,
  findOrCreateTag,
  getSetting,
  listEmotions,
  listTags,
  setSetting,
} from "../db/dreamRepository";

const THEME_KEY = "theme_mode";

interface AppStateValue {
  ready: boolean;
  initError: string | null;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
  emotions: EmotionDef[];
  tags: TagDef[];
  refreshTaxonomy: () => Promise<void>;
  addEmotion: (label: string, emoji: string) => Promise<EmotionDef>;
  removeEmotion: (id: string) => Promise<void>;
  addTag: (label: string) => Promise<TagDef>;
  removeTag: (id: string) => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [emotions, setEmotions] = useState<EmotionDef[]>([]);
  const [tags, setTags] = useState<TagDef[]>([]);

  const refreshTaxonomy = useCallback(async () => {
    const [e, t] = await Promise.all([listEmotions(), listTags()]);
    setEmotions(e);
    setTags(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDatabase();
        const storedTheme = await getSetting(THEME_KEY);
        if (!cancelled && (storedTheme === "dark" || storedTheme === "light")) {
          setThemeState(storedTheme);
        }
        await refreshTaxonomy();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : "Erreur d'initialisation de la base locale.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTaxonomy]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    await setSetting(THEME_KEY, mode);
  }, []);

  const addEmotion = useCallback(async (label: string, emoji: string) => {
    const e = await createEmotion(label, emoji);
    await refreshTaxonomy();
    return e;
  }, [refreshTaxonomy]);

  const removeEmotion = useCallback(async (id: string) => {
    await deleteEmotionRow(id);
    await refreshTaxonomy();
  }, [refreshTaxonomy]);

  const addTag = useCallback(async (label: string) => {
    const t = await findOrCreateTag(label);
    await refreshTaxonomy();
    return t;
  }, [refreshTaxonomy]);

  const removeTag = useCallback(async (id: string) => {
    await deleteTagRow(id);
    await refreshTaxonomy();
  }, [refreshTaxonomy]);

  const value = useMemo<AppStateValue>(
    () => ({ ready, initError, theme, setTheme, emotions, tags, refreshTaxonomy, addEmotion, removeEmotion, addTag, removeTag }),
    [ready, initError, theme, setTheme, emotions, tags, refreshTaxonomy, addEmotion, removeEmotion, addTag, removeTag],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState doit être utilisé sous AppStateProvider");
  return ctx;
}
