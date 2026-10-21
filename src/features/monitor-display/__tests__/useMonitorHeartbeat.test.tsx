/**
 * B-16d2 / B-48b: Heartbeat-Hook (Fake-Timer). Ohne Monitor kein Aufruf, 30-s-Takt, ein RPC-Fehler wird pro Mount
 * einmal an Sentry gemeldet. B-48b (Befund C-HEARTBEAT): Kennung als Text (`p_monitor_key`), Wachhalten-Zustand
 * (`p_wake_lock`), Zustandswechsel sofort, Takt nicht neu gestartet.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WakeLockStatus } from '../../../hooks/useWakeLock';

const { rpc, captureFeatureError } = vi.hoisted(() => ({
  rpc: vi.fn(),
  captureFeatureError: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError }));

import { HEARTBEAT_INTERVAL_MS, useMonitorHeartbeat } from '../useMonitorHeartbeat';

type Args = Record<string, unknown>;
const heartbeatArgs = (): Args[] =>
  rpc.mock.calls.filter(([name]) => name === 'record_monitor_heartbeat').map(([, args]) => args as Args);
const heartbeatCalls = () => heartbeatArgs().length;
const letzteMeldung = () => heartbeatArgs().at(-1)?.p_wake_lock;

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

interface Props { status: WakeLockStatus; folie: number }
function renderMonitor(start: Props) {
  return renderHook(
    ({ status, folie }: Props) => useMonitorHeartbeat('mon-halle', 'tour-1', folie, 'fresh', status),
    { initialProps: start },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
  window.location.hash = '';
});

afterEach(() => {
  vi.useRealTimers();
  window.location.hash = '';
});

describe('useMonitorHeartbeat', () => {
  it('ohne Monitor oder Turnier kein Aufruf', async () => {
    renderHook(() => useMonitorHeartbeat(null, 'tour-1', 0, 'fresh', 'granted'));
    renderHook(() => useMonitorHeartbeat('mon-1', null, 0, 'fresh', 'granted'));
    await vorspulen(60_000);
    expect(heartbeatCalls()).toBe(0);
  });

  it('mit Monitor: sofort ein Aufruf, dann 1 bei 30 000 ms (nicht bei 29 999 ms)', async () => {
    renderHook(() => useMonitorHeartbeat('mon-1', 'tour-1', 0, 'fresh', 'idle'));
    await vorspulen(0);
    expect(heartbeatCalls()).toBe(1);

    await vorspulen(29_999);
    expect(heartbeatCalls()).toBe(1);
    await vorspulen(1);
    expect(heartbeatCalls()).toBe(2);
    expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
  });

  it('RPC-Fehler meldet captureFeatureError genau einmal', async () => {
    rpc.mockResolvedValue({ error: { message: 'boom' } });
    renderHook(() => useMonitorHeartbeat('mon-1', 'tour-1', 0, 'fresh', 'idle'));
    await vorspulen(60_000);
    expect(heartbeatCalls()).toBe(3);
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
    expect(captureFeatureError).toHaveBeenCalledWith(new Error('heartbeat failed: boom'), 'monitor', 'heartbeat');
  });

  it('@ME-027:teil fällt das Netz aus (Aufruf wirft), meldet der Hook einmal und sendet im Takt weiter', async () => {
    rpc.mockRejectedValue(new Error('Failed to fetch'));
    renderHook(() => useMonitorHeartbeat('mon-1', 'tour-1', 0, 'fresh', 'granted'));
    await vorspulen(60_000);
    expect(heartbeatCalls()).toBe(3);
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
    expect(captureFeatureError).toHaveBeenCalledWith(new Error('heartbeat failed: Failed to fetch'), 'monitor', 'heartbeat');
  });

  it('@ME-064:teil Befund C-HEARTBEAT: sendet die Kennung aus config.monitors als Text und den Wachhalten-Zustand', async () => {
    renderMonitor({ status: 'granted', folie: 2 });
    await vorspulen(0);
    expect(heartbeatArgs()).toEqual([{
      p_monitor_key: 'mon-halle',
      p_tournament_id: 'tour-1',
      p_slide_index: 2,
      p_cache_status: 'fresh',
      p_user_agent: navigator.userAgent,
      p_wake_lock: 'granted',
    }]);
    expect(heartbeatArgs()[0]).not.toHaveProperty('p_monitor_id');
  });

  it('@ME-064:teil Zustandswechsel zugesagt → freigegeben sendet sofort, der 30-s-Takt läuft unverändert weiter', async () => {
    const { rerender } = renderMonitor({ status: 'granted', folie: 0 });
    await vorspulen(10_000);
    expect(heartbeatCalls()).toBe(1);

    rerender({ status: 'released', folie: 0 });
    await vorspulen(0);
    expect(heartbeatCalls()).toBe(2);
    expect(letzteMeldung()).toBe('released');

    // Takt seit dem Start: nächster Aufruf bei 30 s, nicht 30 s nach dem Wechsel
    await vorspulen(19_999);
    expect(heartbeatCalls()).toBe(2);
    await vorspulen(1);
    expect(heartbeatCalls()).toBe(3);
    expect(letzteMeldung()).toBe('released');
  });

  it('@ME-064:teil Nachtrag 17.10.: zugesagt → freigegeben → abgelehnt meldet „zwischenzeitlich freigegeben“', async () => {
    const { rerender } = renderMonitor({ status: 'granted', folie: 0 });
    await vorspulen(0);
    rerender({ status: 'released', folie: 0 });
    await vorspulen(0);
    rerender({ status: 'pending', folie: 0 });
    await vorspulen(0);
    rerender({ status: 'denied', folie: 0 });
    await vorspulen(0);
    expect(heartbeatArgs().map((a) => a.p_wake_lock)).toEqual(['granted', 'released']);
    await vorspulen(HEARTBEAT_INTERVAL_MS);
    expect(letzteMeldung()).toBe('released');
  });

  it('@ME-064:teil keine Antwort nach 5 s: Wechsel von „unbekannt“ auf no_answer sofort, nie als zugesagt', async () => {
    const { rerender } = renderMonitor({ status: 'pending', folie: 0 });
    await vorspulen(0);
    expect(letzteMeldung()).toBeNull();
    rerender({ status: 'noAnswer', folie: 0 });
    await vorspulen(0);
    expect(heartbeatArgs().map((a) => a.p_wake_lock)).toEqual([null, 'no_answer']);
  });

  it('@ME-026:teil als Browser-Quelle meldet sich der Monitor (verbunden) mit „Wachhalten entfällt“', async () => {
    window.location.hash = '#/tv';
    renderMonitor({ status: 'denied', folie: 0 });
    await vorspulen(0);
    expect(heartbeatCalls()).toBe(1);
    expect(letzteMeldung()).toBe('not_applicable');
  });

  it('Gegenbeispiel C-MON-HEARTBEAT-TAKT: ein Folienwechsel sendet nicht und startet den Takt nicht neu', async () => {
    const { rerender } = renderMonitor({ status: 'granted', folie: 0 });
    await vorspulen(10_000);
    rerender({ status: 'granted', folie: 1 });
    await vorspulen(0);
    expect(heartbeatCalls()).toBe(1);
    await vorspulen(20_000);
    expect(heartbeatCalls()).toBe(2);
    expect(heartbeatArgs()[1].p_slide_index).toBe(1);
  });

  it('Gegenbeispiel: ein Wechsel ohne andere Meldung (läuft → nicht angefordert) sendet nicht zusätzlich', async () => {
    const { rerender } = renderMonitor({ status: 'pending', folie: 0 });
    await vorspulen(0);
    rerender({ status: 'idle', folie: 0 });
    await vorspulen(0);
    expect(heartbeatCalls()).toBe(1);
  });
});
