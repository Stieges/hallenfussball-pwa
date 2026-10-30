/**
 * Testdaten R3-7: die Antwort von `display_final_standings` in der Form des Servers (`match_engine.final_standings_payload`,
 * Migration 20261118_004): `{status:'none'}` oder `{status:'final', finishedAt, standings}`; ohne Torschützen-Schalter fehlt
 * `standings.scorers` ganz. Nur Testumgebung.
 */
import { testUuid } from '../../../test/matchSlotFixtures';

export const SERVER_NONE = { status: 'none' } as const;
export const FINISHED_AT = '2026-11-28T12:10:00+00:00';

export const NIKOLAUS_NAMES = ['FC Nord', 'SV Süd', 'TSV West', 'SG Mitte', 'SC Ost', 'FC Berg'];

export interface EndstandOptions {
  names?: readonly string[];
  scorersPublic?: boolean;
  /** Platzziffern je Team (Standard 1, 2, 3 …); geteilte Plätze: 1, 2, 2, 4 */
  places?: readonly number[];
  scorers?: readonly unknown[];
}

const DEFAULT_SCORERS = [
  { kind: 'player', rank: 1, teamId: testUuid(1), teamName: 'FC Nord', number: 9, goals: 5 },
  { kind: 'player', rank: 2, teamId: testUuid(2), teamName: 'SV Süd', number: 7, goals: 4 },
  { kind: 'player', rank: 3, teamId: testUuid(1), teamName: 'FC Nord', number: 10, goals: 3 },
  { kind: 'player', rank: 3, teamId: testUuid(2), teamName: 'SV Süd', number: 4, goals: 3 },
  { kind: 'player', rank: 3, teamId: testUuid(3), teamName: 'TSV West', number: 11, goals: 3 },
];

export function serverEndstand(options: EndstandOptions = {}): unknown {
  const names = options.names ?? NIKOLAUS_NAMES;
  const ranking = names.map((teamName, i) => ({
    place: options.places?.[i] ?? i + 1, teamId: testUuid(i + 1), teamName,
    origin: { kind: 'groupPlace', group: '', place: options.places?.[i] ?? i + 1 },
    tableValues: { games: 5, goalsFor: 10 - i, goalsAgainst: 4 + i, goalDiff: 6 - 2 * i, points: Math.max(0, 15 - 3 * i) },
  }));
  const standings = { format: 1, ranking, appVersion: '2.3.0', computedAt: '2026-11-28T13:10:00+01:00' };
  return {
    status: 'final',
    finishedAt: FINISHED_AT,
    standings: options.scorersPublic === false ? standings : { ...standings, scorers: options.scorers ?? DEFAULT_SCORERS },
  };
}
