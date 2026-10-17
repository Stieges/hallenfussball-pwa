/**
 * Regeln des Wachhalten-Hinweises ohne Seite (B-48a Fixrunde 4, @ME-006): Zustand der Zusage, laufendes Spiel, Browser-Quelle.
 * Das Spiel-Gate wird hier sofort geprüft (A1): Läuft beim Start ein Spiel, gibt es von Anfang an keinen Hinweis.
 * Der Folientyp ist Sache der Seite (`istHinweisFolie`, Test unten), die 10 Sekunden gehören dem Hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWakeLockHinweis } from '../useWakeLockHinweis';
import { istHinweisFolie } from '../monitorDauerbetrieb';

beforeEach(() => {
  window.history.replaceState(null, '', '/#/display/t/m');
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe('useWakeLockHinweis (@ME-006)', () => {
  it.each(['denied', 'unsupported', 'noAnswer'] as const)('Zustand „%s“ ohne laufendes Spiel: der Hinweis steht sofort, nach 10 Sekunden nicht mehr', (status) => {
    const { result } = renderHook(() => useWakeLockHinweis(status, true, false));
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(9_999); });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });

  it.each(['denied', 'unsupported', 'noAnswer'] as const)('Gegenbeispiel, Zustand „%s“: läuft beim Start ein Spiel, gibt es sofort und danach nie einen Hinweis', (status) => {
    const { result } = renderHook(() => useWakeLockHinweis(status, true, true));
    expect(result.current).toBe(false);
    for (let s = 1; s <= 11; s += 1) {
      act(() => { vi.advanceTimersByTime(1_000); });
      expect(result.current, `${s} s`).toBe(false);
    }
  });

  it('startet während der 10 Sekunden ein Spiel, verschwindet der Hinweis sofort und kommt nicht wieder', () => {
    const { result, rerender } = renderHook(({ spiel }) => useWakeLockHinweis('denied', true, spiel), { initialProps: { spiel: false } });
    expect(result.current).toBe(true);
    rerender({ spiel: true });
    expect(result.current).toBe(false);
    rerender({ spiel: false });
    expect(result.current).toBe(false);
  });

  it.each(['idle', 'pending', 'granted', 'released'] as const)('Gegenbeispiel, Zustand „%s“: kein Hinweis', (status) => {
    const { result } = renderHook(() => useWakeLockHinweis(status, true, false));
    expect(result.current).toBe(false);
  });

  it('Gegenbeispiel: in der Browser-Quelle (/tv) nie ein Hinweis', () => {
    window.history.replaceState(null, '', '/#/tv');
    const { result } = renderHook(() => useWakeLockHinweis('denied', true, false));
    expect(result.current).toBe(false);
  });
});

describe('istHinweisFolie (@ME-006)', () => {
  it.each(['custom-text', 'qr-code'])('„%s“ ist eine Einrichtungs- oder QR-Folie', (type) => {
    expect(istHinweisFolie({ type })).toBe(true);
  });

  it.each(['live', 'standings', 'all-standings', 'schedule-field', 'next-matches', 'sponsor'])('Gegenbeispiel: „%s“ nie', (type) => {
    expect(istHinweisFolie({ type })).toBe(false);
  });

  it('ohne Folie kein Hinweis', () => {
    expect(istHinweisFolie(null)).toBe(false);
  });
});
