/**
 * Farbrechnung der Spielanzeige (Aufgabe 2.2): Mischen von Hex-Farben und Rahmenregel der Ergebniskästen.
 * Eigene Datei, damit `display.ts` (Grenzdatei) nicht wächst (Ruling R-SA3).
 */
import { displayLayout, getContrastRatio } from './display';

const HEX_FULL = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;

function parseHex(hex: string): [number, number, number] | null {
  const full = HEX_FULL.exec(hex);
  if (full) {
    return [parseInt(full[1], 16), parseInt(full[2], 16), parseInt(full[3], 16)];
  }
  const short = HEX_SHORT.exec(hex);
  return short ? [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)] : null;
}

const channel = (value: number): string => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0').toUpperCase();

/**
 * Mischt `hex` mit `withHex`; `share` (Zahl von 0 bis 1) ist der Anteil von `withHex`. Ergebnis `#RRGGBB`.
 * Der Anteil kommt als Zahl, nicht als Token-String („30%“, B4); eine ungültige Farbe wird unverändert zurückgegeben.
 */
export function mixHex(hex: string, withHex: string, share: number): string {
  const a = parseHex(hex);
  const b = parseHex(withHex);
  if (a === null || b === null) {
    return hex;
  }
  const mixed = a.map((value, i) => value * (1 - share) + b[i] * share);
  return `#${channel(mixed[0])}${channel(mixed[1])}${channel(mixed[2])}`;
}

/** Rahmen eines Kastens (Breite und Farbe als CSS-Werte). */
export interface BlockFrame {
  width: string;
  color: string;
}

/** Rahmenbreiten: dezent und kräftig (Monitor: `displayLayout.scoreArea.frameWidth*`, kleine Kästen: `borderWidths`). */
export interface BlockFrameWidths {
  subtle: string;
  strong: string;
}

const MONITOR_WIDTHS: BlockFrameWidths = {
  subtle: displayLayout.scoreArea.frameWidthSubtle,
  strong: displayLayout.scoreArea.frameWidthStrong,
};

/**
 * @ZM-140 / B-44a2: Beide Kästen tragen denselben dezenten Rahmen (Teil der Anzeigetafel-Sprache).
 * Hebt sich die Kastenfarbe mit weniger als 3 : 1 vom Hintergrund ab, ist der Rahmen kräftig und in voller Textfarbe.
 */
export function getBlockFrame(
  blockHex: string,
  backgroundHex: string,
  textColor: string,
  widths: BlockFrameWidths = MONITOR_WIDTHS,
): BlockFrame {
  if (getContrastRatio(blockHex, backgroundHex) < 3) {
    return { width: widths.strong, color: textColor };
  }
  return {
    width: widths.subtle,
    color: `color-mix(in srgb, ${textColor} ${displayLayout.scoreArea.frameSubtleMix}, transparent)`,
  };
}

/**
 * Beide Kästen mit gleicher Rahmenbreite (Entscheidung Daniel 2026-10-15): die kräftige Breite gilt für beide,
 * sobald einer der Kästen sie braucht. Die Rahmenfarbe richtet sich weiter nach dem jeweiligen Kasten.
 */
export function getBlockFrames(
  homeHex: string,
  awayHex: string,
  backgroundHex: string,
  textColor: string,
): { home: BlockFrame; away: BlockFrame } {
  const home = getBlockFrame(homeHex, backgroundHex, textColor);
  const away = getBlockFrame(awayHex, backgroundHex, textColor);
  const width = parseFloat(home.width) >= parseFloat(away.width) ? home.width : away.width;
  return { home: { ...home, width }, away: { ...away, width } };
}
