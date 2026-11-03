/**
 * Name der Akzentfarbe für die Anzeige unter dem Tupfer (@W3-040, „Farbe nie allein“): aus dem Farbton, nur ein Schlüssel.
 * Die Wörter stehen in `wizard:step3.graphics.accent.names`. Rein, ohne DOM.
 */
import { hexToHsl } from '../colorUtils';

export type AccentNameKey = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'brown' | 'gray';

/** Unter dieser HSL-Sättigung (Prozent) hat eine Farbe keinen erkennbaren Farbton. */
const GRAY_BELOW_SATURATION = 15;
/** Orange unter dieser HSL-Helligkeit (Prozent) heißt Braun. */
const BROWN_BELOW_LIGHTNESS = 38;

/** Obere Grenzen der Farbton-Bereiche in Grad; Rot schließt über die Nullgrenze hinweg an. */
const HUE_BANDS: ReadonlyArray<readonly [number, AccentNameKey]> = [
  [15, 'red'], [45, 'orange'], [70, 'yellow'], [165, 'green'], [195, 'teal'], [255, 'blue'], [290, 'purple'], [345, 'pink'],
];

export function accentNameKey(hex: string): AccentNameKey {
  const { h, s, l } = hexToHsl(hex);
  if (s < GRAY_BELOW_SATURATION) { return 'gray'; }
  const band = HUE_BANDS.find(([upper]) => h < upper)?.[1] ?? 'red';
  return band === 'orange' && l < BROWN_BELOW_LIGHTNESS ? 'brown' : band;
}
