/**
 * Ränder, Farben, Raster und Schriftgrößen am gerenderten Dokument (B-28a3-2 Fixrunde, Spur C). Über `pdfjsLayout`,
 * alle Pflicht-Fixtures (12 und 20 Spiele, hoch und quer, inklusive Folgeseite).
 * Nachweise: @DR-001 (Rand mindestens 12 mm, Raster mindestens 12 % Schwarz, nur Schwarz, Weiß und Raster, Mindestschrift),
 * Plan a3-2 (M1 Tabellen-Unterrand, M2 gleiche Teamgröße hoch und quer, K1 Schriftgrößen aus den Tokens).
 *
 * Die Oberkante einer Zeile ist Grundlinie − Schriftgröße × Ascent der Schrift. Der Ascent wird aus der eingebetteten
 * Schriftdatei gelesen (`pdfFontMetrics`), nicht aus dem Token; fett erkennt `fettKennung` an der Schriftkennung (`LayoutText.bold` trifft die eingebettete Schrift nie); das Token `printFont.ascentEm` wird dagegen geprüft.
 */
import { describe, expect, it } from 'vitest';
import { continuationTop, pageGeometry, tableMargins } from '../layout';
import { matchTableOptions } from '../render/matchTables';
import { printColors, printFont, printLimits, printType, printUnit } from '../../../design-tokens/print';
import { FIXTURES, layoutOf, zwanzigSchedule } from './pdfFixtureLayout';
import { ASCENT_BOLD_EM, ASCENT_REGULAR_EM } from './pdfFontMetrics';
import { hallencupSchedule } from './pdfFixture';
import type { LayoutPage, LayoutText } from './pdfjsLayout';
import { fettKennung } from './pdfScoreSupport';

const TOL = 0.05;
const WEISS = '#ffffff';
const SCHWARZ = '#000000';
/** Toleranz in Prozentpunkten, die `grayTolerance` Graustufen entsprechen. */
const TOL_PROZENT = (printLimits.grayTolerance / printColors.paper[0]) * 100;

/** Oberkante eines Textstücks in mm: Grundlinie minus Oberlänge. */
const oberkante = (t: LayoutText, fett: string | undefined): number =>
  t.y - t.size * (t.font === fett ? ASCENT_BOLD_EM : ASCENT_REGULAR_EM) * printUnit.mmPerPt;

/** Schwarzanteil einer Graustufe in Prozent: 0 = Weiß, 100 = Schwarz. */
function schwarzProzent(hex: string): number {
  const grau = Number.parseInt(hex.slice(1, 3), 16);
  return ((printColors.paper[0] - grau) / printColors.paper[0]) * 100;
}

const istBlackOderWhite = (hex: string): boolean => hex === SCHWARZ || hex === WEISS;

/** Textstücke der Spieltabellen: Teamnamen unterhalb des Titels „Gruppenphase“, ohne Tabellenseiten (dort Tabellenschrift). */
function teamTexts(pages: LayoutPage[], namen: string[]): LayoutText[] {
  return pages
    .filter(page => !page.texts.some(t => t.str.startsWith('Tabelle') || (t.str === 'Platzierung' && Math.abs(t.size - printType.h2) < 0.05)))
    .flatMap(page => {
      const titel = page.texts.find(t => t.str === 'Gruppenphase');
      return page.texts.filter(t => namen.includes(t.str) && (!titel || t.y > titel.y));
    });
}

describe('C1-F fett über die Schriftkennung', () => {
  it('die Spaltenköpfe tragen die fette Kennung, Teamnamen eine andere; LayoutText.bold bleibt für die eingebettete Schrift falsch', async () => {
    const { pages } = await layoutOf({}, hallencupSchedule());
    const fett = fettKennung(pages);
    const texte = pages.flatMap(page => page.texts);

    expect(fett).toBeDefined();
    expect(texte.find(t => t.str === 'FC Nord')?.font).not.toBe(fett);
    expect(texte.filter(t => t.font === fett).some(t => t.bold)).toBe(false);
  });
});

describe.each(FIXTURES)('@DR-001 Rand: $name', ({ options, schedule }) => {
  it('oben: jede Oberkante liegt auf oder unter geo.top, auf allen Seiten', async () => {
    const { pages } = await layoutOf(options, schedule());
    const oben = pageGeometry('a4', options.orientation ?? 'portrait').top;

    pages.forEach((page, i) => {
      page.texts.forEach(t => expect(oberkante(t, fettKennung(pages)), `Seite ${i + 1} „${t.str}“ oben`).toBeGreaterThanOrEqual(oben - TOL));
    });
  });

  it('unten: Grundlinien und Linien liegen oberhalb von H − printLimits.margin, die Seitenzahl auf H − margin', async () => {
    const { pages, height } = await layoutOf(options, schedule());
    const unten = height - printLimits.margin;

    pages.forEach((page, i) => {
      page.texts.forEach(t => expect(t.y, `Seite ${i + 1} „${t.str}“ unten`).toBeLessThanOrEqual(unten + TOL));
      page.lines.forEach(l => expect(Math.max(l.y1, l.y2), `Seite ${i + 1} Linie unten`).toBeLessThanOrEqual(unten + TOL));
    });
  });

  it('links und rechts: Text und Linien mindestens printLimits.margin vom Blattrand', async () => {
    const { pages, width } = await layoutOf(options, schedule());
    const m = printLimits.margin;

    pages.forEach((page, i) => {
      page.texts.forEach(t => expect(t.x, `Seite ${i + 1} „${t.str}“ links`).toBeGreaterThanOrEqual(m - TOL));
      page.lines.forEach(l => {
        expect(Math.min(l.x1, l.x2), `Seite ${i + 1} Linie links`).toBeGreaterThanOrEqual(m - TOL);
        expect(Math.max(l.x1, l.x2), `Seite ${i + 1} Linie rechts`).toBeLessThanOrEqual(width - m + TOL);
      });
    });
  });

  it('M1 Tabellen: kein Tabelleninhalt unterhalb der Satzspiegel-Unterkante, darunter nur die Fußzeile mit ihrer Linie', async () => {
    const { pages } = await layoutOf(options, schedule());
    const { bottom, footRuleY } = pageGeometry('a4', options.orientation ?? 'portrait');

    pages.forEach((page, i) => {
      const fuss = page.texts.filter(t => t.y > footRuleY);
      expect(fuss.map(t => t.str).join(' '), `Seite ${i + 1} Fußzeile`).toMatch(/Seite \d+ von \d+/);
      page.texts.filter(t => !fuss.includes(t)).forEach(t =>
        expect(t.y, `Seite ${i + 1} „${t.str}“`).toBeLessThanOrEqual(bottom + TOL));
      page.rects.forEach(r => expect(r.y + r.h, `Seite ${i + 1} Füllung`).toBeLessThanOrEqual(bottom + TOL));
      page.lines.filter(l => Math.abs(l.y1 - footRuleY) > TOL).forEach(l =>
        expect(Math.max(l.y1, l.y2), `Seite ${i + 1} Linie`).toBeLessThanOrEqual(bottom + TOL));
    });
  });

  it('Farben: im Inhalt nur Schwarz, Weiß und das Raster, kein Grau im Text', async () => {
    const { pages } = await layoutOf(options, schedule());

    pages.forEach((page, i) => {
      const raster = new Set(page.rects.map(r => r.fill).filter((f): f is string => Boolean(f) && !istBlackOderWhite(f ?? '')));
      page.colors.forEach(c => expect(istBlackOderWhite(c) || raster.has(c), `Seite ${i + 1} Farbe ${c}`).toBe(true));
    });
  });

  it('Raster: die Tabellenkopf-Füllung hat mindestens printLimits.tintMinPercent Schwarz und ist nie Weiß', async () => {
    const { pages } = await layoutOf(options, schedule());
    const raster = pages[0].rects.filter(r => r.fill !== undefined && !istBlackOderWhite(r.fill));

    expect(raster.length, 'Tabellenkopf-Füllung').toBeGreaterThan(0);
    raster.forEach(r => {
      expect(r.fill).not.toBe(WEISS);
      expect(schwarzProzent(r.fill ?? WEISS), `Füllung ${r.fill}`).toBeGreaterThanOrEqual(printLimits.tintMinPercent - TOL_PROZENT);
    });
  });

  it('keine Schrift unter printLimits.minFontPt auf allen Seiten', async () => {
    const { pages } = await layoutOf(options, schedule());

    pages.forEach((page, i) => {
      page.texts.forEach(t => expect(t.size, `Seite ${i + 1} „${t.str}“`).toBeGreaterThanOrEqual(printLimits.minFontPt - TOL));
    });
  });

  it('Teamnamen der Spieltabellen mindestens printLimits.teamPt', async () => {
    const fixture = schedule();
    const { pages } = await layoutOf(options, fixture);
    const namen = teamTexts(pages, fixture.teams.map(t => t.name));

    expect(namen.length).toBeGreaterThan(0);
    namen.forEach(t => expect(t.size, `„${t.str}“`).toBeGreaterThanOrEqual(printLimits.teamPt - TOL));
  });
});

describe('Ascent-Token gegen die Schriftdatei (Gleichheit, nicht Zirkel)', () => {
  it('printFont.ascentEm entspricht dem hhea-Ascender von Regular und Bold (Toleranz 0,001)', () => {
    expect(Math.abs(printFont.ascentEm - ASCENT_REGULAR_EM)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(printFont.ascentEm - ASCENT_BOLD_EM)).toBeLessThanOrEqual(0.001);
  });
});

describe('M1 Tabellen-Unterrand als Wert (autoTable-Vorgabe 14,1 mm reicht in die Zone unter geo.bottom)', () => {
  it('Spieltabellen und Gruppentabellen setzen margin.bottom = Höhe − geo.bottom, oben die Vorgabe', () => {
    const geo = pageGeometry('a4', 'portrait');
    const unten = geo.height - geo.bottom;

    // Oben: Folgeseiten beginnen unter dem Kurzkopf (B-28a3-3b, K3)
    expect(matchTableOptions(geo, 30, [], [], {}).margin).toEqual({ left: geo.left, right: geo.right, top: continuationTop(geo), bottom: unten });
    expect(tableMargins(geo, 30).bottom).toBe(unten);
    expect(tableMargins(geo, 30).top).toBe(continuationTop(geo));
  });
});

describe('Schriftgrößen aus den Tokens (K1)', () => {
  it('jeder printType-Wert liegt mindestens auf printLimits.minFontPt', () => {
    Object.entries(printType).forEach(([name, pt]) => expect(pt, name).toBeGreaterThanOrEqual(printLimits.minFontPt));
  });

  it('Uhrzeit und Ergebnis mit den Untergrenzen aus printLimits', async () => {
    const { pages } = await layoutOf();
    const zeiten = pages[0].texts.filter(t => /^\d{1,2}:\d{2}$/.test(t.str));

    expect(zeiten.length).toBeGreaterThan(0);
    zeiten.forEach(z => expect(Math.abs(z.size - printLimits.timePt)).toBeLessThanOrEqual(TOL));
    expect(printType.result).toBeGreaterThanOrEqual(printLimits.resultPt);
  });

  it.each([
    ['12 Spiele', hallencupSchedule],
    ['20 Spiele', zwanzigSchedule],
  ])('Teamnamen hoch und quer gleich groß (M2): %s', async (_name, plan) => {
    const namen = plan().teams.map(t => t.name);
    const hoch = await layoutOf({}, plan());
    const quer = await layoutOf({ orientation: 'landscape' }, plan());
    const groessen = (pages: LayoutPage[]) => new Set(teamTexts(pages, namen).map(t => t.size.toFixed(2)));

    expect(groessen(hoch.pages).size).toBeGreaterThan(0);
    expect(groessen(quer.pages)).toEqual(groessen(hoch.pages));
  });
});
