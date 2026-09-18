import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

const REMINDER_ID = 1;

export interface ReminderTime {
  hour: number;
  minute: number;
}

export function isReminderSupported(): boolean {
  return Capacitor.getPlatform() === "android";
}

/** Programme (ou reprogramme) un rappel local quotidien. Ne contacte jamais le réseau. */
export async function scheduleMorningReminder(time: ReminderTime): Promise<void> {
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") {
    throw new Error("Permission de notification refusée dans les réglages du téléphone.");
  }
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: "Un rêve à noter ?",
        body: "Avant qu'il ne s'efface, prends une minute pour l'écrire dans Lucide.",
        schedule: { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: true },
      },
    ],
  });
}

export async function cancelMorningReminder(): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
}
