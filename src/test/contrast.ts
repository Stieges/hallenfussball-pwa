/**
 * WCAG-Kontrast-Helfer für Tests (@OB-055).
 *
 * Liest die Token-Werte direkt aus `src/styles/global.css` (nicht abgeschrieben),
 * löst `var(--…)`-Verweise auf und rechnet das Kontrastverhältnis nach WCAG 2.x.
 *
 * Theme-Auflösung wie im Browser: `:root` ist das dunkle Theme; `[data-theme="light"]`
 * und `[data-theme="high-contrast"]` überschreiben einzelne Variablen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type ThemeName = 'dark' | 'light' | 'high-contrast';

/** WCAG AA: Fließtext. */
export const MIN_TEXT_CONTRAST = 4.5;
/** WCAG AA: große Schrift und Bedienelemente (Knopfgrenzen, Eingabefelder). */
export const MIN_UI_CONTRAST = 3;

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Vitest läuft aus dem Projektwurzelverzeichnis; jsdom liefert keine file:-URL. */
const GLOBAL_CSS = resolve(process.cwd(), 'src/styles/global.css');

/** Parst `#RGB`, `#RRGGBB`, `rgb(...)` und `rgba(...)`. Wirft bei anderen Formaten. */
export function parseColor(value: string): Rgba {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  throw new Error(`Unbekanntes Farbformat: "${value}"`);
}

/** Deckend = Alpha 1. Durchsichtige Werte (z. B. rgba(…, 0.08)) sind NICHT deckend. */
export function isOpaque(value: string): boolean {
  return parseColor(value).a === 1;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(value: string): number {
  const { r, g, b } = parseColor(value);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Mischt eine (ggf. halbdurchsichtige) Farbe über einen deckenden Untergrund und
 * liefert eine deckende rgb()-Farbe. Der Untergrund muss deckend sein.
 */
export function over(top: string, under: string): string {
  const t = parseColor(top);
  const u = parseColor(under);
  if (u.a !== 1) {throw new Error(`Untergrund muss deckend sein: "${under}"`);}
  const mix = (x: number, y: number) => Math.round(t.a * x + (1 - t.a) * y);
  return `rgb(${mix(t.r, u.r)}, ${mix(t.g, u.g)}, ${mix(t.b, u.b)})`;
}

/**
 * WCAG-Kontrastverhältnis (1 … 21). Die Deckkraft der Schrift wird über den
 * Hintergrund gemischt; der Hintergrund muss deckend sein (sonst vorher `over`).
 */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground).a === 1 ? foreground : over(foreground, background);
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(background);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** true, wenn das Verhältnis mindestens `min` erreicht (Standard: Fließtext 4,5 : 1). */
export function meetsContrast(
  foreground: string,
  background: string,
  min: number = MIN_TEXT_CONTRAST,
): boolean {
  return contrastRatio(foreground, background) >= min;
}

function blockBody(css: string, selectorLine: RegExp): string {
  const match = selectorLine.exec(css);
  if (!match) {
    throw new Error(`Block nicht gefunden: ${selectorLine}`);
  }
  let depth = 0;
  const start = match.index + match[0].length - 1; // Position von "{"
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === '{') {depth += 1;}
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {return css.slice(start + 1, i);}
    }
  }
  throw new Error(`Block ohne Schluss: ${selectorLine}`);
}

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

let cachedCss: string | null = null;
function globalCss(): string {
  cachedCss ??= readFileSync(GLOBAL_CSS, 'utf8');
  return cachedCss;
}

/**
 * Alle CSS-Variablen eines Themes, wie sie im Browser gelten:
 * Basis `:root` (dunkel), darüber das Override-Block des Themes.
 */
export function readThemeTokens(theme: ThemeName): Record<string, string> {
  const css = globalCss();
  const base = declarations(blockBody(css, /^:root\s*\{/m));
  if (theme === 'dark') {return base;}
  const selector =
    theme === 'light' ? /^\[data-theme="light"\]\s*\{/m : /^\[data-theme="high-contrast"\]\s*\{/m;
  return { ...base, ...declarations(blockBody(css, selector)) };
}

/** Löst `var(--name)` über das Theme auf (mehrstufig, max. 5 Schritte). */
export function resolveToken(theme: ThemeName, value: string): string {
  const tokens = readThemeTokens(theme);
  let current = value.trim();
  for (let i = 0; i < 5; i += 1) {
    const ref = /^var\((--[\w-]+)\)$/.exec(current);
    if (!ref) {return current;}
    const next = tokens[ref[1]];
    if (next === undefined) {throw new Error(`Token ${ref[1]} fehlt im Theme ${theme}`);}
    current = next;
  }
  throw new Error(`Zyklischer Token-Verweis: ${value}`);
}
