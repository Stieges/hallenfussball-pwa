/**
 * usePolling (B-15): 10 Sekunden im Vordergrund, im Hintergrund gar nicht (@ZM-021, @ZM-029, @ZM-030, @ZM-031, @ZM-037).
 * Fake-Timer; die Sichtbarkeit der Seite wird über `document.visibilityState` und das Ereignis `visibilitychange` gesteuert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from '../usePolling';

const INTERVAL = 10_000;

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@ZM-021 ruft sofort ab und danach alle 10 Sekunden, höchstens 6 Anfragen in einer Minute', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(0);
    expect(task).toHaveBeenCalledTimes(1);

    await advance(INTERVAL - 1);
    expect(task).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(task).toHaveBeenCalledTimes(2);

    await advance(50_000);
    // sofort + 6 Takte in 60 Sekunden: nach der ersten Minute sind es 7 Aufrufe, in jeder Minute danach 6
    expect(task).toHaveBeenCalledTimes(7);
  });

  it.each([
    ['Mama Petra sperrt ihr Handy', 'hidden'],
    ['Mama Petra wechselt in eine andere App', 'hidden'],
    ['Mama Petra wechselt im Browser auf einen anderen Tab', 'hidden'],
  ] as const)('@ZM-029 %s: von 14:20 bis 14:40 (20 Minuten) kein Abruf', async (_lage, state) => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(0);
    expect(task).toHaveBeenCalledTimes(1);

    setVisibility(state);
    await advance(20 * 60 * 1000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('@ZM-029 Gegenbeispiel: im Vordergrund wird in denselben 20 Minuten abgerufen', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(20 * 60 * 1000);
    expect(task.mock.calls.length).toBeGreaterThanOrEqual(120);
  });

  it('@ZM-030 @ZM-031 kommt die Seite in den Vordergrund, wird sofort abgerufen und der Takt läuft weiter', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(0);
    setVisibility('hidden');
    await advance(20 * 60 * 1000);
    expect(task).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await advance(0);
    expect(task).toHaveBeenCalledTimes(2);

    await advance(INTERVAL);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('@ZM-037 kommt das Netz zurück, wird sofort abgerufen', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(0);
    expect(task).toHaveBeenCalledTimes(1);

    await act(async () => { window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0); });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('startet keinen zweiten Abruf, solange der erste läuft', async () => {
    let finish: () => void = () => undefined;
    const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(3 * INTERVAL);
    expect(task).toHaveBeenCalledTimes(1);

    await act(async () => { finish(); await vi.advanceTimersByTimeAsync(0); });
    await advance(INTERVAL);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('ein werfender Abruf hält den Takt nicht an', async () => {
    const task = vi.fn().mockRejectedValue(new Error('netz weg'));
    renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(2 * INTERVAL);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('pollNow ruft sofort ab und teilt sich einen laufenden Abruf', async () => {
    let finish: () => void = () => undefined;
    const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(0);
    const first = result.current.pollNow();
    const second = result.current.pollNow();
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await first; await second; });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('ausgeschaltet: kein Abruf und kein Takt', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    renderHook(() => usePolling({ task, intervalMs: INTERVAL, enabled: false }));
    await advance(5 * INTERVAL);
    expect(task).not.toHaveBeenCalled();
  });

  it('nach dem Entfernen der Seite wird nicht mehr abgerufen', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => usePolling({ task, intervalMs: INTERVAL }));
    await advance(0);
    unmount();
    await advance(5 * INTERVAL);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
