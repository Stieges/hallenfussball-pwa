/**
 * R3-5b Spiele, Punkte und Tordifferenz im Endstand. Record `2026-10-01_endstand-und-torschuetzen`: @ET-001 (Gruppen-
 * Ausgeschiedene mit Punkten und Tordifferenz), @ET-022 (Jeder gegen jeden: je Platz Spiele, Punkte, Tordifferenz).
 * Aus dem Gherkin abgeleitet; die Erwartungen sind von Hand aus den Ergebnissen gerechnet, nicht am Code abgelesen.
 */
import { describe, expect, it } from 'vitest';
import type { Match, Tournament } from '../../../../types/tournament';
import { createMockTournament } from '../../../../test/factories';
import { vs } from '../../../../test/matchSlotFixtures';
import { computeFinalStandings, type FinalStandingRow } from '..';
import { jgj } from '../../__tests__/decisionTestKit';
import { BFV_ORDER, id, parseMatches, POINTS_310, teamsOf } from '../../__tests__/fixtures';
import { completeGroup } from './finalStandingsKit';

/** @ET-022: 1. SG Mitte, 2. FC Nord, 3. VfB Ufer, 4. SV Süd, 5. TSV West, 6. SC Ost (alle Spiele 1:0). */
const DATEN_022 = 'M–N 1:0; M–U 1:0; M–S 1:0; M–W 1:0; M–O 1:0; N–U 1:0; N–S 1:0; N–W 1:0; N–O 1:0; U–S 1:0; U–W 1:0; U–O 1:0; S–W 1:0; S–O 1:0; W–O 1:0';

const valuesByName = (ranking: readonly FinalStandingRow[]) =>
  ranking.map((row) => [row.teamName, row.place, row.tableValues] as const);

describe('R3-5b @ET-022 Jeder gegen jeden: je Platz die Werte der abgeschlossenen Tabelle', () => {
  it('@ET-022 jede Zeile trägt Spiele, Tore, Gegentore, Tordifferenz und Punkte aus der Tabelle (5 Spiele je Team, 3 Punkte je Sieg)', () => {
    const result = computeFinalStandings(completeGroup(jgj('NSWOMU', DATEN_022)));
    expect(result.state).toBe('complete');
    expect(valuesByName(result.ranking)).toEqual([
      ['SG Mitte', 1, { games: 5, goalsFor: 5, goalsAgainst: 0, goalDiff: 5, points: 15 }],
      ['FC Nord', 2, { games: 5, goalsFor: 4, goalsAgainst: 1, goalDiff: 3, points: 12 }],
      ['VfB Ufer', 3, { games: 5, goalsFor: 3, goalsAgainst: 2, goalDiff: 1, points: 9 }],
      ['SV Süd', 4, { games: 5, goalsFor: 2, goalsAgainst: 3, goalDiff: -1, points: 6 }],
      ['TSV West', 5, { games: 5, goalsFor: 1, goalsAgainst: 4, goalDiff: -3, points: 3 }],
      ['SC Ost', 6, { games: 5, goalsFor: 0, goalsAgainst: 5, goalDiff: -5, points: 0 }],
    ]);
  });

  it('@ET-022 auch der vorläufige Endstand (Gruppe noch nicht abgeschlossen) trägt die Werte der Tabelle, wie sie gerade steht', () => {
    const result = computeFinalStandings(jgj('NSWOMU', DATEN_022));
    expect(result.state).toBe('provisional');
    expect(result.ranking[0].tableValues).toEqual({ games: 5, goalsFor: 5, goalsAgainst: 0, goalDiff: 5, points: 15 });
  });

  it('@ET-022 ein noch nicht gespieltes Spiel zählt nicht: 0 Spiele, 0 Punkte, Tordifferenz 0', () => {
    const t = jgj('NS', 'N–S 1:0', undefined);
    const offen: Tournament = { ...t, matches: parseMatches('N–S 1:0', { open: ['N–S'] }) };
    expect(computeFinalStandings(offen).ranking.map((row) => row.tableValues)).toEqual([
      { games: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 },
      { games: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 },
    ]);
  });
});

/** Gruppe A (S, N, W, O: W Dritter mit 4 Punkten und +1, O Vierter mit 0 und −7) und B (M, B, U, T), Halbfinals, Finale, Spiel um Platz 3, alle gespielt. */
function hallencup(): Tournament {
  const a = parseMatches('W–O 3:0; N–O 2:0; S–O 2:0; W–S 0:0; N–W 2:0; N–S 0:1', { group: 'A', idPrefix: 'a' });
  const b = parseMatches('M–T 2:0; B–T 2:0; U–T 1:0; M–U 2:0; B–U 2:0; M–B 1:0', { group: 'B', idPrefix: 'b' });
  const final = (matchId: string, finalType: NonNullable<Match['finalType']>, x: string, y: string, scoreA: number, scoreB: number): Match => ({
    id: matchId, round: 7, field: 1, isFinal: true, finalType, matchStatus: 'finished', scoreA, scoreB, ...vs(id(x as 'N'), id(y as 'N')),
  });
  const playoffs: Match[] = [
    { id: 'hf-1', round: 7, field: 1, isFinal: true, phase: 'semifinal', matchStatus: 'finished', scoreA: 1, scoreB: 0, ...vs(id('S'), id('B')) },
    { id: 'hf-2', round: 7, field: 2, isFinal: true, phase: 'semifinal', matchStatus: 'finished', scoreA: 1, scoreB: 0, ...vs(id('M'), id('N')) },
    final('fin', 'final', 'S', 'M', 1, 0),
    final('p3', 'thirdPlace', 'B', 'N', 1, 0),
  ];
  return createMockTournament({
    teams: [...teamsOf('NSWO', 'A'), ...teamsOf('MBUT', 'B')],
    matches: [...a, ...b, ...playoffs],
    pointSystem: POINTS_310,
    placementLogic: BFV_ORDER,
    groupSystem: 'groupsAndFinals',
    version: 1,
  });
}

describe('R3-5b @ET-001 Hallencup Nord: Gruppen-Ausgeschiedene mit Punkten und Tordifferenz', () => {
  const ranking = computeFinalStandings(hallencup()).ranking;

  it('@ET-001 Plätze 5 bis 8 tragen 4/+1, 3/−3, 0/−5, 0/−7 (Punkte/Tordifferenz) aus ihrer Gruppe', () => {
    const ausgeschieden = ranking.filter((row) => row.place >= 5);
    expect(ausgeschieden.map((row) => [row.place, row.teamName, row.origin.kind === 'groupPlace' ? row.origin.place : 0, row.tableValues?.points, row.tableValues?.goalDiff]))
      .toEqual([[5, 'TSV West', 3, 4, 1], [6, 'VfB Ufer', 3, 3, -3], [7, 'TuS Tal', 4, 0, -5], [8, 'SC Ost', 4, 0, -7]]);
    expect(ausgeschieden.map((row) => row.tableValues?.games)).toEqual([3, 3, 3, 3]);
  });

  it('@ET-001 Gegenbeispiel: Zeilen aus Platzierungsspielen (Plätze 1 bis 4) tragen keine Tabellenwerte', () => {
    const ausPlatzierungsspiel = ranking.filter((row) => row.origin.kind === 'placementGame');
    expect(ausPlatzierungsspiel.map((row) => row.place)).toEqual([1, 2, 3, 4]);
    expect(ausPlatzierungsspiel.map((row) => row.tableValues)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
