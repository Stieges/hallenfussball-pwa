/**
 * B-44a2/a3 Gestaltung der Live-Folie (Daniel: „der Kasten um das Ergebnis ist zu eng an der Zahl“).
 * @ZM-125 Stand ist das Größte, Luft im Kasten · @ZM-087 Namen · @ZM-137 Hinweise lesbar · @ZM-140 Kästen
 * Rechnet je Auflösung mit den echten Token-Werten (Layout-Rechnung, ohne Browser), mit seitlichem Polster der Folie.
 */
import { describe, it, expect } from 'vitest';
import { displayFontSizes, displayLayout } from '../../../design-tokens';
import { scoreDigitFontSize } from '../scoreDigitSize';
import { TEAM_NAME_ZEILENHOEHE } from '../teamNameFit';
import { RESOLUTIONS, resolveCss } from './cssResolve';

const L = displayLayout.scoreArea;

function metrics(w: number, h: number) {
  const ctx = { vw: w, vh: h };
  const paddingX = resolveCss(L.paddingX, ctx);
  // Raster: zwei gleiche Spalten ohne Trennbreite im Inneren der Folie (ohne seitliches Polster)
  const column = (w - 2 * paddingX) / 2;
  const boxW = resolveCss(L.blockWidth, { ...ctx, percentOf: column });
  const boxH = resolveCss(L.blockHeight, ctx);
  const digit = resolveCss(scoreDigitFontSize(), { ...ctx, cqw: boxW, cqh: boxH });
  const name = resolveCss(displayFontSizes.teamName, ctx);
  const nameKids = resolveCss(displayFontSizes.teamNameKids, ctx);
  const clock = resolveCss(displayFontSizes.clockXL, ctx);
  const hint = resolveCss(displayFontSizes.clockHint, ctx);
  return { ctx, boxW, boxH, digit, name, nameKids, clock, hint };
}

describe.each(RESOLUTIONS)('Verhältnisse bei $w x $h', ({ w, h }) => {
  const m = metrics(w, h);

  it('Kasten ca. 33 % der Bildbreite (mit Seitenpolster gerechnet) und annähernd quadratisch', () => {
    expect(m.boxW / w).toBeGreaterThanOrEqual(0.32);
    expect(m.boxW / w).toBeLessThanOrEqual(0.34);
    expect(m.boxH / m.boxW).toBeGreaterThanOrEqual(0.7);
    expect(m.boxH / m.boxW).toBeLessThanOrEqual(1.2);
  });

  it('Ziffern mindestens doppelt so groß wie die Teamnamen', () => {
    expect(m.digit).toBeGreaterThanOrEqual(2 * m.name);
  });

  it('Ziffern deutlich größer als die Uhr (mindestens 1,8 ×); Uhr mindestens 1,5 × Teamname', () => {
    expect(m.digit).toBeGreaterThanOrEqual(1.8 * m.clock);
    expect(m.clock).toBeGreaterThanOrEqual(1.5 * m.name);
  });

  it('Luft: Ziffernhöhe höchstens 60 % des Kastens, zweistellig seitlich ≥ halbe Ziffernbreite', () => {
    expect(m.digit).toBeLessThanOrEqual(0.6 * m.boxH);
    const digitWidth = 0.6 * m.digit;
    expect((m.boxW - 2 * digitWidth) / 2).toBeGreaterThanOrEqual(0.5 * digitWidth);
  });

  it('Kopfzeile, Marke, Namen und Hinweise mindestens 3 % der Bildhöhe (lesbar aus 10 m, auch bei 4K)', () => {
    for (const token of [displayFontSizes.liveInfo, displayFontSizes.liveBadge, displayFontSizes.clockHint, displayFontSizes.teamName]) {
      expect(resolveCss(token, m.ctx)).toBeGreaterThanOrEqual(0.03 * h);
    }
  });

  it('Namen im Kindermodus größer als sonst', () => {
    expect(m.nameKids).toBeGreaterThan(m.name);
  });

  it('keine festen Pixel-Deckel: Schriftgrößen der Folie wachsen mit der Bildhöhe', () => {
    for (const token of [displayFontSizes.liveInfo, displayFontSizes.liveBadge, displayFontSizes.clockXL, displayFontSizes.teamName]) {
      const share = resolveCss(token, m.ctx) / h;
      const small = resolveCss(token, { vw: 1280, vh: 720 }) / 720;
      expect(share).toBeCloseTo(small, 1);
    }
  });

  it('gesamte Folie passt in die Bildhöhe: Kopf, Kasten, Namen (2 Zeilen), unterer Bereich samt Schiedsrichter-Zeile, Polster', () => {
    const padding = resolveCss(L.paddingY, m.ctx);
    const header = (parseFloat(L.header) / 100) * h + resolveCss(L.headerGap, m.ctx);
    const names = L.nameLines * TEAM_NAME_ZEILENHOEHE * m.name + resolveCss(L.teamNamesGap, m.ctx);
    const lower = resolveCss(L.lowerHeight, m.ctx);
    expect(header + m.boxH + names + lower + 2 * padding).toBeLessThanOrEqual(h);
  });

  it('unterer Bereich fasst Uhr, Balken, Hinweiszeile und Schiedsrichter-Zeile', () => {
    const c = m.ctx;
    const rows = resolveCss(L.lowerPaddingTop, c)
      + m.clock * L.clockLineHeight + 2 * resolveCss(L.clockPadY, c)
      + resolveCss(L.clockGap, c) + resolveCss(L.progressHeight, c) + resolveCss(L.clockGap, c)
      + resolveCss(L.hintGapAbove, c) + m.hint * L.hintLineHeight
      + resolveCss(L.hintGapAbove, c) + m.hint * L.hintLineHeight;
    expect(rows).toBeLessThanOrEqual(resolveCss(L.lowerHeight, c));
  });

  it('Abstand zwischen Namen und Uhr vorhanden', () => {
    expect(resolveCss(L.lowerPaddingTop, m.ctx)).toBeGreaterThanOrEqual(0.015 * h);
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
