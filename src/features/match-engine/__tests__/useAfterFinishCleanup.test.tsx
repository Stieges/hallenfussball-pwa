/**
 * R3-2b (Review #392 M2; @FU-018): `useAfterFinishCleanup` schließt die „an die Turnierleitung übergebenen“ Einträge eines
 * Turniers ab, sobald der SERVER es wieder als offen meldet (`tournament_lifecycle`). Solange es abgeschlossen ist – oder der
 * Server nicht antwortet –, bleibt der Hinweis auf Toms Gerät stehen (@FU-018 Z. 3 „Toms Gerät zeigt ‚an die Turnierleitung
 * übergeben‘“). Ohne solche Einträge fragt das Gerät nichts ab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const server = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: server.rpc } }));

import { emptyOutboxStatus, type OutboxStatus } from '../../../core/match/client/outboxTypes';
import { AFTER_FINISH_CHECK_INTERVAL_MS, useAfterFinishCleanup } from '../useAfterFinishCleanup';

let status: OutboxStatus = emptyOutboxStatus();
let listener: ((s: OutboxStatus) => void) | null = null;
const closeAfterFinish = vi.fn(async (tournamentId: string) => {
  const { [tournamentId]: _weg, ...rest } = status.afterFinishByTournament;
  status = { ...status, afterFinishByTournament: rest };
});
const sender = {
  getStatus: () => status,
  subscribe: (l: (s: OutboxStatus) => void) => { listener = l; return () => { listener = null; }; },
  closeAfterFinish,
};
let serverZustand: unknown = 'finished';
let online = true;
const abfragen = () => server.rpc.mock.calls.filter(([fn]) => fn === 'tournament_lifecycle');
const weiter = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  status = { ...emptyOutboxStatus(), afterFinishByTournament: { 'live-cup': 1 } };
  serverZustand = 'finished';
  online = true;
  closeAfterFinish.mockClear();
  server.rpc.mockReset();
  server.rpc.mockImplementation(async () => (serverZustand instanceof Error ? { data: null, error: { message: 'Failed to fetch' } } : { data: serverZustand, error: null }));
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => 'visible');
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('R3-2b @FU-018 Hinweis „übergeben“ nach dem Wiederöffnen aufräumen', () => {
  it('@FU-018 Turnier am Server abgeschlossen: Toms Hinweis bleibt (auch nach weiteren Takten)', async () => {
    renderHook(() => useAfterFinishCleanup({ sender, accountId: 'tom' }));
    await weiter(0);
    await weiter(2 * AFTER_FINISH_CHECK_INTERVAL_MS);
    expect(abfragen()).toHaveLength(3);
    expect(abfragen()[0][1]).toEqual({ p_tournament_id: 'live-cup' });
    expect(closeAfterFinish).not.toHaveBeenCalled();
  });

  it('@FU-018 letzte Zeile: Olli hat (Notweg @LZ-091) wieder geöffnet – beim nächsten Takt schließt das Gerät die Einträge ab', async () => {
    renderHook(() => useAfterFinishCleanup({ sender, accountId: 'tom' }));
    await weiter(0);
    serverZustand = 'running';
    await weiter(AFTER_FINISH_CHECK_INTERVAL_MS);
    expect(closeAfterFinish).toHaveBeenCalledWith('live-cup');
    await weiter(2 * AFTER_FINISH_CHECK_INTERVAL_MS);
    expect(abfragen()).toHaveLength(2); // danach nichts mehr abzufragen
  });

  it('Gegenbeispiel: keine Antwort vom Server oder unbekanntes Turnier → der Hinweis bleibt', async () => {
    serverZustand = new Error('offline');
    renderHook(() => useAfterFinishCleanup({ sender, accountId: 'tom' }));
    await weiter(0);
    serverZustand = null;
    await weiter(AFTER_FINISH_CHECK_INTERVAL_MS);
    expect(abfragen()).toHaveLength(2);
    expect(closeAfterFinish).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ohne übergebene Einträge, ohne Netz oder als Gast fragt das Gerät nichts ab', async () => {
    status = emptyOutboxStatus();
    const ohne = renderHook(() => useAfterFinishCleanup({ sender, accountId: 'tom' }));
    await weiter(AFTER_FINISH_CHECK_INTERVAL_MS);
    ohne.unmount();
    status = { ...emptyOutboxStatus(), afterFinishByTournament: { 'live-cup': 1 } };
    online = false;
    const offline = renderHook(() => useAfterFinishCleanup({ sender, accountId: 'tom' }));
    await weiter(AFTER_FINISH_CHECK_INTERVAL_MS);
    offline.unmount();
    online = true;
    renderHook(() => useAfterFinishCleanup({ sender, accountId: 'guest' }));
    await weiter(AFTER_FINISH_CHECK_INTERVAL_MS);
    expect(server.rpc).not.toHaveBeenCalled();
  });

  it('ein neu übergebenes Turnier wird sofort geprüft, nicht erst nach 30 s', async () => {
    status = emptyOutboxStatus();
    renderHook(() => useAfterFinishCleanup({ sender, accountId: 'tom' }));
    await weiter(0);
    status = { ...emptyOutboxStatus(), afterFinishByTournament: { 'live-cup': 1 } };
    act(() => { listener?.(status); });
    await weiter(0);
    expect(abfragen()).toHaveLength(1);
  });
});
