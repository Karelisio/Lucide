import type { Dream, StatsRange } from "../types";

export interface TimelinePoint {
  label: string;
  date: string;
  sleepQuality: number | null;
  dreamRating: number | null;
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
        dreamRating: average(entries.map((d) => d.dreamRating).filter((v): v is number => v !== null)),
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
      dreamRating: average(entries.map((d) => d.dreamRating).filter((v): v is number => v !== null)),
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

export function pearsonCorrelation(dreams: Dream[]): number | null {
  const pairs = dreams
    .filter((d) => d.sleepQuality !== null && d.dreamRating !== null)
    .map((d) => [d.sleepQuality as number, d.dreamRating as number]);
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
