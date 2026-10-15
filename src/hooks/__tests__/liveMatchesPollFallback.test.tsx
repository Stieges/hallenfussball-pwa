/**
 * A-08f1 (@FU-087, Spielplan-Teil): Ist der Realtime-Kanal unterbrochen, holt `useLiveMatches`
 * den Turnierstand alle 5 s per Abfrage nach -- ohne Hinweis. Der Test laeuft ueber den echten
 * `useLiveMatches` mit Fake-Repo: der `onStatusChange`-Rueckruf des `subscribe`-Aufrufs meldet den
 * Kanalzustand, das Fake-`getAll` liefert erst 0:0 und danach 1:0 fuer Spiel 7.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RealtimeChannelStatus } from '../../core/repositories/SupabaseLiveMatchRepository';
import type { LiveMatch as CoreLiveMatch } from '../../core/models/LiveMatch';

interface SubscribeOptions {
  onStatusChange?: (status: RealtimeChannelStatus) => void;
}

const subscribe = vi.fn<(tournamentId: string, options: SubscribeOptions) => void>();
const unsubscribe = vi.fn();

let scoreAt7 = { home: 0, away: 0 };
const getAll = vi.fn(async () => {
  const match = {
    id: '7', number: 7, phaseLabel: 'Gruppe A', fieldId: 'f1', scheduledKickoff: '2026-10-17T10:00:00Z',
    durationSeconds: 600, version: 1, status: 'RUNNING', elapsedSeconds: 0, events: [],
    homeTeam: { id: 't1', name: 'Heim' }, awayTeam: { id: 't2', name: 'Gast' },
    homeScore: scoreAt7.home, awayScore: scoreAt7.away,
  } as unknown as CoreLiveMatch;
  return new Map<string, CoreLiveMatch>([['7', match]]);
});

const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll, subscribe, unsubscribe, unsubscribeAll: vi.fn() },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { useLiveMatches } from '../useLiveMatches';

const TOURNAMENT = 'tour-fu087-poll';

function latestOnStatusChange(): (status: RealtimeChannelStatus) => void {
  const handler = subscribe.mock.calls.at(-1)?.[1]?.onStatusChange;
  if (!handler) {
    throw new Error('subscribe() wurde nicht (oder ohne onStatusChange) aufgerufen');
  }
  return handler;
}

function renderSchedulePage() {
  return renderHook(() => useLiveMatches(TOURNAMENT));
}

describe('useLiveMatches -- Abfrage-Ausweichen bei unterbrochenem Kanal (@FU-087)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scoreAt7 = { home: 0, away: 0 };
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('@FU-087 Pflicht: Kanal CLOSED -> Spiel 7 zeigt 1:0 innerhalb von 10 s, ohne Hinweis', async () => {
    const { result, unmount } = renderSchedulePage();
    await act(async () => { await Promise.resolve(); });
    expect(subscribe).toHaveBeenCalledWith(TOURNAMENT, expect.anything());
    expect(result.current.liveMatches.get('7')?.homeScore).toBe(0);

    act(() => latestOnStatusChange()('CLOSED'));
    // Der Push bleibt aus: der Stand aendert sich nur im Repo.
    scoreAt7 = { home: 1, away: 0 };

    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(result.current.liveMatches.get('7')?.homeScore).toBe(1);
    expect(result.current.liveMatches.get('7')?.awayScore).toBe(0);
    unmount();
  });

  it('@FU-087 Gegenbeispiel: SUBSCRIBED -> keine Abfrage nach dem ersten Laden; nach CLOSED -> SUBSCRIBED endet sie', async () => {
    const { unmount } = renderSchedulePage();
    await act(async () => { await Promise.resolve(); });
    expect(getAll).toHaveBeenCalledTimes(1);

    act(() => latestOnStatusChange()('SUBSCRIBED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(getAll).toHaveBeenCalledTimes(1);

    act(() => latestOnStatusChange()('CLOSED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    const afterOneTick = getAll.mock.calls.length;
    expect(afterOneTick).toBeGreaterThan(1);

    act(() => latestOnStatusChange()('SUBSCRIBED'));
    const atRecovery = getAll.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(getAll.mock.calls.length).toBe(atRecovery);
    unmount();
  });
});
