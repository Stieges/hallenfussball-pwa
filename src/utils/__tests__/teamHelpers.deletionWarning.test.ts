/**
 * @W5-009: Schutz eines Spiels beim Team-Entfernen. Ein Spiel mit Ereignissen oder einem Status ungleich
 * „geplant“ bleibt auch ohne Endergebnis erhalten. Die Warnung im Dialog nennt genau diese Spiele als
 * erhalten.
 */
import { describe, it, expect } from 'vitest';
import type { Match, Team } from '../../types/tournament';
import { analyzeTeamMatches, getTeamDeletionWarning } from '../teamHelpers';
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

describe('getTeamDeletionWarning – Warnung entspricht dem Verhalten (@W5-009)', () => {
  it('Team mit Spiel mit halbem Ergebnis: Warnung nennt das Spiel als erhalten, nicht als entfernt', () => {
    const analysis = analyzeTeamMatches(teams[0], [match('m-half', { scoreA: 2 })]);
    const warning = getTeamDeletionWarning(analysis);
    expect(warning?.key).toBe('teams.deleteDialog.warningProtected');
    expect(warning?.values).toEqual({ name: 'FC Nord', count: 1 });
  });

  it('Team mit laufendem Spiel ohne Tor: Warnung nennt das Spiel als erhalten', () => {
    const analysis = analyzeTeamMatches(teams[0], [match('m-run', { matchStatus: 'running' })]);
    expect(getTeamDeletionWarning(analysis)?.key).toBe('teams.deleteDialog.warningProtected');
  });

  it('Gegenbeispiel: geplantes Spiel ohne Ergebnis: Warnung sagt, dass es entfernt wird', () => {
    const analysis = analyzeTeamMatches(teams[0], [match('m-plan')]);
    const warning = getTeamDeletionWarning(analysis);
    expect(warning?.key).toBe('teams.deleteDialog.warningUnprotected');
    expect(warning?.values).toEqual({ name: 'FC Nord', count: 1 });
  });

  it('gemischt: beide Anteile werden getrennt gezählt', () => {
    const analysis = analyzeTeamMatches(teams[0], [
      match('m-half', { scoreA: 2 }),
      match('m-plan', {}, vs(A, C)),
    ]);
    const warning = getTeamDeletionWarning(analysis);
    expect(warning?.key).toBe('teams.deleteDialog.warningMixed');
    expect(warning?.values).toEqual({ name: 'FC Nord', protected: 1, unprotected: 1 });
  });

  it('kein Spiel: keine Warnung', () => {
    expect(getTeamDeletionWarning(analyzeTeamMatches(teams[0], []))).toBeNull();
  });
});
