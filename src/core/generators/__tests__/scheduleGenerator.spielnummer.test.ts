/**
 * Spielplan aus gespeicherten Spielen (Befund C-SPIELNUMMER-FEHLT): Zuschauer-Seite, Cockpit und Monitor lesen die
 * Nummer aus `generateFullSchedule`. Früher galt bei fehlender Nummer der Platz in der Liste („Spiel 1 als Spiel 9“).
 * @ZM-007: Spiel 1 ist das erste Spiel des Plans; @SL-049: Spielnummern gelten wörtlich; @TM-142: Halbfinale 1 und 2
 * sind zwei verschiedene Spiele.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../scheduleGenerator';
import { publishHallencup } from '../../view/__fixtures__/hallencupNord';

let cup: Tournament;
beforeAll(async () => {
  cup = (await publishHallencup()).tournament;
});

const nummerJeId = (matches: ReadonlyArray<Pick<Match, 'id' | 'matchNumber'>>): Map<string, number | undefined> =>
  new Map(matches.map((m) => [m.id, m.matchNumber]));

describe('generateFullSchedule: Spielnummer gespeicherter Spiele', () => {
  it('@ZM-007 C-SPIELNUMMER-FEHLT: Spiele ohne Nummer in vertauschter Reihenfolge bekommen die Nummer ihres Platzes im Plan, nicht ihres Listenplatzes', () => {
    const ohneNummer = cup.matches.map(({ matchNumber: _weg, ...rest }) => rest).reverse();

    const schedule = generateFullSchedule({ ...cup, matches: ohneNummer });

    expect(nummerJeId(schedule.allMatches)).toEqual(nummerJeId(cup.matches));
    expect(schedule.allMatches.find((m) => m.id === cup.matches[0].id)?.matchNumber).toBe(1);
  });

  it('@TM-142 C-FINALRUNDE-REIHENFOLGE: fehlt die Finalrunde, zählt sie nach der höchsten Nummer der Gruppenphase weiter – auch bei vertauschter Liste', () => {
    const gruppenspiele = cup.matches.filter((m) => m.phase === 'groupStage').reverse();

    const schedule = generateFullSchedule({ ...cup, matches: gruppenspiele });
    const nummern = schedule.allMatches.map((m) => m.matchNumber);
    const finalrunde = schedule.allMatches.filter((m) => m.phase !== 'groupStage').map((m) => m.matchNumber);

    expect(new Set(nummern).size).toBe(nummern.length);
    expect(Math.min(...finalrunde)).toBe(gruppenspiele.length + 1);
  });
});
