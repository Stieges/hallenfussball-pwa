/**
 * useCockpitNotices – Meldezeile mit Vorrang und Dauer (Cockpit-Spec § 7).
 * Testwerte aus @SL-034, @SL-098, @SL-096, @SL-122 und C-COCKPIT-TOASTS-HANDY.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpitNotices, NOTICE_DAUER_MS } from '../useCockpitNotices';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useCockpitNotices – Meldezeile (Spec § 7)', () => {
  it('die Dauern: Stufe 1 = 6 s, Stufe 2 = 5 s, Stufe 3 = 3 s', () => {
    expect(NOTICE_DAUER_MS).toEqual({ 1: 6000, 2: 5000, 3: 3000 });
  });

  it('C-COCKPIT-TOASTS-HANDY: eine Bestätigung (Stufe 3) verschwindet nach 3 s, auch wenn die Uhr jede Sekunde neu zeichnet', () => {
    const { result, rerender } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(3, 'Tor für FC Nord'));
    for (let s = 0; s < 2; s++) { act(() => { vi.advanceTimersByTime(1000); }); rerender(); }
    expect(result.current.aktuell?.text).toBe('Tor für FC Nord');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.aktuell).toBeNull();
  });

  it('@SL-034 die Foul-Grenze (Stufe 2) ersetzt eine Bestätigung sofort; die Bestätigung kommt nicht zurück', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(3, 'Foul für SV Süd'));
    act(() => result.current.melde(2, 'SV Süd: 5. Foul in dieser Halbzeit'));
    expect(result.current.aktuell?.text).toBe('SV Süd: 5. Foul in dieser Halbzeit');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.aktuell).toBeNull();
  });

  it('@SL-034 eine Stufe-2-Meldung unter dem Wachhalten-Hinweis wartet höchstens dessen 6 s und erscheint dann', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(1, 'Bildschirm kann sich sperren – die Uhr läuft weiter'));
    act(() => result.current.melde(2, 'SV Süd: 5. Foul in dieser Halbzeit'));
    expect(result.current.aktuell?.stufe).toBe(1);
    act(() => { vi.advanceTimersByTime(5999); });
    expect(result.current.aktuell?.stufe).toBe(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.aktuell?.text).toBe('SV Süd: 5. Foul in dieser Halbzeit');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.aktuell).toBeNull();
  });

  it('@SL-098 von mehreren wartenden Stufe-2-Meldungen erscheint nur die jüngste (5. und 6. Foul)', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(1, 'Bildschirm kann sich sperren'));
    act(() => result.current.melde(2, 'SV Süd: 5. Foul in dieser Halbzeit'));
    act(() => result.current.melde(2, 'SV Süd: 6. Foul in dieser Halbzeit'));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current.aktuell?.text).toBe('SV Süd: 6. Foul in dieser Halbzeit');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.aktuell).toBeNull();
  });

  it('eine Stufe-3-Bestätigung unter einer höheren Meldung wird verworfen, nicht nachgereicht', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(2, 'SV Süd darf sich ergänzen'));
    act(() => result.current.melde(3, 'Karte für SV Süd'));
    expect(result.current.aktuell?.text).toBe('SV Süd darf sich ergänzen');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.aktuell).toBeNull();
  });

  it('@SL-096 Gegenbeispiel: eine höhere Meldung ersetzt eine niedrigere sofort, auch im selben Takt', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => {
      result.current.melde(3, 'Tor für FC Nord');
      result.current.melde(2, 'SV Süd darf sich ergänzen');
    });
    expect(result.current.aktuell?.text).toBe('SV Süd darf sich ergänzen');
  });

  it('@SL-122 Gegenbeispiel: der Wachhalten-Hinweis blockiert die Meldezeile nicht länger als 6 s; das Kreuz beendet ihn sofort', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(1, 'Bildschirm kann sich sperren – die Uhr läuft weiter'));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current.aktuell).toBeNull();
    act(() => result.current.melde(1, 'Bildschirm kann sich sperren – die Uhr läuft weiter'));
    act(() => result.current.schliesse());
    expect(result.current.aktuell).toBeNull();
  });

  it('das Kreuz gibt eine wartende Stufe-2-Meldung frei', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(1, 'Bildschirm kann sich sperren'));
    act(() => result.current.melde(2, 'SV Süd: 5. Foul in dieser Halbzeit'));
    act(() => result.current.schliesse());
    expect(result.current.aktuell?.text).toBe('SV Süd: 5. Foul in dieser Halbzeit');
  });

  it('Gegenbeispiel: nie mehr als eine Meldung – gleiche Stufe ersetzt, und die alte Frist läuft nicht weiter', () => {
    const { result } = renderHook(() => useCockpitNotices());
    act(() => result.current.melde(3, 'Tor für FC Nord'));
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => result.current.melde(3, 'Foul für SV Süd'));
    expect(result.current.aktuell?.text).toBe('Foul für SV Süd');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.aktuell?.text).toBe('Foul für SV Süd');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.aktuell).toBeNull();
  });

  it('Fehler (z. B. abgelehnter Eintrag) sind Stufe 2 und bleiben 5 s; die Funktion ist stabil', () => {
    const { result, rerender } = renderHook(() => useCockpitNotices());
    const erste = result.current.fehler;
    act(() => result.current.fehler('Eintrag konnte nicht verworfen werden'));
    expect(result.current.aktuell).toMatchObject({ stufe: 2, dauerMs: 5000 });
    rerender();
    expect(result.current.fehler).toBe(erste);
  });
});
