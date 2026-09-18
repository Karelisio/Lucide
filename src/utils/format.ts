export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatNightLabel(nightDate: string): string {
  const start = new Date(`${nightDate}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  return `Nuit du ${fmt.format(start)} au ${fmt.format(end)}`;
}

export function formatShortDate(nightDate: string): string {
  const d = new Date(`${nightDate}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function todayIsoDate(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

/** Si on saisit un rêve après minuit, la "nuit" logique est celle de la veille jusqu'à midi. */
export function defaultNightDateForNow(): string {
  const now = new Date();
  if (now.getHours() < 12) {
    now.setDate(now.getDate() - 1);
  }
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}
