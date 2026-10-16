/**
 * Hooks des Monitor-Dauerbetriebs (B-17): Mauszeiger nach Ruhe, Abfangen der Tasten.
 * Gegenbeispiele: Escape und Leertaste werden abgefangen (Standardaktion unterdrückt), Ruhe blendet den Zeiger
 * aus, Bewegung blendet ihn wieder ein.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCursor, useTastenAbfang, useWakeLockNachEingabe } from '../useMonitorDauerbetrieb';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useIdleCursor (@ME-002)', () => {
  it('zeigt den Mauszeiger am Anfang, blendet ihn nach der Ruhe-Zeit aus', () => {
    const { result } = renderHook(() => useIdleCursor(3_000));
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(2_999); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
  });

  it('Gegenbeispiel: jede Mausbewegung zeigt den Zeiger wieder und startet die Ruhe-Zeit neu', () => {
    const { result } = renderHook(() => useIdleCursor(3_000));
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(result.current).toBe(true);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(2_000); });
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(result.current).toBe(true);
  });

  it('Gegenbeispiel: ein Tipp auf den Bildschirm zeigt den Zeiger wieder', () => {
    const { result } = renderHook(() => useIdleCursor(3_000));
    act(() => { vi.advanceTimersByTime(3_000); });
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    expect(result.current).toBe(false);
  });
});

describe('useTastenAbfang (@ME-003, @ME-022)', () => {
  it('Escape, Leertaste, Backspace und Pfeile: Standardaktion wird unterdrückt', () => {
    renderHook(() => useTastenAbfang());
    for (const key of ['Escape', ' ', 'Backspace', 'ArrowLeft', 'ArrowRight']) {
      const e = new KeyboardEvent('keydown', { key, cancelable: true });
      window.dispatchEvent(e);
      expect(e.defaultPrevented, key).toBe(true);
    }
  });

  it('Gegenbeispiel: andere Tasten bleiben unberührt', () => {
    renderHook(() => useTastenAbfang());
    const e = new KeyboardEvent('keydown', { key: 'c', cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('räumt den Listener beim Aufräumen weg', () => {
    const { unmount } = renderHook(() => useTastenAbfang());
    unmount();
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe('useWakeLockNachEingabe (B-17 Fixrunde 2)', () => {
  it('fordert nach der ersten Eingabe einmal erneut an, wenn die Anfrage fehlgeschlagen ist', () => {
    const anfordern = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useWakeLockNachEingabe('Wake Lock konnte nicht aktiviert werden', anfordern));
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })); });
    expect(anfordern).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne Fehler wird bei Eingaben nichts angefordert', () => {
    const anfordern = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useWakeLockNachEingabe(null, anfordern));
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    expect(anfordern).not.toHaveBeenCalled();
  });
});
