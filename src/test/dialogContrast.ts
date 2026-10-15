/**
 * Kontrast-Messung für gerenderte Dialoge (B-43b2, @OB-055).
 * Geht jeden Text im Panel durch und prüft ihn gegen die Fläche, auf der er liegt
 * (nächste eigene deckende Fläche aufwärts, sonst die Panel-Fläche). Alle Werte
 * werden aus global.css aufgelöst (hell/dunkel), nichts ist abgeschrieben.
 */
import { isOpaque, over, resolveToken, contrastRatio, MIN_TEXT_CONTRAST, MIN_UI_CONTRAST, type ThemeName } from './contrast';

/** WCAG 1.4.3 „large text“: 18 pt = 24 px, fett ab 14 pt ≈ 18,67 px. */
const LARGE_TEXT_PX = 24;
const LARGE_BOLD_TEXT_PX = 18.67;

/** Nächste Farbe/Fläche aus dem Inline-Stil, vom Element aufwärts bis zum Panel. */
function nearest(el: HTMLElement, root: HTMLElement, prop: 'color' | 'background'): string | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const value = prop === 'color' ? cur.style.color : (cur.style.background || cur.style.backgroundColor);
    if (value && value !== 'transparent' && value !== 'none') {return value;}
    if (cur === root) {break;}
    cur = cur.parentElement;
  }
  return null;
}

/** Schriftgröße in px aus dem Inline-Stil (px-Wert oder Token in rem, nächster Vorfahr), sonst 0. */
function pixelFontSize(theme: ThemeName, el: HTMLElement, root: HTMLElement): number {
  let cur: HTMLElement | null = el;
  while (cur) {
    const raw = cur.style.fontSize;
    if (raw) {
      let value = raw;
      try {
        value = resolveToken(theme, raw);
      } catch {
        // kein Token: Wert unverändert
      }
      const m = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(value.trim());
      if (m) {return Number(m[1]) * (m[2] === 'rem' ? 16 : 1);}
    }
    if (cur === root) {break;}
    cur = cur.parentElement;
  }
  return 0;
}

function isBold(el: HTMLElement, root: HTMLElement): boolean {
  let cur: HTMLElement | null = el;
  while (cur) {
    const w = cur.style.fontWeight;
    if (w) {return w === 'bold' || Number(w) >= 600;}
    if (cur === root) {break;}
    cur = cur.parentElement;
  }
  return false;
}

function opaqueOver(theme: ThemeName, value: string, under: string): string | null {
  try {
    const resolved = resolveToken(theme, value);
    return isOpaque(resolved) ? resolved : over(resolved, under);
  } catch {
    return null; // Verlauf o. Ä.: nicht als Farbe auflösbar
  }
}

export interface ContrastReport {
  geprueft: number;
  zuSchwach: string[];
}

export function measurePanelContrast(theme: ThemeName, panel: HTMLElement): ContrastReport {
  const panelSurface = resolveToken(theme, 'var(--color-surface-elevated)');
  let geprueft = 0;
  const zuSchwach: string[] = [];
  panel.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.tagName === 'STYLE') {return;}
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
    );
    if (!hasOwnText) {return;}
    const color = nearest(el, panel, 'color');
    if (color === null) {return;}
    const bgValue = nearest(el, panel, 'background');
    const bg = bgValue === null ? panelSurface : opaqueOver(theme, bgValue, panelSurface);
    if (bg === null) {return;}
    const ratio = contrastRatio(resolveToken(theme, color), bg);
    // Reine Symbole: 3 : 1 (WCAG 1.4.11); großer Text ab 24 px: 3 : 1 (WCAG 1.4.3); sonst 4,5 : 1.
    const isSymbol = !/[\p{L}\p{N}]/u.test(el.textContent ?? '');
    const size = pixelFontSize(theme, el, panel);
    const isLarge = size >= LARGE_TEXT_PX || (size >= LARGE_BOLD_TEXT_PX && isBold(el, panel));
    const min = isSymbol || isLarge ? MIN_UI_CONTRAST : MIN_TEXT_CONTRAST;
    if (ratio < min) {
      zuSchwach.push(`${el.tagName} „${el.textContent?.trim()}“ ${ratio.toFixed(2)} : 1 (Farbe ${color})`);
    }
    geprueft += 1;
  });
  return { geprueft, zuSchwach };
}
