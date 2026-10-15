/**
 * useCockpitExecution — Realtime (A-08b, A2/A4; Ports aus `useMatchExecution.realtime.test.ts` und
 * `useMatchExecution.engineGuards.test.ts`, B5/N2-m3). Echter Engine-Kontext, Realtime-Repo gemockt.
 *
 * - Abo-Lebenszyklus (Unmount, Turnierwechsel), Subscription-Fehler wird gemeldet (@FU-025 / Sentry).
 * - Kanal-Status reicht an den Store weiter (@FU-025).
 * - Push für ein Engine-Spiel -> genau ein `engine.catchUp` (auch bei abweichender Schreibweise).
 * - Push für ein Nicht-Engine-Spiel -> kein State, kein `catchUp`.
 * - A4: ein fehlgeschlagenes `catchUp` wird gemeldet, nicht verschluckt.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';
import type { RealtimeChannelStatus } from '../../core/repositories/SupabaseLiveMatchRepository';
import { looseVs } from '../../test/matchSlotFixtures';
import { makeEngineContext, FIXTURE_ENGINE_MATCH_ID } from '../../test/engineContextFixture';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';
import { useRealtimeChannelStatus } from '../realtimeChannelStatus';

type MatchChangeHandler = (matchId: string, match: LiveMatch | null) => void;
interface SubscribeOptions {
  onMatchChange?: MatchChangeHandler;
  onStatusChange?: (status: RealtimeChannelStatus) => void;
  onError?: (error: Error) => void;
}

const mockSubscribe = vi.hoisted(() => vi.fn<(tournamentId: string, options: SubscribeOptions) => void>());
const mockUnsubscribe = vi.hoisted(() => vi.fn<(tournamentId: string) => void>());
const mockSupabaseLiveMatchRepo = vi.hoisted(() => ({ subscribe: mockSubscribe, unsubscribe: mockUnsubscribe }));

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ liveMatchRepository: null, isRealtimeEnabled: true, supabaseLiveMatchRepo: mockSupabaseLiveMatchRepo }),
}));

const engineCtx = vi.hoisted(() => ({ current: null as MatchEngineContextValue | null }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineCtx.current,
}));

vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

const mockCaptureFeatureError = vi.hoisted(() => vi.fn());
vi.mock('../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));

vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { useCockpitExecution } from '../useCockpitExecution';

const ENGINE_MATCH_ID = FIXTURE_ENGINE_MATCH_ID;
const OLD_MATCH_ID = 'old-1';

function tournament(id = 'tour-cockpit'): Tournament {
  return {
    id,
    matches: [
      { id: ENGINE_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 1 },
      { id: OLD_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 2, matchNumber: 2, matchStatus: 'finished', scoreA: 3, scoreB: 1 },
    ],
    teams: [{ id: 'teama', name: 'Heim' }, { id: 'teamb', name: 'Gast' }],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

function latestSubscribeOptions(): SubscribeOptions {
  const last = mockSubscribe.mock.calls[mockSubscribe.mock.calls.length - 1];
  if (!last) { throw new Error('subscribe() wurde nicht aufgerufen'); }
  return last[1];
}

function latestOnMatchChange(): MatchChangeHandler {
  const handler = latestSubscribeOptions().onMatchChange;
  if (!handler) { throw new Error('subscribe() ohne onMatchChange'); }
  return handler;
}

/** Rendert und wartet, bis die Engine-Spiele im Cockpit-Zustand angekommen sind. */
async function renderAndFlush(t: Tournament = tournament()) {
  const view = renderHook((props: { tournament: Tournament }) => useCockpitExecution(props.tournament), {
    initialProps: { tournament: t },
  });
  await waitFor(() => expect(view.result.current.liveMatches.has(ENGINE_MATCH_ID)).toBe(true));
  return view;
}

describe('useCockpitExecution — Realtime-Abo (A-08b, A2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockSubscribe.mockImplementation(() => undefined);
    mockUnsubscribe.mockImplementation(() => undefined);
    engineCtx.current = await makeEngineContext();
  });

  it('abonniert das Turnier und meldet sich bei Unmount wieder ab', async () => {
    const { unmount } = await renderAndFlush();

    expect(mockSubscribe).toHaveBeenCalledWith('tour-cockpit', expect.anything());
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledWith('tour-cockpit');
  });

  it('meldet bei Turnierwechsel zuerst das alte Turnier ab und abonniert dann das neue', async () => {
    const order: string[] = [];
    mockSubscribe.mockImplementation((tournamentId) => { order.push(`subscribe:${tournamentId}`); });
    mockUnsubscribe.mockImplementation((tournamentId) => { order.push(`unsubscribe:${tournamentId}`); });

    const { rerender } = await renderAndFlush();
    expect(order).toEqual(['subscribe:tour-cockpit']);

    await act(async () => {
      rerender({ tournament: tournament('tour-2') });
    });

    expect(order).toEqual(['subscribe:tour-cockpit', 'unsubscribe:tour-cockpit', 'subscribe:tour-2']);
  });

  it('meldet einen Subscription-Fehler, statt ihn zu schlucken', async () => {
    await renderAndFlush();

    const error = new Error('Realtime subscription failed');
    act(() => { latestSubscribeOptions().onError?.(error); });

    expect(mockCaptureFeatureError).toHaveBeenCalledWith(error, 'hooks', 'cockpitRealtime', { tournamentId: 'tour-cockpit' });
  });

  it('reicht den Kanal-Status des Abos an den Store weiter (@FU-025)', async () => {
    const { unmount } = await renderAndFlush();

    const status = renderHook(() => useRealtimeChannelStatus('tour-cockpit'));
    expect(status.result.current).toBeUndefined();

    act(() => { latestSubscribeOptions().onStatusChange?.('CLOSED'); });
    expect(status.result.current).toBe('CLOSED');

    unmount();
    expect(status.result.current).toBeUndefined();
  });
});

describe('useCockpitExecution — Realtime-Push (A-08b, A2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockSubscribe.mockImplementation(() => undefined);
    mockUnsubscribe.mockImplementation(() => undefined);
    engineCtx.current = await makeEngineContext();
  });

  it('Push für ein Engine-Spiel: genau ein catchUp, der Push wird nicht als Zustand übernommen', async () => {
    const { result } = await renderAndFlush();
    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    const catchUp = vi.spyOn(ctx.engine, 'catchUp');
    const before = result.current.liveMatches.get(ENGINE_MATCH_ID);

    act(() => {
      latestOnMatchChange()(ENGINE_MATCH_ID, { ...before, homeScore: 99 } as LiveMatch);
    });

    expect(catchUp).toHaveBeenCalledTimes(1);
    expect(catchUp).toHaveBeenCalledWith(ENGINE_MATCH_ID);
    expect(result.current.liveMatches.get(ENGINE_MATCH_ID)).toBe(before);
  });

  it('N2-m3: Push mit abweichender Schreibweise (match_id klein/gross) wird als Engine-Spiel erkannt', async () => {
    const { result } = await renderAndFlush();
    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    const catchUp = vi.spyOn(ctx.engine, 'catchUp');
    const before = result.current.liveMatches.get(ENGINE_MATCH_ID);

    act(() => {
      latestOnMatchChange()(ENGINE_MATCH_ID.toUpperCase(), { ...before, homeScore: 99 } as LiveMatch);
    });

    expect(catchUp).toHaveBeenCalledTimes(1);
    expect(catchUp).toHaveBeenCalledWith(ENGINE_MATCH_ID.toUpperCase());
    expect(result.current.liveMatches.get(ENGINE_MATCH_ID.toUpperCase())).toBeUndefined();
  });

  it('Push für ein Nicht-Engine-Spiel: kein Zustand, kein catchUp', async () => {
    const { result } = await renderAndFlush();
    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    const catchUp = vi.spyOn(ctx.engine, 'catchUp');

    act(() => {
      latestOnMatchChange()(OLD_MATCH_ID, { id: OLD_MATCH_ID, homeScore: 5, awayScore: 0 } as unknown as LiveMatch);
    });

    expect(catchUp).not.toHaveBeenCalled();
    expect(result.current.liveMatches.has(OLD_MATCH_ID)).toBe(false);
  });

  it('A4: ein fehlgeschlagenes catchUp wird gemeldet (captureFeatureError), nicht verschluckt', async () => {
    const { result } = await renderAndFlush();
    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    const failure = new Error('IndexedDB kaputt');
    vi.spyOn(ctx.engine, 'catchUp').mockRejectedValueOnce(failure);
    const before = result.current.liveMatches.get(ENGINE_MATCH_ID);

    act(() => {
      latestOnMatchChange()(ENGINE_MATCH_ID, { ...before } as LiveMatch);
    });

    await waitFor(() => {
      expect(mockCaptureFeatureError).toHaveBeenCalledWith(failure, 'hooks', 'cockpitCatchUp', { matchId: ENGINE_MATCH_ID });
    });
  });
});
