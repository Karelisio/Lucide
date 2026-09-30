import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { getSetting } from "../db/dreamRepository";

const REMINDER_ID = 1;
export const REMINDER_ENABLED_KEY = "reminder_enabled";
export const REMINDER_TIME_KEY = "reminder_time";
export const DEFAULT_REMINDER_TIME = "08:00";

export interface ReminderTime {
  hour: number;
  minute: number;
}

export function isReminderSupported(): boolean {
  return Capacitor.getPlatform() === "android";
}

/** "HH:MM" (valeur d'un <input type="time">) → heure et minute. */
export function parseReminderTime(value: string): ReminderTime {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

/**
 * Autorisation « Alarmes et rappels » (Android 12+ ; toujours accordée avant). Sans elle, cas par
 * défaut à partir d'Android 14, le rappel est une alarme approximative que le système peut décaler.
 */
export async function isExactAlarmAllowed(): Promise<boolean> {
  const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
  return exact_alarm === "granted";
}

/** Ouvre le réglage système « Alarmes et rappels » ; renvoie l'autorisation au retour dans l'app. */
export async function openExactAlarmSetting(): Promise<boolean> {
  const { exact_alarm } = await LocalNotifications.changeExactNotificationSetting();
  return exact_alarm === "granted";
}

async function schedule(time: ReminderTime): Promise<void> {
  // Alarme exacte seulement si elle est autorisée : sinon le plugin ouvrirait lui-même l'écran
  // « Alarmes et rappels » à chaque programmation, y compris au démarrage. Ce réglage est proposé
  // explicitement dans Réglages.
  const exact = await isExactAlarmAllowed();
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: "Un rêve à noter ?",
        body: "Avant qu'il ne s'efface, prends une minute pour l'écrire dans Lucide.",
        schedule: { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: true },
        isExactNotification: exact,
      },
    ],
  });
}

/** Programme (ou reprogramme) un rappel local quotidien. Ne contacte jamais le réseau. */
export async function scheduleMorningReminder(time: ReminderTime): Promise<void> {
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") {
    throw new Error("Permission de notification refusée dans les réglages du téléphone.");
  }
  await schedule(time);
}

export async function cancelMorningReminder(): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
}

/**
 * Au démarrage de l'app : un arrêt forcé (ou le retrait de « Alarmes et rappels ») annule ses
 * alarmes, et rien ne les reprogramme avant le prochain redémarrage du téléphone. Ne demande
 * rien : si les notifications ont été refusées entre-temps, on n'insiste pas. Ne lève jamais.
 */
export async function restoreMorningReminder(): Promise<void> {
  if (!isReminderSupported()) return;
  try {
    if ((await getSetting(REMINDER_ENABLED_KEY)) !== "1") return;
    if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
    await schedule(parseReminderTime((await getSetting(REMINDER_TIME_KEY)) ?? DEFAULT_REMINDER_TIME));
  } catch {
    // le rappel ne doit jamais gêner l'ouverture de l'app
  }
}
