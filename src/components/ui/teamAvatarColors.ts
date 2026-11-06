/**
 * Farben des Team-Abzeichens mit Initialen (@ZM-159 Farbregel der Kästen, C-ZUSCHAUER-INITIALEN-WEISS, Durchsicht Z5):
 * Die Schrift richtet sich nach der Füllung (mindestens 4,5 : 1, Schwarz oder Weiß wie bei den Ergebniskästen), und eine sehr helle
 * oder sehr dunkle Füllung bekommt einen kräftigen Rand, damit der Kreis auf hellem wie dunklem Grund sichtbar bleibt.
 */
import { palette } from '../../design-tokens/colors';
import { getContrastRatio } from '../../design-tokens/display';

const WHITE = palette.neutral[0];
const BLACK = palette.kit.black;

/** Hex mit 3 oder 6 Stellen als `#RRGGBB`; alles andere (Namen, `rgb(…)`, `var(…)`) ist hier unbekannt. */
function normalizeHex(color: string): string | null {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  }
  return /^#[0-9a-f]{6}$/i.test(color) ? color : null;
}

/** Ab diesem Kontrast zu Weiß bzw. Schwarz hebt sich eine Füllung vom Grund ab (WCAG 1.4.11 für Bedienelemente und Grafik). */
const MIN_GRAPHIC_CONTRAST = 3;

/**
 * Schriftfarbe der Initialen auf `fill`: Weiß oder Schwarz, was mehr Kontrast gibt (mindestens 4,5 : 1 bei jeder Füllung, anders als das
 * Anthrazit der Ergebniskästen, das bei einem schmalen Mittelgrau knapp darunter bleibt). Unbekanntes Farbformat: Weiß wie bisher.
 */
export function initialsColorOn(fill: string): string {
  const hex = normalizeHex(fill);
  if (hex === null) {
    return WHITE;
  }
  return getContrastRatio(hex, BLACK) >= getContrastRatio(hex, WHITE) ? BLACK : WHITE;
}

/** Braucht der Kreis einen kräftigen Rand? Sehr helle Füllung (Weiß, Gelb) verschwindet auf hellem Grund, sehr dunkle auf dunklem. */
export function fillNeedsRim(fill: string): boolean {
  const hex = normalizeHex(fill);
  if (hex === null) {
    return false;
  }
  return getContrastRatio(hex, WHITE) < MIN_GRAPHIC_CONTRAST || getContrastRatio(hex, BLACK) < MIN_GRAPHIC_CONTRAST;
}
