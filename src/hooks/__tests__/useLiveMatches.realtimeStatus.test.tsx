/**
 * useLiveMatches -- Verdrahtung des Realtime-Kanalzustands (A-06m, Uebergabe A-06k, @FU-025).
 *
 * `useLiveMatches` ist ein Abonnent des Kanals (Spielplan-/Monitor-Seiten). Es muss den vom
 * Repository gemeldeten Zustand an den geteilten Zustandsspeicher weiterreichen, sonst bliebe das
 * Ausweichen auf Abfrage (`useEngineLiveFallback`) und der Hinweis "Live-Verbindung unterbrochen"
 * dort still tot. Der Test greift den echten `onStatusChange`-Rueckruf des `subscribe`-Aufrufs ab und
 * liest den Zustand ueber die echten Hooks -- ohne den Speicher direkt zu setzen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RealtimeChannelStatus } from '../../core/repositories/SupabaseLiveMatchRepository';

interface SubscribeOptions {
  onStatusChange?: (status: RealtimeChannelStatus) => void;
}

const subscribe = vi.fn<(tournamentId: string, options: SubscribeOptions) => void>();
const unsubscribe = vi.fn();

const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: vi.fn().mockResolvedValue(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: {
    getAll: vi.fn().mockResolvedValue(new Map()),
    subscribe,
    unsubscribe,
    unsubscribeAll: vi.fn(),
  },
  publicLiveMatchRepo: null as unknown,
};
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { useLiveMatches } from '../useLiveMatches';
import { useEngineLiveFallback } from '../useEngineLiveFallback';
import { isRealtimeInterrupted, useRealtimeChannelStatus } from '../realtimeChannelStatus';

const TOURNAMENT = 'tour-lm-status';

function latestOnStatusChange(): (status: RealtimeChannelStatus) => void {
  const handler = subscribe.mock.calls.at(-1)?.[1]?.onStatusChange;
  if (!handler) {
    throw new Error('subscribe() wurde nicht (oder ohne onStatusChange) aufgerufen');
  }
  return handler;
}

/** Spielplan-Seite: Abonnent (useLiveMatches) plus Anzeiger/Ausweichen am selben Turnier. */
function renderLiveMatchesPage(engine: { catchUpLoaded: () => Promise<void> }) {
  return renderHook(() => {
    useLiveMatches(TOURNAMENT);
    useEngineLiveFallback(engine, true, TOURNAMENT);
    const status = useRealtimeChannelStatus(TOURNAMENT);
    return { status, interrupted: isRealtimeInterrupted(status) };
  });
}

describe('useLiveMatches -- Realtime-Zustand (A-06m, @FU-025)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('CLOSED vom Kanal: Hinweis-Flag gesetzt und catchUpLoaded laeuft im 5-s-Takt', async () => {
    const engine = { catchUpLoaded: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderLiveMatchesPage(engine);
    await act(async () => { await Promise.resolve(); });
    expect(subscribe).toHaveBeenCalledWith(TOURNAMENT, expect.anything());

    act(() => latestOnStatusChange()('CLOSED'));
    expect(result.current.status).toBe('CLOSED');
    expect(result.current.interrupted).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel SUBSCRIBED: kein Hinweis, kein Abfrage-Intervall', async () => {
    const engine = { catchUpLoaded: vi.fn().mockResolvedValue(undefined) };
    const { result } = renderLiveMatchesPage(engine);
    await act(async () => { await Promise.resolve(); });
    expect(subscribe).toHaveBeenCalled();

    act(() => latestOnStatusChange()('SUBSCRIBED'));
    expect(result.current.status).toBe('SUBSCRIBED');
    expect(result.current.interrupted).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(engine.catchUpLoaded).not.toHaveBeenCalled();
  });

  it('Unmount: der Zustand wird geloescht, ein spaeter Rueckruf des alten Kanals aendert nichts', async () => {
    const engine = { catchUpLoaded: vi.fn().mockResolvedValue(undefined) };
    const { result, unmount } = renderLiveMatchesPage(engine);
    await act(async () => { await Promise.resolve(); });
    expect(subscribe).toHaveBeenCalled();
    const staleCallback = latestOnStatusChange();
    act(() => staleCallback('CLOSED'));
    expect(result.current.interrupted).toBe(true);

    unmount();
    expect(unsubscribe).toHaveBeenCalledWith(TOURNAMENT);
    act(() => staleCallback('CLOSED'));
    const probe = renderHook(() => useRealtimeChannelStatus(TOURNAMENT));
    expect(probe.result.current).toBeUndefined();
  });
});
