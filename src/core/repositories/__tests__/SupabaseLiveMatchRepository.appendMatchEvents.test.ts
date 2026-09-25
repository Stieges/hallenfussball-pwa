/**
 * SupabaseLiveMatchRepository.appendMatchEvents / serverTime -- typisierter Client für den
 * Server-Schreibweg (B3b, supabase/migrations/20260928_003_append_match_events.sql).
 *
 * `supabase.rpc` ist gemockt: Erfolg, CLIENT_OUTDATED, RPC-/Netzfehler und unerwartete Antworten.
 * Die RPC selbst beweist scripts/append-match-events-check.sh im Container.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryError } from '../../errors';
import type { AppendableEvent } from '../appendMatchEventsRpc';
import { isClientOutdated } from '../appendMatchEventsRpc';

const hoisted = vi.hoisted(() => {
  const rpcMock = vi.fn();
  return { rpcMock, supabaseMock: { rpc: rpcMock } };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

const { rpcMock } = hoisted;

const MATCH_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_A = '22222222-2222-4222-8222-222222222222';
const TEAM_B = '33333333-3333-4333-8333-333333333333';
const EVENT_ID = '44444444-4444-4444-8444-444444444444';

const goal: AppendableEvent = {
  id: EVENT_ID,
  type: 'GOAL',
  at: 1_790_000_000_000,
  section: 1,
  clockMs: 61_000,
  teamId: TEAM_A,
  payload: { playerNumber: 7 },
};

const serverState = {
  status: 'running',
  phase: 'regular',
  section: 1,
  clock: { running: true, elapsedMs: 0, anchorAt: 1_790_000_000_000 },
  scores: {
    [TEAM_A]: { regular: 1, overtime: 0, shootout: 0 },
    [TEAM_B]: { regular: 0, overtime: 0, shootout: 0 },
  },
  effectiveScores: { [TEAM_A]: 1, [TEAM_B]: 0 },
  shootoutKicks: [],
  lastScoreEventId: EVENT_ID,
  decidedBy: null,
  finishedAt: null,
};

describe('SupabaseLiveMatchRepository.appendMatchEvents (B3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ruft append_match_events mit Spiel, Ereignissen, Client-Format und Geräte-ID auf und liefert das typisierte Ergebnis', async () => {
    rpcMock.mockResolvedValue({
      data: { results: [{ id: EVENT_ID, status: 'accepted', seq: 42 }], state: serverState, serverTime: 1_790_000_000_500 },
      error: null,
    });
    const repo = new SupabaseLiveMatchRepository();

    const result = await repo.appendMatchEvents(MATCH_ID, [goal], { clientFormat: 1, deviceId: TEAM_B });

    expect(rpcMock).toHaveBeenCalledWith('append_match_events', {
      p_match_id: MATCH_ID,
      p_events: [goal],
      p_client_format: 1,
      p_device_id: TEAM_B,
    });
    expect(isClientOutdated(result)).toBe(false);
    if (isClientOutdated(result)) {
      return;
    }
    expect(result.results).toEqual([{ id: EVENT_ID, status: 'accepted', seq: 42 }]);
    expect(result.state?.effectiveScores[TEAM_A]).toBe(1);
    expect(result.serverTime).toBe(1_790_000_000_500);
  });

  it('lässt p_device_id weg, wenn keine Geräte-ID angegeben ist, und akzeptiert state null (kein Schreibrecht)', async () => {
    rpcMock.mockResolvedValue({
      data: { results: [{ id: EVENT_ID, status: 'rejected', code: 'FORBIDDEN_ACTOR' }], state: null, serverTime: 5 },
      error: null,
    });
    const repo = new SupabaseLiveMatchRepository();

    const result = await repo.appendMatchEvents(MATCH_ID, [goal], { clientFormat: 1 });

    expect(rpcMock.mock.calls[0][1]).not.toHaveProperty('p_device_id');
    expect(result).toEqual({ results: [{ id: EVENT_ID, status: 'rejected', code: 'FORBIDDEN_ACTOR' }], state: null, serverTime: 5 });
  });

  it('liefert CLIENT_OUTDATED als eigenes Ergebnis statt als Fehler', async () => {
    rpcMock.mockResolvedValue({
      data: { error: 'CLIENT_OUTDATED', minClientFormat: 2, serverTime: 7 },
      error: null,
    });
    const repo = new SupabaseLiveMatchRepository();

    const result = await repo.appendMatchEvents(MATCH_ID, [goal], { clientFormat: 1 });

    expect(isClientOutdated(result)).toBe(true);
    expect(result).toEqual({ error: 'CLIENT_OUTDATED', minClientFormat: 2, serverTime: 7 });
  });

  it('wirft RepositoryError, wenn die RPC einen Fehler meldet (z. B. kein EXECUTE, 42501)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied for function append_match_events', code: '42501' } });
    const repo = new SupabaseLiveMatchRepository();

    const call = repo.appendMatchEvents(MATCH_ID, [goal], { clientFormat: 1 });

    await expect(call).rejects.toBeInstanceOf(RepositoryError);
    await expect(call).rejects.toMatchObject({ operation: 'appendMatchEvents', message: 'permission denied for function append_match_events' });
  });

  it('wirft RepositoryError bei einem Netzfehler (rpc wirft)', async () => {
    const networkError = new TypeError('Failed to fetch');
    rpcMock.mockRejectedValue(networkError);
    const repo = new SupabaseLiveMatchRepository();

    const call = repo.appendMatchEvents(MATCH_ID, [goal], { clientFormat: 1 });

    await expect(call).rejects.toBeInstanceOf(RepositoryError);
    await expect(call).rejects.toMatchObject({ operation: 'appendMatchEvents', originalError: networkError });
  });

  it('wirft RepositoryError bei einer unerwarteten Antwortform', async () => {
    rpcMock.mockResolvedValue({ data: { results: [{ id: EVENT_ID, status: 'weird' }], state: null, serverTime: 1 }, error: null });
    const repo = new SupabaseLiveMatchRepository();

    await expect(repo.appendMatchEvents(MATCH_ID, [goal], { clientFormat: 1 })).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe('SupabaseLiveMatchRepository.serverTime (B3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert die Serverzeit in Epoch-ms aus server_time', async () => {
    rpcMock.mockResolvedValue({ data: { serverTime: 1_790_000_000_123 }, error: null });
    const repo = new SupabaseLiveMatchRepository();

    await expect(repo.serverTime()).resolves.toBe(1_790_000_000_123);
    expect(rpcMock).toHaveBeenCalledWith('server_time');
  });

  it('wirft RepositoryError bei Netzfehler und bei RPC-Fehler', async () => {
    const repo = new SupabaseLiveMatchRepository();

    rpcMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(repo.serverTime()).rejects.toMatchObject({ name: 'RepositoryError', operation: 'serverTime' });

    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(repo.serverTime()).rejects.toMatchObject({ name: 'RepositoryError', message: 'boom' });
  });
});
