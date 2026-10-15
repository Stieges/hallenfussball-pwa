/**
 * Seitenaufbau des Spielplan-PDFs am gerenderten Dokument (B-28a3-2, Spur C): pdfjs liest die Bytes über `pdfjsLayout`.
 * Nachweise: @DR-002 (feste Seiten, Folgeseite mit wiederholtem Spaltenkopf, leere Seiten entfallen, „Seite x von y“),
 * @DR-001 (Rand, nur Schwarz und Raster), @BM-017 (A4 hoch und quer).
 *
 * Fixtures: 12 Spiele = `hallencupSchedule()` (zwei Gruppen à vier Teams), 20 Spiele = zwei Gruppen à fünf Teams.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printColors, printLimits, printPage, printType } from '../../../design-tokens/print';
import type { Team } from '../../../types/tournament';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import { colorsUsed, readLayout, type LayoutPage } from './pdfjsLayout';
import { groupMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { translatorFor } from './pdfText';

const TOL = 0.05;
const SEITENZAHL = /^Seite \d+ von \d+$/;
/** Erlaubte Farben im Inhalt: Schwarz, Weiß und das 12-%-Raster (als hex). */
const ERLAUBT = ['#000000', '#ffffff', hex(printColors.tint)];

function hex(rgb: readonly number[]): string {
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Zehn Teams in zwei Gruppen à fünf: 20 Gruppenspiele. */
const ZEHN_TEAMS: Team[] = [
  'FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal', 'SC Hügel',
  'TSV West', 'SC Ost', 'FC Mitte', 'SV Hof', 'TuS Weit',
].map((name, i) => ({ id: `team-${i}`, name, group: i < 5 ? 'A' : 'B' }));

const zwanzig = () => generateFullSchedule(hallencupTournament({ teams: ZEHN_TEAMS, numberOfTeams: ZEHN_TEAMS.length }), 'de');

/** Seiten des fertigen PDFs, so wie `exportScheduleToPDF` sie speichern würde. */
async function layoutOf(options: PDFExportOptions = {}, schedule = hallencupSchedule()) {
  const { doc } = await buildSchedulePdf({
    schedule,
    standings: undefined,
    options: { locale: 'de', translate: translatorFor('de'), ...options },
  });
  const pages = await readLayout(new Uint8Array(doc.output('arraybuffer')));
  return { pages, width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
}

/** Alle Textstücke einer Seite, durch Leerzeichen verbunden. */
function pageText(page: LayoutPage): string {
  return page.texts.map(t => t.str).join(' ');
}

describe('@DR-002 Seitenaufbau: 12 Spiele passen auf drei Seiten in fester Reihenfolge', () => {
  it('Seite 1 Teilnehmer und Gruppenspiele, Seite 2 Tabellen, Seite 3 Finalrunde und Platzierung', async () => {
    expect(groupMatches(hallencupSchedule())).toHaveLength(12);
    const { pages } = await layoutOf();

    expect(pages).toHaveLength(3);
    expect(pageText(pages[0])).toContain('Teilnehmer');
    expect(pageText(pages[0])).toContain('Gruppenphase');
    expect(pageText(pages[0])).not.toContain('Tabelle – Gruppe A');
    expect(pageText(pages[1])).toContain('Tabelle – Gruppe A');
    expect(pageText(pages[1])).not.toContain('Platzierung');
    expect(pageText(pages[2])).toContain('Platzierung');
    expect(pageText(pages[2])).toContain('Spiel um Platz 3');
  });

  it('Gegenbeispiel: ohne Tabellen entfällt die Tabellenseite, die Platzierung bleibt auf Seite 2', async () => {
    const { pages } = await layoutOf({ includeStandings: false });

    expect(pages).toHaveLength(2);
    expect(pageText(pages[1])).toContain('Platzierung');
    expect(pages.flatMap(p => p.texts.map(t => t.str)).some(s => s.startsWith('Tabelle'))).toBe(false);
  });

  it('kein Abschnitt ohne Inhalt: jede Seite trägt mehr als die Seitenzahl', async () => {
    const { pages } = await layoutOf({ includeStandings: false });

    pages.forEach((page, i) => {
      const inhalt = page.texts.filter(t => !SEITENZAHL.test(t.str));
      expect(inhalt.length, `Seite ${i + 1}`).toBeGreaterThan(0);
    });
  });

  it('Turnier ohne Finalrunde: keine leere Seite, die Platzierung füllt die letzte Seite', async () => {
    const ohneFinale = generateFullSchedule(
      hallencupTournament({
        finalsConfig: { preset: 'none' },
        finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
      }),
      'de'
    );
    const { pages } = await layoutOf({}, ohneFinale);

    expect(pages).toHaveLength(3);
    pages.forEach((page, i) => {
      expect(page.texts.filter(t => !SEITENZAHL.test(t.str)).length, `Seite ${i + 1}`).toBeGreaterThan(0);
    });
    expect(pageText(pages[2])).toContain('Platzierung');
  });
});

describe('@DR-002 Folgeseite: 20 Spiele laufen auf eine Folgeseite mit Kurzkopf und Spaltenkopf', () => {
  it('vier Seiten: Seite 2 ist die Folgeseite, „Seite x von 4“ auf jeder', async () => {
    const schedule = zwanzig();
    expect(groupMatches(schedule)).toHaveLength(20);
    const { pages } = await layoutOf({}, schedule);

    expect(pages).toHaveLength(4);
    pages.forEach((page, i) => {
      expect(pageText(page), `Seite ${i + 1}`).toContain(`Seite ${i + 1} von 4`);
    });
  });

  it('Folgeseite: Kurzkopf mit dem Turniernamen, Spaltenkopf wiederholt, Spiele laufen weiter', async () => {
    const { pages } = await layoutOf({}, zwanzig());
    const folge = pages[1];

    const kurzkopf = folge.texts.find(t => t.str === 'Hallencup Nord');
    expect(kurzkopf, 'Kurzkopf').toBeDefined();
    expect(Math.abs((kurzkopf?.size ?? 0) - printType.titleShort)).toBeLessThanOrEqual(TOL);
    expect(folge.texts.some(t => t.str === 'Heim')).toBe(true);
    expect(folge.texts.some(t => t.str === 'Gast')).toBe(true);
    expect(folge.texts.some(t => t.str === '20')).toBe(true);
    expect(pageText(pages[0])).not.toContain('Tabelle – Gruppe A');
  });

  it('Gegenbeispiel: quer mit 5er-Gruppen bekommt eine Folgeseite mit Kurzkopf, Tabellen beginnen trotzdem neu', async () => {
    const { pages, width, height } = await layoutOf({ orientation: 'landscape' }, zwanzig());

    expect(width).toBeCloseTo(297, 1);
    expect(height).toBeCloseTo(210, 1);
    const folge = pages[1];
    expect(folge.texts.some(t => t.str === 'Hallencup Nord' && Math.abs(t.size - printType.titleShort) <= TOL)).toBe(true);
    expect(folge.texts.some(t => t.str === '20')).toBe(true);
    const tabellen = pages.findIndex(p => pageText(p).includes('Tabelle – Gruppe A'));
    expect(tabellen).toBeGreaterThan(1);
    expect(pages[tabellen].texts.some(t => t.str === '20')).toBe(false);
  });
});

describe('@DR-001 Rand, Farben und Raster', () => {
  it('Ränder im Token: alle Seitenränder mindestens printLimits.margin', () => {
    expect(printPage.margin.top).toBeGreaterThanOrEqual(printLimits.margin);
    expect(printPage.margin.right).toBeGreaterThanOrEqual(printLimits.margin);
    expect(printPage.margin.bottom).toBeGreaterThanOrEqual(printLimits.margin);
    expect(printPage.margin.left).toBeGreaterThanOrEqual(printLimits.margin);
  });

  it('kein Textstück und keine Linie näher als printLimits.margin am Rand (12 Spiele)', async () => {
    const { pages, width, height } = await layoutOf();
    const m = printLimits.margin;

    pages.forEach((page, i) => {
      page.texts.forEach(t => {
        expect(t.x, `Seite ${i + 1} „${t.str}“ links`).toBeGreaterThanOrEqual(m - TOL);
        expect(t.y, `Seite ${i + 1} „${t.str}“ oben`).toBeGreaterThanOrEqual(m - TOL);
        expect(t.y, `Seite ${i + 1} „${t.str}“ unten`).toBeLessThanOrEqual(height - m + TOL);
      });
      page.lines.forEach(l => {
        expect(Math.min(l.x1, l.x2), `Seite ${i + 1} Linie links`).toBeGreaterThanOrEqual(m - TOL);
        expect(Math.max(l.x1, l.x2), `Seite ${i + 1} Linie rechts`).toBeLessThanOrEqual(width - m + TOL);
      });
    });
  });

  it('Farben: im Inhalt nur Schwarz, Weiß und das Raster, kein Grau im Text', async () => {
    const { pages } = await layoutOf();

    pages.forEach((page, i) => {
      page.colors.forEach(c => expect(ERLAUBT, `Seite ${i + 1}`).toContain(c));
    });
  });

  it('Raster: Tabellenköpfe tragen 12 % Schwarz (#e0e0e0)', async () => {
    const { pages } = await layoutOf();

    expect(colorsUsed(pages[0])).toContain(hex(printColors.tint));
    expect(pages[0].rects.some(r => r.fill === hex(printColors.tint))).toBe(true);
  });
});

describe('Schriftgrößen aus den Tokens', () => {
  it('Uhrzeit und Ergebnis mit den Untergrenzen aus printLimits', async () => {
    const { pages } = await layoutOf();
    const zeiten = pages[0].texts.filter(t => /^\d{1,2}:\d{2}$/.test(t.str));

    expect(zeiten.length).toBeGreaterThan(0);
    zeiten.forEach(z => expect(Math.abs(z.size - printLimits.timePt)).toBeLessThanOrEqual(TOL));
    expect(printType.result).toBeGreaterThanOrEqual(printLimits.resultPt);
  });

  it('keine Schrift unter der Mindestgröße (Ausnahmen laut Liste ab 7,5 pt)', async () => {
    const { pages } = await layoutOf();

    pages.forEach((page, i) => {
      page.texts.forEach(t => expect(t.size, `Seite ${i + 1} „${t.str}“`).toBeGreaterThanOrEqual(printLimits.minFontPt - TOL));
    });
  });
});
