/**
 * B-16d2 Gegenbeispiel: Heartbeat-Hook (Fake-Timer). Ohne Monitor kein Aufruf, 30-s-Takt,
 * ein RPC-Fehler wird pro Mount einmal an Sentry gemeldet.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { rpc, captureFeatureError } = vi.hoisted(() => ({
  rpc: vi.fn(),
  captureFeatureError: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError }));

import { useMonitorHeartbeat } from '../useMonitorHeartbeat';

const heartbeatCalls = () => rpc.mock.calls.filter(([name]) => name === 'record_monitor_heartbeat').length;

async function vorspulen(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMonitorHeartbeat', () => {
  it('ohne Monitor oder Turnier kein Aufruf', async () => {
    renderHook(() => useMonitorHeartbeat(null, 'tour-1', 0, 'fresh'));
    renderHook(() => useMonitorHeartbeat('mon-1', null, 0, 'fresh'));
    await vorspulen(60_000);
    expect(heartbeatCalls()).toBe(0);
  });

  it('mit Monitor: sofort ein Aufruf, dann 1 bei 30 000 ms (nicht bei 29 999 ms)', async () => {
    renderHook(() => useMonitorHeartbeat('mon-1', 'tour-1', 0, 'fresh'));
    await vorspulen(0);
    expect(heartbeatCalls()).toBe(1);

    await vorspulen(29_999);
    expect(heartbeatCalls()).toBe(1);
    await vorspulen(1);
    expect(heartbeatCalls()).toBe(2);
  });

  it('RPC-Fehler meldet captureFeatureError genau einmal', async () => {
    rpc.mockResolvedValue({ error: { message: 'boom' } });
    renderHook(() => useMonitorHeartbeat('mon-1', 'tour-1', 0, 'fresh'));
    await vorspulen(60_000);
    expect(heartbeatCalls()).toBe(3);
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
    expect(captureFeatureError).toHaveBeenCalledWith(new Error('heartbeat failed: boom'), 'monitor', 'heartbeat');
  });
});
