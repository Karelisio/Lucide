import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dream } from "../types";
import { buildTimeline, computeStreak } from "./stats";

// Fuseau Europe/Paris (vitest.config.ts).
afterEach(() => {
  vi.useRealTimers();
});

function at(localIso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(localIso));
}

function dream(nightDate: string, extra: Partial<Dream> = {}): Dream {
  return {
    id: nightDate,
    nightDate,
    createdAt: `${nightDate}T08:00:00.000Z`,
    updatedAt: `${nightDate}T08:00:00.000Z`,
    text: "",
    locations: [],
    characters: [],
    emotionIds: [],
    tagIds: [],
    moodRating: null,
    realismRating: null,
    sleepQuality: null,
    audioNotes: [],
    ...extra,
  };
}

describe("buildTimeline", () => {
  it("semaine : 7 jours locaux se terminant aujourd'hui, même juste après minuit", () => {
    at("2026-09-30T00:30:00"); // 29 septembre, 22:30 UTC
    const week = buildTimeline([], "week");
    expect(week.map((p) => p.date)).toEqual([
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
    ]);
  });

  it("mois : 30 jours, sans trou ni doublon au passage à l'heure d'hiver", () => {
    at("2026-11-05T00:30:00");
    const month = buildTimeline([], "month").map((p) => p.date);
    expect(month).toHaveLength(30);
    expect(new Set(month).size).toBe(30);
    expect(month[0]).toBe("2026-10-07");
    expect(month.at(-1)).toBe("2026-11-05");
    expect(month).toContain("2026-10-25");
  });

  it("moyenne les entrées d'une même nuit", () => {
    at("2026-09-30T09:00:00");
    const week = buildTimeline([dream("2026-09-29", { sleepQuality: 2 }), dream("2026-09-29", { sleepQuality: 5 })], "week");
    expect(week.find((p) => p.date === "2026-09-29")?.sleepQuality).toBe(3.5);
  });
});

describe("computeStreak", () => {
  const nights = (...dates: string[]) => dates.map((d) => dream(d));

  it("le matin, avant de noter la nuit : le streak n'est pas cassé", () => {
    at("2026-09-30T08:00:00");
    // Avant la correction : 0 chaque matin tant que la nuit du 29 n'était pas notée.
    expect(computeStreak(nights("2026-09-28", "2026-09-27", "2026-09-26"))).toBe(3);
  });

  it("le matin, une fois la nuit notée", () => {
    at("2026-09-30T08:00:00");
    expect(computeStreak(nights("2026-09-29", "2026-09-28", "2026-09-27"))).toBe(3);
  });

  it("l'après-midi, la nuit de la veille doit être notée", () => {
    at("2026-09-30T15:00:00");
    expect(computeStreak(nights("2026-09-29", "2026-09-28"))).toBe(2);
    expect(computeStreak(nights("2026-09-28", "2026-09-27"))).toBe(0);
  });

  it("un trou casse le streak", () => {
    at("2026-09-30T08:00:00");
    expect(computeStreak(nights("2026-09-29", "2026-09-27"))).toBe(1);
    expect(computeStreak([])).toBe(0);
  });

  it("à travers le changement d'heure et plusieurs entrées par nuit", () => {
    at("2026-10-27T07:00:00");
    expect(computeStreak(nights("2026-10-26", "2026-10-25", "2026-10-25", "2026-10-24"))).toBe(3);
  });
});
