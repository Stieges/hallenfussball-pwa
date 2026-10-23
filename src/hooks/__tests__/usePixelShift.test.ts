// @vitest-environment jsdom
/**
 * usePixelShift (@ME-019): Das Bild verschiebt sich alle 60 s um höchstens 2 Bildpunkte, nie mehr.
 * Gegenbeispiele: vor Ablauf des Takts keine Verschiebung; ohne Bildrand keine Verschiebung; bei „reduce motion“
 * keine Verschiebung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePixelShift } from '../usePixelShift';

const KEINE_VERSCHIEBUNG = 'translate(0px, 0px)';

function setzeReduceMotion(reduziert: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation(() => ({ matches: reduziert, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    configurable: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setzeReduceMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePixelShift (@ME-019)', () => {
  it('verschiebt nach 60 s, und zwar um höchstens 2 Bildpunkte je Achse', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const { result } = renderHook(() => usePixelShift(60_000, 2, true));
    expect(result.current.transform).toBe(KEINE_VERSCHIEBUNG);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.transform).toBe('translate(2px, 2px)');
  });

  it('Gegenbeispiel: die Negativrichtung bleibt ebenfalls bei −2 Bildpunkten', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => usePixelShift(60_000, 2, true));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.transform).toBe('translate(-2px, -2px)');
  });

  it('Gegenbeispiel: vor Ablauf des Takts (59 s) keine Verschiebung', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const { result } = renderHook(() => usePixelShift(60_000, 2, true));
    act(() => { vi.advanceTimersByTime(59_000); });
    expect(result.current.transform).toBe(KEINE_VERSCHIEBUNG);
  });

  it('Gegenbeispiel: ohne Bildrand (maxShiftPx 0) und bei abgeschaltet nie eine Verschiebung', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const ohneRand = renderHook(() => usePixelShift(60_000, 0, true));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(ohneRand.result.current.transform).toBe(KEINE_VERSCHIEBUNG);

    const aus = renderHook(() => usePixelShift(60_000, 2, false));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(aus.result.current.transform).toBe(KEINE_VERSCHIEBUNG);
  });

  it('Gegenbeispiel: bei „reduce motion“ bleibt das Bild stehen', () => {
    setzeReduceMotion(true);
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const { result } = renderHook(() => usePixelShift(60_000, 2, true));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.transform).toBe(KEINE_VERSCHIEBUNG);
  });
});
