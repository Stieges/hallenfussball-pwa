/** B-16c – useSlideshow: Übergang nach Takt, Unmount mitten im Übergang, Index-Klemme. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MonitorSlide } from '../../../types/monitor';
import type { SlideProgram } from '../slideProgramme';
import { useSlideshow } from '../useSlideshow';

const folie = (id: string) => ({ id, type: 'custom-text', config: {}, duration: null, order: 0 }) as MonitorSlide;
const zweiFolien: SlideProgram = { slides: [folie('A'), folie('B')], defaultDurationSec: 15 };

// Vorspulen in 1-s-Schritten: zwischen den Schritten rendert React und plant den nächsten Takt neu.
const vorspulen = async (ms: number) => {
  for (let i = 0; i < ms / 1_000; i++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  }
};

describe('useSlideshow (B-16c)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('Übergang: nach 15 s läuft fade, der Index wechselt erst nach der Übergangsdauer', async () => {
    const { result } = renderHook(() => useSlideshow(zweiFolien, 500));
    await vorspulen(15_000);
    expect(result.current.slideState).toMatchObject({ currentIndex: 0, isTransitioning: true, direction: 'next' });
    await act(async () => { await vi.advanceTimersByTimeAsync(499); });
    expect(result.current.slideState.currentIndex).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.slideState).toMatchObject({ currentIndex: 1, isTransitioning: false });
  });

  it('Unmount mitten im Übergang: kein Timer bleibt übrig', async () => {
    const { result, unmount } = renderHook(() => useSlideshow(zweiFolien, 500));
    await vorspulen(15_000);
    expect(result.current.slideState.isTransitioning).toBe(true);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Index-Klemme: schrumpft die Folienliste, zeigt der Hook die letzte vorhandene Folie', async () => {
    const { result, rerender } = renderHook(
      ({ p }: { p: SlideProgram }) => useSlideshow(p, null),
      { initialProps: { p: { slides: [folie('A'), folie('B'), folie('C')], defaultDurationSec: 15 } } },
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await vorspulen(30_000);
    expect(result.current.slideState.currentIndex).toBe(2);

    rerender({ p: { slides: [folie('A')], defaultDurationSec: 15 } });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.slideState.currentIndex).toBe(0);
  });
});
