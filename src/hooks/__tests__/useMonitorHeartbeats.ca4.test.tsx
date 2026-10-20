/**
 * CA-4 (Paket Co-Admin, Befund C-HEARTBEAT-NUR-EIGENTUEMER, @ME-070): Verbraucherseite des Verbindungsstatus.
 * „Online“ bei last_seen < 60 s, „Instabil“ < 90 s, danach „Offline“ (Schwellen des Hooks). Ein Realtime-Ereignis mit
 * neuem last_seen hebt „Offline“ auf „Online“. Ohne Turnier-Kennung (Rolle ohne manageScreens, siehe
 * MonitorsConfigTab) gibt es weder Abfrage noch Abo. Was der Server liefert, entscheidet die Policy (CA-2, RLS-Matrix);
 * liefert er 0 Zeilen (Helfer), bleibt die Karte leer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => {
  const state = {
    rows: [] as Array<{ monitor_id: string; last_seen: string; slide_index: number | null; cache_status: string | null }>,
    realtime: undefined as undefined | ((payload: { new: Record<string, unknown> }) => void),
  };
  const eqMock = vi.fn(() => Promise.resolve({ data: state.rows, error: null }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const subscribeMock = vi.fn(() => ({}));
  const onMock = vi.fn((_type: string, _filter: unknown, cb: (payload: { new: Record<string, unknown> }) => void) => {
    state.realtime = cb;
    return { subscribe: subscribeMock };
  });
  const channelMock = vi.fn((_name: string) => ({ on: onMock }));
  const removeChannelMock = vi.fn();
  return { state, eqMock, selectMock, fromMock, subscribeMock, onMock, channelMock, removeChannelMock };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: hoisted.fromMock, channel: hoisted.channelMock, removeChannel: hoisted.removeChannelMock },
}));

import { useMonitorHeartbeats } from '../useMonitorHeartbeats';

const NOW = new Date('2026-11-28T10:00:00.000Z').getTime();
const ago = (seconds: number): string => new Date(NOW - seconds * 1000).toISOString();

describe('CA-4 useMonitorHeartbeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    hoisted.state.rows = [];
    hoisted.state.realtime = undefined;
  });
  afterEach(() => { vi.useRealTimers(); });

  async function render(tournamentId: string | undefined) {
    const view = renderHook(() => useMonitorHeartbeats(tournamentId));
    await act(async () => { await Promise.resolve(); });
    return view;
  }

  it('@ME-070: Status aus last_seen – Online < 60 s, Instabil < 90 s, danach Offline', async () => {
    hoisted.state.rows = [
      { monitor_id: 'm-online', last_seen: ago(59), slide_index: 2, cache_status: null },
      { monitor_id: 'm-stale', last_seen: ago(60), slide_index: null, cache_status: null },
      { monitor_id: 'm-stale-2', last_seen: ago(89), slide_index: null, cache_status: null },
      { monitor_id: 'm-offline', last_seen: ago(90), slide_index: null, cache_status: null },
    ];
    const { result } = await render('T');

    expect(result.current.get('m-online')?.status).toBe('online');
    expect(result.current.get('m-stale')?.status).toBe('stale');
    expect(result.current.get('m-stale-2')?.status).toBe('stale');
    expect(result.current.get('m-offline')?.status).toBe('offline');
    expect(hoisted.eqMock).toHaveBeenCalledWith('tournament_id', 'T');
  });

  it('der Status altert ohne neue Daten (online → stale → offline)', async () => {
    hoisted.state.rows = [{ monitor_id: 'm1', last_seen: ago(0), slide_index: null, cache_status: null }];
    const { result } = await render('T');
    expect(result.current.get('m1')?.status).toBe('online');

    await act(async () => { await vi.advanceTimersByTimeAsync(75_000); });
    expect(result.current.get('m1')?.status).toBe('stale');
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(result.current.get('m1')?.status).toBe('offline');
  });

  it('ein Realtime-Ereignis mit neuem last_seen hebt „Offline“ auf „Online“', async () => {
    hoisted.state.rows = [{ monitor_id: 'm1', last_seen: ago(300), slide_index: null, cache_status: null }];
    const { result } = await render('T');
    expect(result.current.get('m1')?.status).toBe('offline');

    act(() => {
      hoisted.state.realtime?.({ new: { monitor_id: 'm1', last_seen: new Date(Date.now()).toISOString(), slide_index: 1, cache_status: 'ok' } });
    });

    expect(result.current.get('m1')).toMatchObject({ status: 'online', slideIndex: 1, cacheStatus: 'ok' });
    expect(hoisted.onMock).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ table: 'monitor_heartbeats', filter: 'tournament_id=eq.T' }), expect.any(Function));
  });

  it('Gegenbeispiel Helfer: liefert der Server 0 Zeilen (RLS), bleibt die Karte leer', async () => {
    hoisted.state.rows = [];
    const { result } = await render('T');
    expect(result.current.size).toBe(0);
  });

  it('Gegenbeispiel Helfer: ohne Turnier-Kennung keine Abfrage und kein Abo', async () => {
    const { result } = await render(undefined);
    expect(result.current.size).toBe(0);
    expect(hoisted.fromMock).not.toHaveBeenCalled();
    expect(hoisted.channelMock).not.toHaveBeenCalled();
  });

  it('beim Verlassen wird das Abo geschlossen', async () => {
    const { unmount } = await render('T');
    unmount();
    expect(hoisted.removeChannelMock).toHaveBeenCalledTimes(1);
  });
});
