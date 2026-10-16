/**
 * useRunningMatchIds (A-08f2, @FU-087): laufende Spiele des Spielplans kommen aus dem echten
 * `useLiveMatches` (Fake-Realtime-Repo), nicht aus localStorage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { LiveMatch as CoreLiveMatch } from '../../../../core/models/LiveMatch';

const TOURNAMENT = 'tour-fu087-running';

function coreMatch(id: string, status: string): CoreLiveMatch {
  return {
    id, number: Number(id), phaseLabel: 'Gruppe A', fieldId: 'f1', scheduledKickoff: '2026-10-17T10:00:00Z',
    durationSeconds: 600, version: 1, status, elapsedSeconds: 0, events: [],
    homeTeam: { id: 'h', name: 'Heim' }, awayTeam: { id: 'a', name: 'Gast' }, homeScore: 0, awayScore: 0,
  } as unknown as CoreLiveMatch;
}

const repoMatches = new Map<string, CoreLiveMatch>();
const getAll = vi.fn(async () => new Map(repoMatches));
const subscribe = vi.fn();
const unsubscribe = vi.fn();

const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll, subscribe, unsubscribe, unsubscribeAll: vi.fn() },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { useRunningMatchIds } from '../useRunningMatchIds';

describe('useRunningMatchIds (A-08f2, @FU-087)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMatches.clear();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('@FU-087 Pflicht: Spiel 7 RUNNING im Repo -> laufend; beendetes Spiel 8 nicht', async () => {
    repoMatches.set('7', coreMatch('7', 'RUNNING'));
    repoMatches.set('8', coreMatch('8', 'FINISHED'));

    const { result, unmount } = renderHook(() => useRunningMatchIds(TOURNAMENT));
    await act(async () => { await Promise.resolve(); });

    expect(getAll).toHaveBeenCalledWith(TOURNAMENT);
    expect(Array.from(result.current)).toEqual(['7']);
    unmount();
  });

  it('@FU-087 Gegenbeispiel: veralteter localStorage-Eintrag RUNNING, Repo meldet Spiel 5 nicht laufend -> nicht laufend', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ '5': { status: 'RUNNING' } }));
    repoMatches.set('5', coreMatch('5', 'SCHEDULED'));

    const { result, unmount } = renderHook(() => useRunningMatchIds(TOURNAMENT));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.has('5')).toBe(false);
    expect(result.current.size).toBe(0);
    unmount();
  });
});
