/**
 * Akzentfarbe aus den Pixeln des Turnierlogos (@DR-041) und davon abgeleiteter Zebra-Ton (@DR-001). Rein, ohne DOM:
 * der Aufrufer liefert die Pixel (`getImageData`). Rechenweg: Notiz „Turnierfarbe“ vom 30.10.2026, Schritte 1–8.
 * Farbumrechnung und Kontrast kommen aus `colorUtils.ts`.
 */
import { getContrastRatio, hexToHsl, hexToRgb, hslToHex, rgbToHex } from '../colorUtils';
import { printAccent, printColors } from '../../design-tokens/print';
import { accentRules } from './accentRules';

/** RGBA-Pixel wie bei `ImageData`: je vier Werte (0–255) pro Bildpunkt, zeilenweise. */
export interface PixelImage {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

interface HueClass { count: number; r: number; g: number; b: number; saturation: number }
interface Candidate { index: number; hex: string; score: number }

const [PAPER_R, PAPER_G, PAPER_B] = printColors.paper;
const PAPER_HEX = rgbToHex({ r: PAPER_R, g: PAPER_G, b: PAPER_B });
const FULL_ALPHA = 255;
const HUE_CIRCLE = 360;
const SIXTH = 60;

/** Farbton (0–360) und HSV-Sättigung und -Helligkeit (0–1) eines Pixels. */
function hsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b) / FULL_ALPHA;
  const min = Math.min(r, g, b) / FULL_ALPHA;
  const d = max - min;
  const [rn, gn, bn] = [r / FULL_ALPHA, g / FULL_ALPHA, b / FULL_ALPHA];
  let h = 0;
  if (d > 0) {
    if (max === rn) { h = ((gn - bn) / d + (gn < bn ? 6 : 0)); }
    else if (max === gn) { h = (bn - rn) / d + 2; }
    else { h = (rn - gn) / d + 4; }
    h *= SIXTH;
  }
  return { h: h % HUE_CIRCLE, s: max === 0 ? 0 : d / max, v: max };
}

/** Grauwert 0–255 einer Farbe (0,299 R + 0,587 G + 0,114 B, gerundet). */
export function grayOf(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const w = accentRules.grayWeights;
  return Math.round(w.r * r + w.g * g + w.b * b);
}

function candidatesOf(image: PixelImage): Candidate[] {
  const classes = new Map<number, HueClass>();
  let visible = 0;
  const { data } = image;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3] / FULL_ALPHA;
    if (alpha < accentRules.visibleAlpha) { continue; }
    visible++;
    if (alpha < accentRules.minAlpha) { continue; }
    const { h, s, v } = hsv(data[i], data[i + 1], data[i + 2]);
    if (s < accentRules.minSaturation || v < accentRules.minValue) { continue; }
    const index = Math.floor(h / accentRules.classDegrees);
    const entry = classes.get(index) ?? { count: 0, r: 0, g: 0, b: 0, saturation: 0 };
    entry.count++;
    entry.r += data[i];
    entry.g += data[i + 1];
    entry.b += data[i + 2];
    entry.saturation += s;
    classes.set(index, entry);
  }
  return [...classes.entries()]
    .map(([index, c]) => ({
      index,
      hex: rgbToHex({ r: c.r / c.count, g: c.g / c.count, b: c.b / c.count }),
      share: c.count / visible,
      score: (c.count / visible) * (c.saturation / c.count),
    }))
    .filter(c => c.share >= accentRules.minShare)
    .sort((a, b) => b.score - a.score);
}

function isYellow(index: number): boolean {
  const from = index * accentRules.classDegrees;
  return from >= accentRules.yellowFromDeg && from < accentRules.yellowToDeg;
}

/** Gelbregel: Ein Gelbton gewinnt nur, wenn keine andere Klasse mindestens 80 % seiner Wertung erreicht. */
function winner(sorted: Candidate[]): Candidate | undefined {
  const top = sorted[0];
  if (top === undefined || !isYellow(top.index)) { return top; }
  const rival = sorted.find(c => !isYellow(c.index) && c.score >= top.score * accentRules.yellowRivalShare);
  return rival ?? top;
}

/**
 * Dunkelt eine Farbe im gleichen Farbton und mit gleicher HSL-Sättigung ab (HSL-Helligkeit in 0,5-%-Schritten),
 * bis sie sich gegen Weiß mindestens im Verhältnis `printAccent.minContrast` abhebt (Schritt 7).
 */
export function darkenForPrint(hex: string): string {
  if (getContrastRatio(hex, PAPER_HEX) >= printAccent.minContrast) { return hex; }
  const start = hexToHsl(hex);
  const steps = Math.ceil(start.l / accentRules.darkenStepPercent);
  for (let step = 1; step <= steps; step++) {
    const candidate = hslToHex({ ...start, l: start.l - step * accentRules.darkenStepPercent });
    if (getContrastRatio(candidate, PAPER_HEX) >= printAccent.minContrast) { return candidate; }
  }
  return hslToHex({ ...start, l: 0 });
}

/**
 * Akzentfarbe (`#RRGGBB`, für den Druck schon abgedunkelt) aus den Pixeln des Turnierlogos. `undefined`, wenn das
 * Logo zu klein ist (kürzere Seite unter 64 Bildpunkten) oder keine brauchbare Farbe hat; dann gilt das Grün der App.
 * `original`: Maße des Originals für die Mindestgröße, wenn `image` schon verkleinert ist (sonst die Maße von `image`).
 */
export function accentFromPixels(image: PixelImage, original: { width: number; height: number } = image): string | undefined {
  if (Math.min(original.width, original.height) < accentRules.minSidePx) { return undefined; }
  const chosen = winner(candidatesOf(image));
  return chosen === undefined ? undefined : darkenForPrint(chosen.hex);
}

/** Die Akzentfarbe für den Druck: die berechnete, sonst das Grün der App (kein Logo, kein Gerätespeicher-Eintrag). */
export function accentOrFallback(accent: string | undefined): string {
  return accent ?? printAccent.fallback;
}

/**
 * Zebra-Ton: die Akzentfarbe mit Weiß gemischt, so hell wie möglich, aber mit höchstens `printAccent.zebraMaxGray`
 * Grauwert (mindestens 12 % Schwarz, @DR-001). Text bleibt schwarz.
 */
export function zebraTone(accent: string): string {
  const base = hexToRgb(accent);
  const paper = { r: PAPER_R, g: PAPER_G, b: PAPER_B };
  const mix = (share: number): string => rgbToHex({
    r: paper.r - (paper.r - base.r) * share,
    g: paper.g - (paper.g - base.g) * share,
    b: paper.b - (paper.b - base.b) * share,
  });
  const steps = Math.ceil((1 - accentRules.zebraStartShare) / accentRules.zebraStepShare);
  for (let i = 0; i < steps; i++) {
    const tone = mix(accentRules.zebraStartShare + i * accentRules.zebraStepShare);
    if (grayOf(tone) <= printAccent.zebraMaxGray) { return tone; }
  }
  return accent;
}
