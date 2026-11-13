/**
 * Kontrast eines Textes im Browser messen (WCAG 2.2, 1.4.3): Schriftfarbe gegen die tatsächlich sichtbare Fläche dahinter (halbtransparente Flächen der
 * Vorfahren werden von außen nach innen übereinandergelegt). Für die Einzelwerte in den Sichtmängel-Spezifikationen (@ZM-205, @ZM-206); die Gesamtprüfung
 * einer Fläche macht axe (`color-contrast`).
 */
import type { Locator } from '@playwright/test';

export async function kontrastVon(ziel: Locator): Promise<number> {
  return ziel.evaluate((el) => {
    type Rgba = [number, number, number, number];
    const lies = (wert: string): Rgba => {
      const m = wert.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m.length > 3 ? m[3] : 1];
    };
    const ueber = (v: Rgba, h: Rgba): Rgba => {
      const a = v[3] + h[3] * (1 - v[3]);
      return a === 0 ? [0, 0, 0, 0] : [0, 1, 2].map((i) => (v[i] * v[3] + h[i] * h[3] * (1 - v[3])) / a).concat(a) as Rgba;
    };
    const luminanz = (c: Rgba): number => {
      const [r, g, b] = c.slice(0, 3).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const flaechen: Rgba[] = [];
    for (let e: Element | null = el; e !== null; e = e.parentElement) { flaechen.push(lies(getComputedStyle(e).backgroundColor)); }
    let grund: Rgba = [255, 255, 255, 1];
    for (let i = flaechen.length - 1; i >= 0; i--) { grund = ueber(flaechen[i], grund); }
    const schrift = ueber(lies(getComputedStyle(el).color), grund);
    const [hell, dunkel] = [luminanz(schrift), luminanz(grund)].sort((a, b) => b - a);
    return (hell + 0.05) / (dunkel + 0.05);
  });
}
