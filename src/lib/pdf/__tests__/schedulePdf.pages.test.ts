/**
 * Seitenaufbau des Spielplan-PDFs am gerenderten Dokument (B-28a3-2, Spur C): pdfjs liest die Bytes über `pdfjsLayout`.
 * Nachweise: @DR-002 (feste Seiten, Folgeseite mit wiederholtem Spaltenkopf, leere Seiten entfallen, „Seite x von y“).
 * Ränder, Farben, Raster und Schriftgrößen stehen in `schedulePdf.rand.test.ts`.
 *
 * Fixtures: 12 Spiele = `hallencupSchedule()` (zwei Gruppen à vier Teams), 20 Spiele = zwei Gruppen à fünf Teams.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printColumns, printType } from '../../../design-tokens/print';
import { pageGeometry } from '../layout';
import { groupMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf, pageText, zwanzigSchedule } from './pdfFixtureLayout';
import type { LayoutPage } from './pdfjsLayout';

const TOL = 0.05;
const SEITENZAHL = /^Seite \d+ von \d+$/;

/** Spielnummern einer Seite: Ziffern in der Spalte ganz links (Nr.), nicht Feld oder Gruppe. */
function spielnummern(page: LayoutPage): number[] {
  const { left } = pageGeometry('a4', 'portrait');
  return page.texts
    .filter(t => /^\d{1,2}$/.test(t.str) && t.x < left + printColumns.match.nr)
    .map(t => Number(t.str));
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
    const schedule = zwanzigSchedule();
    expect(groupMatches(schedule)).toHaveLength(20);
    const { pages } = await layoutOf({}, schedule);

    expect(pages).toHaveLength(4);
    pages.forEach((page, i) => {
      expect(pageText(page), `Seite ${i + 1}`).toContain(`Seite ${i + 1} von 4`);
    });
  });

  it('Folgeseite: Kurzkopf mit dem Turniernamen, Spaltenkopf wiederholt, Spiele laufen weiter', async () => {
    const { pages } = await layoutOf({}, zwanzigSchedule());
    const folge = pages[1];

    const kurzkopf = folge.texts.find(t => t.str === 'Hallencup Nord');
    expect(kurzkopf, 'Kurzkopf').toBeDefined();
    expect(Math.abs((kurzkopf?.size ?? 0) - printType.titleShort)).toBeLessThanOrEqual(TOL);
    expect(folge.texts.some(t => t.str === 'Heim')).toBe(true);
    expect(folge.texts.some(t => t.str === 'Gast')).toBe(true);
    expect(folge.texts.some(t => t.str === '20')).toBe(true);
    expect(pageText(pages[0])).not.toContain('Tabelle – Gruppe A');
  });

  it('Spielnummern: lückenlos und ohne Doppel über Seite 1 und Folgeseite (Seite 1: 1–17, Folgeseite: 18–20)', async () => {
    const { pages } = await layoutOf({}, zwanzigSchedule());

    expect(spielnummern(pages[0])).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(spielnummern(pages[1])).toEqual([18, 19, 20]);
  });

  it('Gegenbeispiel: quer mit 5er-Gruppen bekommt eine Folgeseite mit Kurzkopf, Tabellen beginnen trotzdem neu', async () => {
    const { pages, width, height } = await layoutOf({ orientation: 'landscape' }, zwanzigSchedule());

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
