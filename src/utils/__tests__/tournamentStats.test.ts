import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStatsSnapshot, buildFinishTournamentPatch } from '../tournamentStats';
import { isTournamentCompleted } from '../tournamentCategories';
import type { Tournament } from '../../types/tournament';

const tournament = {
  id: 't1',
  teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
  matches: [{ id: 'm1', scoreA: 3, scoreB: 1 }, { id: 'm2', scoreA: 0, scoreB: 0 }, { id: 'm3' }, { id: 'm4', scoreA: 2 }],
} as unknown as Tournament;

describe('createStatsSnapshot', () => {
  it('zählt Teams, Spiele, gespielte Spiele und Tore', () => {
    const s = createStatsSnapshot(tournament);
    expect(s.teamCount).toBe(3); expect(s.totalMatches).toBe(4);
    expect(s.completedMatches).toBe(2); expect(s.totalGoals).toBe(6);
    expect(s.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('buildFinishTournamentPatch', () => {
  afterEach(() => vi.useRealTimers());
  it('L5: setzt manuallyCompleted — das Feld, das die Kategorisierung liest', () => {
    expect(buildFinishTournamentPatch(tournament).manuallyCompleted).toBe(true);
  });
  it('L5: setzt completedAt, statsSnapshot, dashboardStatus und updatedAt', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
    const p = buildFinishTournamentPatch(tournament);
    expect(p.completedAt).toBe('2026-03-01T12:00:00.000Z'); expect(p.updatedAt).toBe('2026-03-01T12:00:00.000Z');
    expect(p.dashboardStatus).toBe('finished'); expect(p.statsSnapshot?.teamCount).toBe(3);
  });
});

describe('L5: Kopplung zur Dashboard-Kategorisierung', () => {
  it('ein Turnier mit nur dashboardStatus=finished gilt NICHT als beendet', () => {
    expect(isTournamentCompleted({ ...tournament, dashboardStatus: 'finished' } as unknown as Tournament)).toBe(false);
  });
  it('nach buildFinishTournamentPatch gilt es als beendet', () => {
    const patched = { ...tournament, ...buildFinishTournamentPatch(tournament) };
    // Type assertion necessary because spread result is Tournament & Partial<Tournament>
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    expect(isTournamentCompleted(patched as Tournament)).toBe(true);
  });
});
