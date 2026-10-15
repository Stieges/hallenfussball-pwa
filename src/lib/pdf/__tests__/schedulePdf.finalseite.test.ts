/**
 * B-28a3-4b Punkt 4 (Controller 15.10.): Auf der Finalseite hat jede Runde eine eigene Zwischenüberschrift
 * (Achtelfinale, Viertelfinale, Halbfinale, Spiel um Platz 3, Finale), die Reihenfolge folgt der Anstoßzeit.
 * Gelesen aus dem fertigen PDF (pdfjs). Szenarien: @DR-005, @BM-016.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { finalsMatches, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf, ohneNummer } from './pdfFixtureLayout';
import type { LayoutPage, LayoutText } from './pdfjsLayout';

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

    expect(zeilePosition(pages, 13)).toBeGreaterThan(halbfinale);
    expect(zeilePosition(pages, 14)).toBeGreaterThan(halbfinale);
    expect(zeilePosition(pages, 15)).toBeGreaterThan(finale);
    expect(zeilePosition(pages, 16)).toBeGreaterThan(platz3);
  });

  it('Reihenfolge nach Anstoßzeit: fängt das Spiel um Platz 3 vor dem Finale an, steht es vor dem Finale', async () => {
    const tournament = hallencupTournament();
    const schedule: GeneratedSchedule = hallencupSchedule(tournament);
    const platz3 = finalsMatches(schedule).find(m => m.finalType === 'thirdPlace');
    expect(platz3).toBeDefined();
    if (platz3) {
      platz3.startTime = new Date(platz3.startTime.getTime() - 15 * 60_000);
      platz3.time = '14:05';
    }
    const { pages } = await layoutOf({ tournament }, schedule);

    expect(position(pages, 'Halbfinale')).toBeLessThan(position(pages, 'Spiel um Platz 3'));
    expect(position(pages, 'Spiel um Platz 3')).toBeLessThan(position(pages, 'Finale'));
    expect(zeilePosition(pages, 16)).toBeLessThan(zeilePosition(pages, 15));
  });

  it('Top 16: Achtelfinale, Viertelfinale, Halbfinale, Finale, Spiel um Platz 3 in Reihenfolge der Anstoßzeit', async () => {
    const teams: Team[] = Array.from({ length: 32 }, (_, i) => ({
      id: `team-${i + 1}`,
      name: `Verein ${String(i + 1).padStart(2, '0')}`,
      group: 'ABCDEFGH'[Math.floor(i / 4)],
    }));
    const tournament = hallencupTournament({
      teams,
      numberOfTeams: teams.length,
      numberOfGroups: 8,
      finalsConfig: { preset: 'top-16', tiebreaker: 'shootout' },
    });
    const { pages } = await layoutOf({ tournament }, generateFullSchedule(tournament, 'de'));
    // Anstoßzeit: das Spiel um Platz 3 (18:20) kommt nach dem Finale (18:10)
    const folge = ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale', 'Spiel um Platz 3'].map(name => position(pages, name));

    folge.forEach((p, i) => expect(p, `Überschrift ${i}`).toBeGreaterThan(-1));
    for (let i = 1; i < folge.length; i++) {
      expect(folge[i]).toBeGreaterThan(folge[i - 1]);
    }
  });
});
