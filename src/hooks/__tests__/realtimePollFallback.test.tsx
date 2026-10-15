/**
 * A-08f-F (@FU-087): generischer Abfrage-Hook. `enabled` false (z. B. Gast) -> keine Abfrage,
 * auch wenn der Kanal als unterbrochen gemeldet ist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRealtimePollFallback, REALTIME_POLL_FALLBACK_INTERVAL_MS } from '../realtimePollFallback';
import { setRealtimeChannelStatus, clearRealtimeChannelStatus } from '../realtimeChannelStatus';

const KEY = 'key-fu087-generic';

describe('useRealtimePollFallback (@FU-087)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    clearRealtimeChannelStatus(KEY);
    vi.useRealTimers();
  });

  it('@FU-087 enabled=false -> keine Abfrage trotz CLOSED', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useRealtimePollFallback(KEY, false, refresh));
    act(() => setRealtimeChannelStatus(KEY, 'CLOSED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(REALTIME_POLL_FALLBACK_INTERVAL_MS * 3); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('@FU-087 Gegenbeispiel: enabled=true + CLOSED -> Abfrage im 5-s-Takt', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useRealtimePollFallback(KEY, true, refresh));
    act(() => setRealtimeChannelStatus(KEY, 'CLOSED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(REALTIME_POLL_FALLBACK_INTERVAL_MS * 2); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('@FU-087 verborgener Tab -> keine Abfrage; wieder sichtbar -> Abfrage', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    renderHook(() => useRealtimePollFallback(KEY, true, refresh));
    act(() => setRealtimeChannelStatus(KEY, 'CLOSED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(REALTIME_POLL_FALLBACK_INTERVAL_MS * 3); });
    expect(refresh).not.toHaveBeenCalled();

    visibility.mockReturnValue('visible');
    await act(async () => { await vi.advanceTimersByTimeAsync(REALTIME_POLL_FALLBACK_INTERVAL_MS); });
    expect(refresh).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });
});
