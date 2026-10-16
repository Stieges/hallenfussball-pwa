/**
 * @W5-009: Schutz eines Spiels beim Team-Entfernen. Ein Spiel mit Ereignissen oder einem Status ungleich
 * „geplant“ bleibt auch ohne Endergebnis erhalten.
 */
import { describe, it, expect } from 'vitest';
import type { Match, RuntimeMatchEvent, Team, Tournament } from '../../types/tournament';
import { deleteTeamSafely, matchHasEvents } from '../teamHelpers';
import { testUuid } from '../../test/testIds';
import { vs } from '../../test/matchSlotFixtures';

const A = testUuid(1);
const B = testUuid(2);
const C = testUuid(3);
const teams: Team[] = [
  { id: A, name: 'FC Nord' },
  { id: B, name: 'SV Sued' },
  { id: C, name: 'TSV Ost' },
];
const match = (id: string, extra: Partial<Match> = {}, sides = vs(A, B)): Match => ({
  id,
  round: 1,
  field: 1,
  ...sides,
  ...extra,
});
const event: RuntimeMatchEvent = {
  id: 'e1',
  timestampSeconds: 60,
  type: 'FOUL',
  payload: {},
  scoreAfter: { home: 0, away: 0 },
};

describe('matchHasEvents – Schutz über Ereignisse und Status (@W5-009)', () => {
  it('Spiel mit Ereignis, ohne Ergebnis: geschützt', () => {
    expect(matchHasEvents(match('m', { events: [event] }))).toBe(true);
  });

  it('Status running, ohne Ergebnis: geschützt', () => {
    expect(matchHasEvents(match('m', { matchStatus: 'running' }))).toBe(true);
  });

  it('Status finished, ohne Ergebnis: geschützt', () => {
    expect(matchHasEvents(match('m', { matchStatus: 'finished' }))).toBe(true);
  });

  it('Gegenbeispiel: geplant, ohne Ergebnis und ohne Ereignis: nicht geschützt', () => {
    expect(matchHasEvents(match('m', { matchStatus: 'scheduled' }))).toBe(false);
  });
});

describe('deleteTeamSafely – Schutz gilt auch ohne Endergebnis', () => {
  const tournament = (matches: Match[]): Pick<Tournament, 'teams' | 'matches'> => ({ teams, matches });

  it('laufendes Spiel ohne Tor: Team wird isRemoved, Spiel bleibt', () => {
    const result = deleteTeamSafely(tournament([match('m-run', { matchStatus: 'running' })]), A);
    expect(result.updatedTeams.find((t) => t.id === A)?.isRemoved).toBe(true);
    expect(result.updatedMatches.map((m) => m.id)).toEqual(['m-run']);
  });

  it('Spiel nur mit Ereignis, ohne Ergebnis: Spiel bleibt', () => {
    const result = deleteTeamSafely(tournament([match('m-ev', { events: [event] })]), A);
    expect(result.updatedMatches.map((m) => m.id)).toEqual(['m-ev']);
  });

  it('Gegenbeispiel: geplantes Spiel ohne Ergebnis und Ereignis wird entfernt, Team ganz gelöscht', () => {
    const result = deleteTeamSafely(tournament([match('m-plan')]), A);
    expect(result.updatedTeams.find((t) => t.id === A)).toBeUndefined();
    expect(result.updatedMatches).toEqual([]);
  });
});
