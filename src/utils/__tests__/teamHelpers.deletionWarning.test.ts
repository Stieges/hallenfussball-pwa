/**
 * @W5-009: Lösch-Warnung wählt je Anteil den richtigen Schlüssel (Einzahl/Mehrzahl über count).
 * Die gerenderten Texte prüft TeamsTab.deleteWarningPlural.test.tsx mit echtem i18n.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Match, Team } from '../../types/tournament';
import { analyzeTeamMatches, getTeamDeletionWarning } from '../teamHelpers';
import { testUuid } from '../../test/testIds';
import { vs } from '../../test/matchSlotFixtures';

const A = testUuid(1);
const B = testUuid(2);
const C = testUuid(3);
const nord: Team = { id: A, name: 'FC Nord' };
const match = (id: string, extra: Partial<Match> = {}, sides = vs(A, B)): Match => ({
  id, round: 1, field: 1, ...sides, ...extra,
});

describe('getTeamDeletionWarning – Schlüssel je Anteil', () => {
  it('nur geschützte Spiele: warningProtected mit count', () => {
    const t = vi.fn((key: string) => key);
    getTeamDeletionWarning(analyzeTeamMatches(nord, [match('m-half', { scoreA: 2 })]), t);
    expect(t).toHaveBeenCalledWith('teams.deleteDialog.warningProtected', { name: 'FC Nord', count: 1 });
  });

  it('nur ungeschützte Spiele: warningUnprotected mit count', () => {
    const t = vi.fn((key: string) => key);
    getTeamDeletionWarning(analyzeTeamMatches(nord, [match('m-plan'), match('m-plan2', {}, vs(A, C))]), t);
    expect(t).toHaveBeenCalledWith('teams.deleteDialog.warningUnprotected', { name: 'FC Nord', count: 2 });
  });

  it('gemischt: warningMixed mit getrennt gezählten Anteilen', () => {
    const t = vi.fn((key: string) => key);
    getTeamDeletionWarning(analyzeTeamMatches(nord, [match('m-half', { scoreA: 2 }), match('m-plan', {}, vs(A, C))]), t);
    expect(t).toHaveBeenCalledWith('teams.deleteDialog.partKept', { count: 1 });
    expect(t).toHaveBeenCalledWith('teams.deleteDialog.partRemoved', { count: 1 });
    expect(t).toHaveBeenCalledWith('teams.deleteDialog.warningMixed', expect.objectContaining({ name: 'FC Nord' }));
  });

  it('kein Spiel: null, kein Übersetzungsaufruf', () => {
    const t = vi.fn((key: string) => key);
    expect(getTeamDeletionWarning(analyzeTeamMatches(nord, []), t)).toBeNull();
    expect(t).not.toHaveBeenCalled();
  });
});
