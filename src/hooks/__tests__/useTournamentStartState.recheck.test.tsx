/**
 * B-02 Paket A Fixrunde 2, B2 — `recheck()` ist fail-closed (Ruling W1).
 *
 * Ein Fake-ILiveMatchRepository im RepositoryContext speist die Fälle, die
 * Probe 2 bisher nicht absicherte: Serverfehler, laufendes Spiel, Offline.
 * Gegenbeispiel: leerer Live-Stand und online → 'not-started'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useTournamentStartState } from '../useTournamentStartState';
import type { Tournament } from '../../types/tournament';
import type { ILiveMatchRepository } from '../../core/repositories/ILiveMatchRepository';
import type { LiveMatch } from '../../core/models/LiveMatch';
import { RealtimeEnabledContext } from '../../lib/realtimeEnabled';

const fakeLive = vi.hoisted(() => ({
  getAll: vi.fn(),
}));

const online = vi.hoisted(() => ({ isOnline: true }));

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useOptionalLiveMatchRepository: (): ILiveMatchRepository =>
    fakeLive as unknown as ILiveMatchRepository,
}));

vi.mock('../useOnlineStatus', () => ({
  useIsOnline: () => online.isOnline,
  useOnlineStatus: () => ({ isOnline: online.isOnline, wasOffline: false }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <RealtimeEnabledContext.Provider value={true}>{children}</RealtimeEnabledContext.Provider>
);

function runningLiveMatch(): Map<string, LiveMatch> {
  const match = { id: 'm1', status: 'RUNNING' } as LiveMatch;
  return new Map([['m1', match]]);
}

function tournamentWithMatches(): Pick<
  Tournament,
  'id' | 'matches' | 'status' | 'publishedAt'
> {
  return {
    id: 't1',
    matches: [
      {
        id: 'm1',
        round: 1,
        field: 1,
        teamA: '1',
        teamB: '2',
        scheduledTime: '09:00',
      },
    ] as unknown as Tournament['matches'],
    status: 'published',
    publishedAt: '2026-03-01T09:00:00Z',
  };
}

describe('useTournamentStartState — recheck() fail-closed (B-02 Fixrunde 2, B2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    online.isOnline = true;
    fakeLive.getAll.mockResolvedValue(new Map());
  });

  it('getAll wirft: nicht feststellbar', async () => {
    fakeLive.getAll.mockRejectedValue(new Error('server down'));
    const { result } = renderHook(() => useTournamentStartState(tournamentWithMatches()), {
      wrapper,
    });

    await expect(result.current.recheck()).resolves.toBe('unknown');
  });

  it('laufendes Live-Spiel: angepfiffen', async () => {
    fakeLive.getAll.mockResolvedValue(runningLiveMatch());
    const { result } = renderHook(() => useTournamentStartState(tournamentWithMatches()), {
      wrapper,
    });

    await expect(result.current.recheck()).resolves.toBe('started');
  });

  it('offline im Cloud-Modus: nicht feststellbar', async () => {
    online.isOnline = false;
    const { result } = renderHook(() => useTournamentStartState(tournamentWithMatches()), {
      wrapper,
    });

    await expect(result.current.recheck()).resolves.toBe('unknown');
    expect(fakeLive.getAll).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: leerer Live-Stand und online: nicht angepfiffen', async () => {
    fakeLive.getAll.mockResolvedValue(new Map());
    const { result } = renderHook(() => useTournamentStartState(tournamentWithMatches()), {
      wrapper,
    });

    await expect(result.current.recheck()).resolves.toBe('not-started');
  });
});
