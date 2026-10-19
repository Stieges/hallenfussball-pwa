/**
 * Turnier-Einstellung „Anzeige für Zuschauer“ (Spielanzeige 2.1, Spec § 4.1; @ZM-152, @ZM-153, @ZM-154):
 * „Teamfarben in den Ergebniskästen“ (Vorgabe an), „Standardfarbe Heim“ (Blau) und „Standardfarbe Gast“ (Rot).
 *
 * Die Standardfarben sind Daten, keine Gestaltungswerte (wie `DEFAULT_BIB_COLOR`): nur mit Blau `#1565C0` und Rot
 * `#C62828` stimmen die Abstände des Gherkin (@ZM-153 44,8; @ZM-159 26,3/25,3). Liegt im `tournaments.config`-JSONB.
 */
import { z } from 'zod';
import { kitConflict, normalizeKitColor } from './kit';

export interface SpectatorDisplaySettings {
  /** „Teamfarben in den Ergebniskästen“ */
  teamColors: boolean;
  /** „Standardfarbe Heim“, `#RRGGBB` */
  homeColor: string;
  /** „Standardfarbe Gast“, `#RRGGBB` */
  awayColor: string;
}

/** @ZM-152 Vorbelegung „Standardfarbe Heim“: Blau. */
export const DEFAULT_HOME_BOX_COLOR = '#1565C0';
/** @ZM-152 Vorbelegung „Standardfarbe Gast“: Rot. */
export const DEFAULT_AWAY_BOX_COLOR = '#C62828';

/** @ZM-152: Teamfarben an, Heim Blau, Gast Rot. */
export const DEFAULT_SPECTATOR_DISPLAY: SpectatorDisplaySettings = Object.freeze({
  teamColors: true,
  homeColor: DEFAULT_HOME_BOX_COLOR,
  awayColor: DEFAULT_AWAY_BOX_COLOR,
});

/**
 * Voreinstellungen der Farbauswahl für die Standardfarben (Daten, keine Gestaltungswerte; Namen wie im Gherkin @ZM-153/@ZM-159
 * und im Mockup `einstellungen.html`). Andere Farben wählt die Person mit dem freien Farbwähler; ihr Name ist dann der Hex-Wert.
 */
export const BOX_COLOR_PRESETS = [
  { key: 'blue', hex: DEFAULT_HOME_BOX_COLOR },
  { key: 'red', hex: DEFAULT_AWAY_BOX_COLOR },
  { key: 'yellow', hex: '#FACC15' },
  { key: 'navy', hex: '#0D1B4C' },
  { key: 'white', hex: '#FFFFFF' },
  { key: 'black', hex: '#000000' },
] as const;

export type BoxColorPresetKey = (typeof BOX_COLOR_PRESETS)[number]['key'];

/** Name der Voreinstellung zu einer Farbe (Groß-/Kleinschreibung egal), sonst `undefined`. */
export function boxColorPresetKey(hex: string): BoxColorPresetKey | undefined {
  return BOX_COLOR_PRESETS.find((preset) => preset.hex.toLowerCase() === hex.toLowerCase())?.key;
}

const colorOr = (fallback: string) => z.unknown().optional().transform((value) => normalizeKitColor(value) ?? fallback);

/**
 * Lesen mit Rückfall je Schlüssel (RF1): ungültiger Wert → Vorgabe dieses Schlüssels, kein Objekt → ganze Vorgabe.
 * Farben normalisiert (`#fff` → `#FFFFFF`), fremde Schlüssel fallen weg.
 */
const SpectatorDisplayReadSchema = z
  .object({
    teamColors: z.boolean().catch(DEFAULT_SPECTATOR_DISPLAY.teamColors),
    homeColor: colorOr(DEFAULT_SPECTATOR_DISPLAY.homeColor),
    awayColor: colorOr(DEFAULT_SPECTATOR_DISPLAY.awayColor),
  })
  .catch({ ...DEFAULT_SPECTATOR_DISPLAY });

/** Beliebiges JSON → gültige Einstellung (nie leer, nie eine ungültige Farbe). */
export function parseSpectatorDisplay(raw: unknown): SpectatorDisplaySettings {
  return SpectatorDisplayReadSchema.parse(Array.isArray(raw) ? undefined : raw);
}

/** @ZM-153: Hinweis in der Vorschau, wenn die Standardfarben zu ähnlich sind (ΔE2000 < 30, wie @SL-139). Speichern bleibt möglich. */
export function standardColorsTooSimilar(settings: SpectatorDisplaySettings): boolean {
  return kitConflict(settings.homeColor, settings.awayColor) !== 'none';
}
