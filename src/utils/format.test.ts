import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultNightDateForNow, formatNightLabel, todayIsoDate } from "./format";

// Fuseau Europe/Paris (vitest.config.ts).
afterEach(() => {
  vi.useRealTimers();
});

function at(localIso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(localIso));
}

describe("fuseau des tests", () => {
  it("est Europe/Paris, avec heure d'été", () => {
    expect(new Date("2026-07-01T12:00:00").getTimezoneOffset()).toBe(-120);
    expect(new Date("2026-12-01T12:00:00").getTimezoneOffset()).toBe(-60);
  });
});

describe("formatNightLabel", () => {
  it("affiche la nuit et son lendemain", () => {
    expect(formatNightLabel("2026-09-29")).toBe("Nuit du 29 sept. au 30 sept.");
    expect(formatNightLabel("2026-12-31")).toBe("Nuit du 31 déc. au 1 janv.");
  });

  it("nuit du passage à l'heure d'hiver (25 h) : lendemain au calendrier", () => {
    expect(formatNightLabel("2026-10-25")).toBe("Nuit du 25 oct. au 26 oct.");
    expect(formatNightLabel("2026-10-24")).toBe("Nuit du 24 oct. au 25 oct.");
  });

  it("nuit du passage à l'heure d'été (23 h)", () => {
    expect(formatNightLabel("2026-03-29")).toBe("Nuit du 29 mars au 30 mars");
  });
});

describe("defaultNightDateForNow", () => {
  it("jusqu'à midi, la nuit est celle de la veille", () => {
    at("2026-09-30T01:00:00");
    expect(defaultNightDateForNow()).toBe("2026-09-29");
    at("2026-09-30T11:59:00");
    expect(defaultNightDateForNow()).toBe("2026-09-29");
  });

  it("à partir de midi, la nuit qui commence", () => {
    at("2026-09-30T12:00:00");
    expect(defaultNightDateForNow()).toBe("2026-09-30");
  });

  it("date locale, pas UTC, autour de minuit et du changement d'heure", () => {
    at("2026-10-25T00:30:00"); // encore le 24 à 22:30 UTC
    expect(defaultNightDateForNow()).toBe("2026-10-24");
    at("2026-10-26T01:00:00");
    expect(defaultNightDateForNow()).toBe("2026-10-25");
  });
});

describe("todayIsoDate", () => {
  it("date locale juste après minuit", () => {
    at("2026-09-30T00:15:00"); // 29 septembre en UTC
    expect(todayIsoDate()).toBe("2026-09-30");
  });
});
