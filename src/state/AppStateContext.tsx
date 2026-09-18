import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import type { EmotionDef, ResolvedTheme, TagDef, ThemeMode } from "../types";
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
import DynamicColor, { type DynamicColorPalette } from "../native/dynamicColor";

const THEME_KEY = "theme_mode";
const DYNAMIC_COLOR_KEY = "dynamic_color_enabled";

const DYNAMIC_COLOR_CSS_MAP: Record<keyof DynamicColorPalette, string> = {
  primary: "--md-sys-color-primary",
  onPrimary: "--md-sys-color-on-primary",
  primaryContainer: "--md-sys-color-primary-container",
  onPrimaryContainer: "--md-sys-color-on-primary-container",
  secondary: "--md-sys-color-secondary",
  onSecondary: "--md-sys-color-on-secondary",
  secondaryContainer: "--md-sys-color-secondary-container",
  onSecondaryContainer: "--md-sys-color-on-secondary-container",
  tertiary: "--md-sys-color-tertiary",
  onTertiary: "--md-sys-color-on-tertiary",
  tertiaryContainer: "--md-sys-color-tertiary-container",
  onTertiaryContainer: "--md-sys-color-on-tertiary-container",
};

interface AppStateValue {
  ready: boolean;
  initError: string | null;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => Promise<void>;
  dynamicColorSupported: boolean;
  dynamicColorEnabled: boolean;
  dynamicColorError: string | null;
  setDynamicColorEnabled: (enabled: boolean) => Promise<void>;
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
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches !== false,
  );
  const [dynamicColorEnabled, setDynamicColorEnabledState] = useState(false);
  const [dynamicColorError, setDynamicColorError] = useState<string | null>(null);
  const dynamicColorSupported = Capacitor.getPlatform() === "android";
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
        if (!cancelled && (storedTheme === "dark" || storedTheme === "light" || storedTheme === "oled" || storedTheme === "system")) {
          setThemeState(storedTheme);
        }
        const storedDynamicColor = await getSetting(DYNAMIC_COLOR_KEY);
        if (!cancelled && storedDynamicColor === "1") {
          setDynamicColorEnabledState(true);
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
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    await setSetting(THEME_KEY, mode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!dynamicColorEnabled || !dynamicColorSupported) {
      for (const cssVar of Object.values(DYNAMIC_COLOR_CSS_MAP)) root.style.removeProperty(cssVar);
      setDynamicColorError(null);
      return;
    }
    let cancelled = false;
    DynamicColor.getColors()
      .then((palette) => {
        if (cancelled) return;
        (Object.keys(DYNAMIC_COLOR_CSS_MAP) as Array<keyof DynamicColorPalette>).forEach((key) => {
          root.style.setProperty(DYNAMIC_COLOR_CSS_MAP[key], palette[key]);
        });
        setDynamicColorError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        for (const cssVar of Object.values(DYNAMIC_COLOR_CSS_MAP)) root.style.removeProperty(cssVar);
        setDynamicColorError(e instanceof Error ? e.message : "Couleurs dynamiques indisponibles sur cet appareil.");
      });
    return () => {
      cancelled = true;
    };
  }, [dynamicColorEnabled, dynamicColorSupported, resolvedTheme]);

  const setDynamicColorEnabled = useCallback(async (enabled: boolean) => {
    setDynamicColorEnabledState(enabled);
    await setSetting(DYNAMIC_COLOR_KEY, enabled ? "1" : "0");
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
    () => ({
      ready,
      initError,
      theme,
      resolvedTheme,
      setTheme,
      dynamicColorSupported,
      dynamicColorEnabled,
      dynamicColorError,
      setDynamicColorEnabled,
      emotions,
      tags,
      refreshTaxonomy,
      addEmotion,
      removeEmotion,
      addTag,
      removeTag,
    }),
    [
      ready,
      initError,
      theme,
      resolvedTheme,
      setTheme,
      dynamicColorSupported,
      dynamicColorEnabled,
      dynamicColorError,
      setDynamicColorEnabled,
      emotions,
      tags,
      refreshTaxonomy,
      addEmotion,
      removeEmotion,
      addTag,
      removeTag,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState doit être utilisé sous AppStateProvider");
  return ctx;
}
