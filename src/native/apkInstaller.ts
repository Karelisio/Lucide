import { registerPlugin } from "@capacitor/core";

export interface ApkInstallerPlugin {
  /** Lance l'installateur système Android sur l'APK situé à `path` (chemin disque natif). */
  install(options: { path: string }): Promise<void>;
}

/**
 * Plugin natif maison (android/app/src/main/java/io/karelisio/lucide/ApkInstallerPlugin.java).
 * Pas d'implémentation web : indisponible hors de l'app Android installée.
 */
const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

export default ApkInstaller;
