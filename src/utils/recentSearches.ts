import { getSetting, setSetting } from "../db/dreamRepository";

const KEY = "recent_searches";
const MAX = 6;

export async function getRecentSearches(): Promise<string[]> {
  const raw = await getSetting(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(term: string): Promise<string[]> {
  const clean = term.trim();
  if (clean.length < 2) return getRecentSearches();
  const current = await getRecentSearches();
  const next = [clean, ...current.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, MAX);
  await setSetting(KEY, JSON.stringify(next));
  return next;
}
