import { registerPlugin } from "@capacitor/core";

export interface DynamicColorPalette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
}

export interface DynamicColorPlugin {
  /** Rejette si Android < 12 ou si les ressources système sont indisponibles. */
  getColors(): Promise<DynamicColorPalette>;
}

/**
 * Plugin natif maison (android/app/src/main/java/io/karelisio/lucide/DynamicColorPlugin.java).
 * Pas d'implémentation web : indisponible hors de l'app Android installée.
 */
const DynamicColor = registerPlugin<DynamicColorPlugin>("DynamicColor");

export default DynamicColor;
