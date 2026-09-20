import type { Dream, StatsRange } from "../types";

export interface TimelinePoint {
  label: string;
  date: string;
  sleepQuality: number | null;
  moodRating: number | null;
  realismRating: number | null;
}

function daysBack(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function monthsBack(n: number): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d);
    out.push({ key, label });
  }
  return out;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function buildTimeline(dreams: Dream[], range: StatsRange): TimelinePoint[] {
  if (range === "year") {
    const months = monthsBack(12);
    return months.map(({ key, label }) => {
      const entries = dreams.filter((d) => d.nightDate.startsWith(key));
      return {
        date: key,
        label,
        sleepQuality: average(entries.map((d) => d.sleepQuality).filter((v): v is number => v !== null)),
        moodRating: average(entries.map((d) => d.moodRating).filter((v): v is number => v !== null)),
        realismRating: average(entries.map((d) => d.realismRating).filter((v): v is number => v !== null)),
      };
    });
  }

  const days = daysBack(range === "week" ? 7 : 30);
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  return days.map((date) => {
    const entries = dreams.filter((d) => d.nightDate === date);
    return {
      date,
      label: fmt.format(new Date(`${date}T00:00:00`)),
      sleepQuality: average(entries.map((d) => d.sleepQuality).filter((v): v is number => v !== null)),
      moodRating: average(entries.map((d) => d.moodRating).filter((v): v is number => v !== null)),
      realismRating: average(entries.map((d) => d.realismRating).filter((v): v is number => v !== null)),
    };
  });
}

export interface FrequencyItem {
  id: string;
  label: string;
  count: number;
}

export function computeFrequency(
  dreams: Dream[],
  extract: (d: Dream) => string[],
  lookup: Map<string, { label: string }>,
): FrequencyItem[] {
  const counts = new Map<string, number>();
  for (const d of dreams) {
    for (const id of extract(d)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([id, count]) => ({ id, count, label: lookup.get(id)?.label ?? "?" }))
    .sort((a, b) => b.count - a.count);
}

function localIsoDate(d: Date): string {
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

/**
 * Nombre de nuits consécutives journalisées jusqu'à aujourd'hui (ou hier si la nuit
 * dernière n'a pas encore été notée — on ne casse pas le streak avant le réveil).
 */
export function computeStreak(dreams: Dream[]): number {
  const nights = new Set(dreams.map((d) => d.nightDate));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!nights.has(localIsoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (nights.has(localIsoDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function pearsonCorrelation(dreams: Dream[]): number | null {
  const pairs = dreams
    .filter((d) => d.sleepQuality !== null && d.moodRating !== null)
    .map((d) => [d.sleepQuality as number, d.moodRating as number]);
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const sumX = pairs.reduce((a, [x]) => a + x, 0);
  const sumY = pairs.reduce((a, [, y]) => a + y, 0);
  const sumXY = pairs.reduce((a, [x, y]) => a + x * y, 0);
  const sumX2 = pairs.reduce((a, [x]) => a + x * x, 0);
  const sumY2 = pairs.reduce((a, [, y]) => a + y * y, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}
