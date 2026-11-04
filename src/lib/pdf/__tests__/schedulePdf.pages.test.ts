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

describe('@DR-002 Seitenaufbau: 12 Spiele und die übrigen Abschnitte in fester Reihenfolge', () => {
  it('Seite 1 Kopf und Gruppenspiele (keine Teilnehmerliste), Seite 2 Tabellen, Seite 3 Finalrunde und Platzierung: mit zwei Feldern stehen die kleinen Linien unter dem Ergebnis, die Finalrunde ist höher und hat auf der Tabellenseite nicht ganz Platz (@DR-037, zweispaltig, @DR-009)', async () => {
    expect(groupMatches(hallencupSchedule())).toHaveLength(12);
    const { pages } = await layoutOf();

    expect(pages).toHaveLength(3);
    expect(pageText(pages[0])).toContain('Beginn');
    expect(pageText(pages[0])).not.toContain('Teilnehmer');
    expect(pageText(pages[0])).not.toContain('Gruppe A');
    expect(pageText(pages[1])).toContain('Gruppe A');
    expect(pageText(pages[1])).not.toContain('Platzierung');
    expect(pageText(pages[2])).toContain('SPIEL UM PLATZ 3');
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

  it('Turnier ohne Finalrunde: keine leere Seite, die Platzierung steht unter den Tabellen (C4, Daniel 15.10.)', async () => {
    const ohneFinale = generateFullSchedule(
      hallencupTournament({
        finalsConfig: { preset: 'none' },
        finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
      }),
      'de'
    );
    const { pages } = await layoutOf({}, ohneFinale);

    expect(pages).toHaveLength(2);
    pages.forEach((page, i) => {
      expect(page.texts.filter(t => !SEITENZAHL.test(t.str)).length, `Seite ${i + 1}`).toBeGreaterThan(0);
    });
    expect(pageText(pages[1])).toContain('Gruppe A');
    expect(pageText(pages[1])).toContain('Platzierung');
  });
});

describe('@DR-002 Folgeseite: 30 Spiele laufen über Seite 1 hinaus, Folgeseite mit Kurzkopf und Spaltenkopf', () => {
  it('„Seite x von y“ auf jeder Seite, y zählt alle Seiten', async () => {
    const schedule = dreissigSchedule();
    expect(groupMatches(schedule)).toHaveLength(30);
    const { pages } = await layoutOf({}, schedule);

    // Mit geteiltem Turnier trägt jeder Kurzkopf den QR (@DR-003, C4-F): die Folgeseiten fassen weniger Zeilen. Zwei Seiten Spiele,
    // dann eine Seite mit den Tabellen (zwei Gruppen zu sechs Teams); Finalrunde und Platzierung haben dort nicht ganz Platz und folgen auf einer neuen Seite.
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
    expect(pageText(pages[0])).not.toContain('Gruppe A');
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

  it('@DR-002 Querformat angefordert: trotzdem A4 hoch (210 × 297), Tabellen beginnen neu', async () => {
    const { pages, width, height } = await layoutOf({ orientation: 'landscape' }, zwanzigSchedule());

    expect(width).toBeCloseTo(210, 1);
    expect(height).toBeCloseTo(297, 1);
    const tabellen = pages.findIndex(p => pageText(p).includes('Gruppe A'));
    expect(tabellen).toBeGreaterThan(0);
    expect(pages[tabellen].texts.some(t => t.str === '20')).toBe(false);
  });
});
