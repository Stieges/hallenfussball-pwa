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
import { dreissigSchedule, layoutOf, pageText, zwanzigSchedule } from './pdfFixtureLayout';
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
  it('Seite 1 Teilnehmer und Gruppenspiele, Seite 2 Tabellen, Seite 3 Finalrunde und Platzierung (zweispaltig, @DR-009)', async () => {
    expect(groupMatches(hallencupSchedule())).toHaveLength(12);
    const { pages } = await layoutOf();

    expect(pages).toHaveLength(3);
    expect(pageText(pages[0])).toContain('Teilnehmer');
    expect(pageText(pages[0])).toContain('Gruppenphase');
    expect(pageText(pages[0])).not.toContain('Tabelle – Gruppe A');
    expect(pageText(pages[1])).toContain('Tabelle – Gruppe A');
    expect(pageText(pages[1])).not.toContain('Platzierung');
    expect(pageText(pages[2])).toContain('Spiel um Platz 3');
    expect(pageText(pages[2])).toContain('Platzierung');
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

describe('@DR-002 Folgeseite: 30 Spiele laufen über Seite 1 hinaus, Folgeseite mit Kurzkopf und Spaltenkopf', () => {
  it('„Seite x von y“ auf jeder Seite, y zählt alle Seiten', async () => {
    const schedule = dreissigSchedule();
    expect(groupMatches(schedule)).toHaveLength(30);
    const { pages } = await layoutOf({}, schedule);

    // Die Zeilen sind mit den Kästchen höher (B-28 C1, 8 mm): 30 Spiele brauchen mehr Seiten; die zweispaltige Platzierung (C2) steht noch auf der Finalseite
    expect(pages).toHaveLength(4);
    pages.forEach((page, i) => {
      expect(pageText(page), `Seite ${i + 1}`).toContain(`Seite ${i + 1} von ${pages.length}`);
    });
  });

  it('Folgeseite: Kurzkopf mit dem Turniernamen, Spaltenkopf wiederholt, Spiele laufen weiter', async () => {
    const { pages } = await layoutOf({}, dreissigSchedule());
    const folge = pages[1];

    const kurzkopf = folge.texts.find(t => t.str === 'Hallencup Nord');
    expect(kurzkopf, 'Kurzkopf').toBeDefined();
    expect(Math.abs((kurzkopf?.size ?? 0) - printType.titleShort)).toBeLessThanOrEqual(TOL);
    expect(folge.texts.some(t => t.str === 'Heim')).toBe(true);
    expect(folge.texts.some(t => t.str === 'Gast')).toBe(true);
    expect(pageText(pages[0])).not.toContain('Tabelle – Gruppe A');
  });

  it('Spielnummern: lückenlos und ohne Doppel über alle Seiten, die Folgeseite setzt direkt fort', async () => {
    const { pages } = await layoutOf({}, dreissigSchedule());
    const aufSeite1 = spielnummern(pages[0]);
    const folge = spielnummern(pages[1]);

    expect(aufSeite1[0]).toBe(1);
    expect(folge[0]).toBe(aufSeite1.length + 1);
    expect([...aufSeite1, ...folge]).toEqual(Array.from({ length: aufSeite1.length + folge.length }, (_, i) => i + 1));
    expect(aufSeite1.length + folge.length).toBe(30);
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
