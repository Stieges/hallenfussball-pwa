/**
 * B-44a2 Gestaltung nach Sichtprüfung (Daniel: „der Kasten um das Ergebnis ist zu eng an der Zahl“).
 * @ZM-125 Stand ist das Größte, Luft im Kasten · @ZM-087 Namen · @ZM-137 Hinweise lesbar · @ZM-140 Kästen
 * Rechnet je Auflösung mit den echten Token-Werten (Layout-Rechnung, ohne Browser).
 */
import { describe, it, expect } from 'vitest';
import { displayFontSizes, displayLayout } from '../../../design-tokens';
import { scoreDigitFontSize } from '../scoreDigitSize';
import { RESOLUTIONS, resolveCss } from './cssResolve';

const L = displayLayout.scoreArea;

function metrics(w: number, h: number) {
  const ctx = { vw: w, vh: h };
  const column = w / 2;
  const boxW = (parseFloat(L.blockWidth) / 100) * column;
  const boxH = resolveCss(L.blockHeight, ctx);
  const digit = resolveCss(scoreDigitFontSize(), { ...ctx, cqw: boxW, cqh: boxH });
  const name = resolveCss(displayFontSizes.teamName, ctx);
  const clock = resolveCss(displayFontSizes.clockXL, ctx);
  const hint = resolveCss(displayFontSizes.clockHint, ctx);
  return { ctx, boxW, boxH, digit, name, clock, hint };
}

describe.each(RESOLUTIONS)('Verhältnisse bei $w x $h', ({ w, h }) => {
  const m = metrics(w, h);

  it('Kasten ca. 33 % der Bildbreite und annähernd quadratisch (Höhe ≥ 70 % der Breite)', () => {
    expect(m.boxW / w).toBeCloseTo(0.33, 2);
    expect(m.boxH / m.boxW).toBeGreaterThanOrEqual(0.7);
    expect(m.boxH / m.boxW).toBeLessThanOrEqual(1.2);
  });

  it('Ziffern mindestens doppelt so groß wie die Teamnamen', () => {
    expect(m.digit).toBeGreaterThanOrEqual(2 * m.name);
  });

  it('Ziffern deutlich größer als die Uhr (mindestens 1,8 ×)', () => {
    expect(m.digit).toBeGreaterThanOrEqual(1.8 * m.clock);
  });

  it('Luft: Ziffernhöhe höchstens 60 % des Kastens, zweistellig seitlich ≥ halbe Ziffernbreite', () => {
    expect(m.digit).toBeLessThanOrEqual(0.6 * m.boxH);
    const digitWidth = 0.6 * m.digit;
    expect((m.boxW - 2 * digitWidth) / 2).toBeGreaterThanOrEqual(0.5 * digitWidth);
  });

  it('Hinweistexte mindestens 3 % der Bildhöhe', () => {
    expect(m.hint).toBeGreaterThanOrEqual(0.03 * h);
  });

  it('Namenszeilen und Kasten passen mit Uhr-Bereich in die Bildhöhe (ohne Abschneiden)', () => {
    const padding = resolveCss(L.paddingY, m.ctx);
    const header = (parseFloat(L.header) / 100) * h;
    const names = L.nameLines * 1.2 * m.name;
    const lower = resolveCss(L.lowerHeight, m.ctx);
    const headerGap = resolveCss(L.headerGap, m.ctx);
    expect(header + headerGap + m.boxH + names + lower + 2 * padding).toBeLessThanOrEqual(h);
  });

  it('Abstand zwischen Namen und Uhr vorhanden (liegt im unteren Bereich)', () => {
    expect(resolveCss(L.lowerPaddingTop, m.ctx)).toBeGreaterThanOrEqual(0.015 * h);
    expect(resolveCss(L.lowerPaddingTop, m.ctx)).toBeLessThan(resolveCss(L.lowerHeight, m.ctx));
  });

  it('Hinweis-Abstand zur Uhr vorhanden', () => {
    expect(resolveCss(L.hintGapAbove, m.ctx)).toBeGreaterThanOrEqual(0.015 * h);
  });
});

describe('Namenbreite', () => {
  it('Namensspalte höchstens so breit wie der Kasten (Gegenbeispiel: nicht 92 %)', () => {
    expect(parseFloat(L.teamNameWidth)).toBeLessThanOrEqual(parseFloat(L.blockWidth));
  });
  it('Umbruch bis zu 2 Zeilen', () => {
    expect(L.nameLines).toBe(2);
  });
});
