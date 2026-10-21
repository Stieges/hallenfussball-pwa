import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoGuard, UNDO_SPERRE_MS } from '../useUndoGuard';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useUndoGuard (L4)', () => {
  it('@SL-108 ein zweiter Tipp innerhalb einer Sekunde zählt nicht', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoGuard(undo));
    act(() => { result.current(); });
    act(() => { vi.advanceTimersByTime(UNDO_SPERRE_MS - 1); result.current(); });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('@SL-107 Gegenbeispiel: ein zweiter Tipp 3 Sekunden später nimmt den nächstjüngeren zurück', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoGuard(undo));
    act(() => { result.current(); });
    act(() => { vi.advanceTimersByTime(3000); result.current(); });
    expect(undo).toHaveBeenCalledTimes(2);
  });

  it('@SL-108 genau nach der Sperre (1000 ms) zählt der nächste Tipp wieder', () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoGuard(undo));
    act(() => { result.current(); });
    act(() => { vi.advanceTimersByTime(UNDO_SPERRE_MS); result.current(); });
    expect(undo).toHaveBeenCalledTimes(2);
    expect(UNDO_SPERRE_MS).toBe(1000);
  });
});
