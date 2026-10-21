/**
 * B-28a3-4b Punkt 4 (Controller 15.10.): Auf der Finalseite hat jede Runde eine eigene Zwischenüberschrift
 * (Achtelfinale, Viertelfinale, Halbfinale, Spiel um Platz 3, Finale), die Reihenfolge folgt der Anstoßzeit.
 * Gelesen aus dem fertigen PDF (pdfjs). Szenarien: @DR-005, @BM-016.
 */
import { describe, expect, it } from 'vitest';
import type { GeneratedSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf, ohneNummer } from './pdfFixtureLayout';
import type { LayoutPage, LayoutText } from './pdfjsLayout';
import { testUuid } from '../../../test/testIds';
import { storedSchedule } from './storedSchedule';

const trimmed = (text: LayoutText): string => text.str.trim();

/** Position einer Überschrift im Dokument: Seite und Höhe, damit Seiten sich vergleichen lassen. */
function position(pages: LayoutPage[], text: string): number {
  for (let i = 0; i < pages.length; i++) {
    const treffer = pages[i].texts.find(t => ohneNummer(t.str) === text);
    if (treffer) {return i * 1000 + treffer.y;}
  }
  return -1;
}

/** Position der Zeile mit dieser Spielnummer (Nr-Spalte, links) auf der Finalseite. */
function zeilePosition(pages: LayoutPage[], nummer: number): number {
  for (let i = 0; i < pages.length; i++) {
    const treffer = pages[i].texts.find(t => trimmed(t) === String(nummer) && t.x < 25);
    if (treffer) {return i * 1000 + treffer.y;}
  }
  return -1;
}

describe('Punkt 4 Finalseite: Zwischenüberschrift je Runde', () => {
  it('Halbfinale, Finale und Spiel um Platz 3 haben je eine Überschrift über ihren Zeilen', async () => {
    const tournament = hallencupTournament();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));

    const halbfinale = position(pages, 'Halbfinale');
    const platz3 = position(pages, 'Spiel um Platz 3');
    const finale = position(pages, 'Finale');
    expect(halbfinale, 'Überschrift Halbfinale').toBeGreaterThan(-1);
    expect(platz3, 'Überschrift Spiel um Platz 3').toBeGreaterThan(-1);
    expect(finale, 'Überschrift Finale').toBeGreaterThan(-1);

    // @TM-144: Spiel 15 = Spiel um Platz 3, Spiel 16 = Finale
    expect(zeilePosition(pages, 13)).toBeGreaterThan(halbfinale);
    expect(zeilePosition(pages, 14)).toBeGreaterThan(halbfinale);
    expect(zeilePosition(pages, 15)).toBeGreaterThan(platz3);
    expect(zeilePosition(pages, 16)).toBeGreaterThan(finale);
  });

  it('Reihenfolge nach Anstoßzeit: wird das Finale von Hand vor das Spiel um Platz 3 gelegt, steht es davor', async () => {
    const tournament = hallencupTournament();
    const schedule: GeneratedSchedule = hallencupSchedule(tournament);
    const platz3 = finalsMatches(schedule).find(m => m.finalType === 'thirdPlace');
    const finale = finalsMatches(schedule).find(m => m.finalType === 'final');
    expect(platz3).toBeDefined();
    expect(finale).toBeDefined();
    if (platz3 && finale) {
      finale.startTime = new Date(platz3.startTime.getTime() - 5 * 60_000);
      finale.time = '14:05';
    }
    const { pages } = await layoutOf({ tournament }, schedule);

    expect(position(pages, 'Halbfinale')).toBeLessThan(position(pages, 'Finale'));
    expect(position(pages, 'Finale')).toBeLessThan(position(pages, 'Spiel um Platz 3'));
    expect(zeilePosition(pages, 16)).toBeLessThan(zeilePosition(pages, 15));
  });

  it('Top 16: Achtelfinale, Viertelfinale, Halbfinale, Spiel um Platz 3, Finale in Reihenfolge der Anstoßzeit', async () => {
    const teams: Team[] = Array.from({ length: 32 }, (_, i) => ({
      id: testUuid(i + 1),
      name: `Verein ${String(i + 1).padStart(2, '0')}`,
      group: 'ABCDEFGH'[Math.floor(i / 4)],
    }));
    const tournament = hallencupTournament({
      teams,
      numberOfTeams: teams.length,
      numberOfGroups: 8,
      finalsConfig: { preset: 'top-16', tiebreaker: 'shootout' },
    });
    // 8 Gruppen: seit A-12a nur noch als gespeichertes Turnier (Lesepfad), der Generator legt es nicht mehr an
    const { pages } = await layoutOf({ tournament }, storedSchedule(tournament, 'de'));
    // Anstoßzeit: das Spiel um Platz 3 kommt vor dem Finale (@TM-144, Finale zuletzt)
    const folge = ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Spiel um Platz 3', 'Finale'].map(name => position(pages, name));

    folge.forEach((p, i) => expect(p, `Überschrift ${i}`).toBeGreaterThan(-1));
    for (let i = 1; i < folge.length; i++) {
      expect(folge[i]).toBeGreaterThan(folge[i - 1]);
    }
  });
});
