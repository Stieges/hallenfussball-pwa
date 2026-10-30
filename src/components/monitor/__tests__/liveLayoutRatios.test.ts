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

/** B-44a4 (@ME-020): Die Folie misst an ihrer Fläche innerhalb des Bildrands (Container-Einheiten). */
function metrics(w: number, h: number, rand = 0) {
  const ctx = { vw: w, vh: h, cqw: w - 2 * rand, cqh: h - 2 * rand };
  const paddingX = resolveCss(L.paddingX, ctx);
  // Raster: zwei gleiche Spalten ohne Trennbreite im Inneren der Folie (ohne seitliches Polster)
  const column = (ctx.cqw - 2 * paddingX) / 2;
  const boxW = resolveCss(L.blockWidth, { ...ctx, percentOf: column });
  const boxH = resolveCss(L.blockHeight, ctx);
  const digit = resolveCss(scoreDigitFontSize(), { ...ctx, cqw: boxW, cqh: boxH });
  const name = resolveCss(displayFontSizes.teamName, ctx);
  const nameKids = resolveCss(displayFontSizes.teamNameKids, ctx);
  const clock = resolveCss(displayFontSizes.clockXL, ctx);
  const hint = resolveCss(displayFontSizes.clockHint, ctx);
  return { ctx, boxW, boxH, digit, name, nameKids, clock, hint };
}

describe.each(RESOLUTIONS.flatMap(r => [0, 48].map(rand => ({ ...r, rand }))))('Verhältnisse bei $w x $h, Bildrand $rand px', ({ w, h, rand }) => {
  const m = metrics(w, h, rand);
  const flaecheW = m.ctx.cqw;
  const flaecheH = m.ctx.cqh;

  it('Kasten ca. 33 % der Folienbreite (mit Seitenpolster gerechnet) und annähernd quadratisch', () => {
    expect(m.boxW / flaecheW).toBeGreaterThanOrEqual(0.32);
    expect(m.boxW / flaecheW).toBeLessThanOrEqual(0.34);
    // Mit Bildrand ist die Fläche verhältnismäßig breiter (z. B. 1184×624 statt 1280×720), der Kasten wird etwas flacher (B-44a4)
    expect(m.boxH / m.boxW).toBeGreaterThanOrEqual(rand === 0 ? 0.7 : 0.65);
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

  it('Kopfzeile, Marke und Hinweise mindestens 3 % der Bildschirmhöhe, auch mit Bildrand (@ZM-125, Ruling B-44a4)', () => {
    for (const token of [displayFontSizes.liveInfo, displayFontSizes.liveBadge, displayFontSizes.clockHint]) {
      expect(resolveCss(token, m.ctx)).toBeGreaterThanOrEqual(0.03 * h - 0.01);
    }
  });

  it('Vorgabe der Teamnamen mindestens 3 % der Bildschirmhöhe (darunter bricht der Name um statt zu schrumpfen)', () => {
    expect(m.name).toBeGreaterThanOrEqual(0.03 * h);
  });

  it('Namen im Kindermodus größer als sonst', () => {
    expect(m.nameKids).toBeGreaterThan(m.name);
  });

  it('keine festen Pixel-Deckel: Schriftgrößen der Folie wachsen mit der Bildhöhe', () => {
    for (const token of [displayFontSizes.liveInfo, displayFontSizes.liveBadge, displayFontSizes.clockXL, displayFontSizes.teamName]) {
      const share = resolveCss(token, m.ctx) / h;
      const small = resolveCss(token, { vw: 1280, vh: 720, cqw: 1280 - 2 * rand, cqh: 720 - 2 * rand }) / 720;
      expect(share).toBeCloseTo(small, 1);
    }
  });

  it('gesamte Folie passt in die Folienfläche innerhalb des Bildrands (@ME-020): Kopf, Kasten, Namen (2 Zeilen), unterer Bereich, Polster', () => {
    const padding = resolveCss(L.paddingY, m.ctx);
    const header = (parseFloat(L.header) / 100) * flaecheH + resolveCss(L.headerGap, m.ctx);
    const names = L.nameLines * TEAM_NAME_ZEILENHOEHE * m.name + resolveCss(L.teamNamesGap, m.ctx);
    const lower = resolveCss(L.lowerHeight, m.ctx);
    expect(header + m.boxH + names + lower + 2 * padding).toBeLessThanOrEqual(flaecheH);
  });

  // R5 PR 2 (@ZM-166, @ZM-165): der Text steht ÜBER der Uhr (eine Zeile statt Hinweiszeile darunter), der Balken ist etwa
  // 3 % der Bildhöhe hoch. Aufbau: Polster · Zeile über der Uhr · Abstand · Uhr · Abstand · Balken · Abstand · Schiedsrichter-Zeile.
  it('unterer Bereich fasst Text über der Uhr, Uhr, Balken und Schiedsrichter-Zeile', () => {
    const c = m.ctx;
    const rows = resolveCss(L.lowerPaddingTop, c)
      + m.hint * L.hintLineHeight + resolveCss(L.clockGap, c)
      + m.clock * L.clockLineHeight + 2 * resolveCss(L.clockPadY, c)
      + resolveCss(L.clockGap, c) + resolveCss(L.progressHeight, c)
      + resolveCss(L.hintGapAbove, c) + m.hint * L.hintLineHeight;
    expect(rows).toBeLessThanOrEqual(resolveCss(L.lowerHeight, c));
  });

  it('@ZM-165 Zeitbalken etwa 3 % der Bildhöhe (mindestens 2,5 %, höchstens 3,5 % der Folienfläche)', () => {
    const balken = resolveCss(L.progressHeight, m.ctx);
    expect(balken).toBeGreaterThanOrEqual(0.025 * flaecheH);
    expect(balken).toBeLessThanOrEqual(0.035 * flaecheH);
  });

  it('Abstand zwischen Namen und Uhr vorhanden', () => {
    expect(resolveCss(L.lowerPaddingTop, m.ctx)).toBeGreaterThanOrEqual(0.015 * flaecheH);
  });
});

describe('Namenbreite', () => {
  // B-44a4 (Ruling 16.10., @ZM-087): wieder breiter als der Kasten (B-44a2 hatte Kastenbreite)
  it('Namensspalte breiter als der Kasten', () => {
    expect(parseFloat(L.teamNameWidth)).toBeGreaterThan(parseFloat(L.blockWidth));
  });

  it('Größen der Live-Folie hängen an der Folienfläche (Container-Einheiten), nicht am Fenster (@ME-020)', () => {
    for (const [name, wert] of Object.entries(L)) {
      if (typeof wert === 'string') { expect(wert, name).not.toMatch(/\d(vh|vw)$/); }
    }
    for (const token of [displayFontSizes.clockXL, displayFontSizes.teamName, displayFontSizes.teamNameKids, displayFontSizes.liveSeparator]) {
      expect(token).toMatch(/cqh$/);
    }
  });
  it('Umbruch bis zu 2 Zeilen', () => {
    expect(L.nameLines).toBe(2);
  });
});
