/**
 * pdfKartenFarben – Kartenfarben fürs PDF als RGB-Tupel (jsPDF braucht RGB). Abgeleitet aus den Karten-Tokens `cardYellow`/`cardRed`
 * (hell und dunkel gleich), nie hart codiert (Oberfläche E „Karten-Farben nur für Karten“, Befund C-KARTE-GELB-ALS-WARNFARBE).
 * Schrift: Tinte auf Kartengelb, Papierweiß auf Kartenrot (`printColors`).
 */
import { semanticColorsLight } from '../../design-tokens/colors';
import { printColors } from '../../design-tokens/print';
import { hexToRgb } from '../colorUtils';

export type PdfRgb = [number, number, number];

function tupel(hex: string): PdfRgb {
  const { r, g, b } = hexToRgb(hex);
  return [r, g, b];
}

export const pdfKartenFarben = {
  yellow: tupel(semanticColorsLight.cardYellow),
  red: tupel(semanticColorsLight.cardRed),
  textOnYellow: [...printColors.ink] as PdfRgb,
  textOnRed: [...printColors.paper] as PdfRgb,
} as const;
