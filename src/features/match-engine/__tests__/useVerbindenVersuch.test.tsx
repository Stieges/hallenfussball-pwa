/**
 * useVerbindenVersuch (@SL-168): wie `useVerbinden` (reconnect + resyncNow je einmal), meldet aber `laeuft` – mindestens 1,2 s, auch wenn der
 * Versuch sofort scheitert –, und ein zweites Tippen während des Versuchs startet keinen zweiten.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVerbindenVersuch, MINDESTDAUER_MS } from '../useVerbindenVersuch';

const reconnect = vi.fn();
const resyncNow = vi.fn();
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ reconnect }) }));
vi.mock('../useResyncNow', () => ({ useResyncNow: () => resyncNow }));

describe('useVerbindenVersuch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reconnect.mockReset().mockResolvedValue(false);
    resyncNow.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('@SL-168 vor dem Tippen läuft nichts; Tippen ruft reconnect und resyncNow je einmal auf und setzt laeuft', async () => {
    const { result } = renderHook(() => useVerbindenVersuch());
    expect(result.current.laeuft).toBe(false);
    expect(reconnect).not.toHaveBeenCalled();
    act(() => { result.current.verbinde(); });
    expect(result.current.laeuft).toBe(true);
    await act(async () => { await Promise.resolve(); });
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(resyncNow).toHaveBeenCalledTimes(1);
  });

  it('@SL-168 ein sofort gescheiterter Versuch bleibt mindestens die Mindestdauer sichtbar, danach ist laeuft wieder aus', async () => {
    reconnect.mockRejectedValue(new Error('kein Netz'));
    const { result } = renderHook(() => useVerbindenVersuch());
    act(() => { result.current.verbinde(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(MINDESTDAUER_MS - 100); });
    expect(result.current.laeuft).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(result.current.laeuft).toBe(false);
  });

  it('@SL-168 Gegenbeispiel: ein zweites Tippen während des Versuchs startet keinen zweiten; danach geht es wieder', async () => {
    const { result } = renderHook(() => useVerbindenVersuch());
    act(() => { result.current.verbinde(); });
    act(() => { result.current.verbinde(); });
    await act(async () => { await Promise.resolve(); });
    expect(reconnect).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(MINDESTDAUER_MS + 100); });
    act(() => { result.current.verbinde(); });
    await act(async () => { await Promise.resolve(); });
    expect(reconnect).toHaveBeenCalledTimes(2);
  });
});
