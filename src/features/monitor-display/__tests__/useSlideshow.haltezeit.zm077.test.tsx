/**
 * @ZM-077: Nach dem Abpfiff bleibt das Endergebnis 30 Sekunden stehen, „danach wechseln die Folien seines Programms im
 * eingestellten Takt“ (C-MONITOR-FOLIENTAKT-NACH-HALTEZEIT). @ZM-130: eine Folie steht so lange, wie ihre Anzeigedauer sagt.
 * Mit Übergang darf das Ende des Übergangs weder Pin noch Haltezeit aus dem alten Zustand zurückholen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlideshow } from '../useSlideshow';
import type { SlideProgram, RuleMatch } from '../slideProgramme';

const slides = [
  { id: 'live', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 },
  { id: 'all', type: 'all-standings', config: {}, duration: null, order: 1 },
  { id: 'next', type: 'next-matches', config: {}, duration: null, order: 2 },
  { id: 'text', type: 'custom-text', config: {}, duration: null, order: 3 },
  { id: 'qr', type: 'qr-code', config: {}, duration: null, order: 4 },
] as unknown as SlideProgram['slides'];
const matches = (isLive: boolean): RuleMatch[] => [{ id: 'spiel15', field: 1, isLive, isUpcoming: false }];
const programm = (isLive: boolean): SlideProgram => ({ slides, defaultDurationSec: 5, matches: matches(isLive) });

/** Folienindex alle 50 ms über `dauerMs`: die Zeitpunkte (ab Start) der Wechsel. */
function wechsel(result: { current: { slideState: { currentIndex: number } } }, dauerMs: number): Array<[number, number]> {
  const folge: Array<[number, number]> = [];
  let zuletzt = result.current.slideState.currentIndex;
  for (let t = 50; t <= dauerMs; t += 50) {
    act(() => { vi.advanceTimersByTime(50); });
    const i = result.current.slideState.currentIndex;
    if (i !== zuletzt) { folge.push([t, i]); zuletzt = i; }
  }
  return folge;
}

describe('useSlideshow: Takt nach der Haltezeit des Endergebnisses (@ZM-077)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T14:20:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  function bisNachHaltezeit(uebergangMs: number | null) {
    const hook = renderHook(({ p }) => useSlideshow(p, uebergangMs), { initialProps: { p: programm(true) } });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(hook.result.current.slideState.currentIndex).toBe(0); // Live-Folie, Spiel läuft
    hook.rerender({ p: programm(false) }); // Abpfiff, kein Folgespiel
    act(() => { vi.advanceTimersByTime(29_000); });
    expect(hook.result.current.slideState.currentIndex).toBe(0); // Endergebnis steht noch (30 s)
    return hook;
  }

  it('mit Übergang 500 ms: nach der Haltezeit mindestens drei Wechsel im Takt von 5 s (+ 0,5 s Übergang), nicht alle 0,5 s', () => {
    const { result } = bisNachHaltezeit(500);
    const folge = wechsel(result, 20_000);
    expect(folge.length).toBeGreaterThanOrEqual(3);
    const abstaende = folge.slice(1).map(([t], i) => t - folge[i][0]);
    for (const abstand of abstaende) { expect(abstand).toBe(5_500); }
    // Reihenfolge: Live-Folie ist nach dem Abpfiff übersprungen (@ZM-122), dann Alle Tabellen, Nächste, Text …
    expect(folge.map(([, i]) => i).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('Gegenbeispiel ohne Übergang: derselbe Takt von 5 s', () => {
    const { result } = bisNachHaltezeit(null);
    const folge = wechsel(result, 20_000);
    expect(folge.length).toBeGreaterThanOrEqual(3);
    for (const abstand of folge.slice(1).map(([t], i) => t - folge[i][0])) { expect(abstand).toBe(5_000); }
  });

  it('Anpfiff MITTEN im Übergang: die Live-Folie bleibt, der laufende Übergang überschreibt sie nicht', () => {
    const { result, rerender } = bisNachHaltezeit(500);
    act(() => { vi.advanceTimersByTime(1_100); }); // Haltezeit endet bei 30 s, Übergang läuft ab 30 s
    expect(result.current.slideState.isTransitioning).toBe(true);
    rerender({ p: programm(true) }); // neues Spiel in den 500 ms des Übergangs angepfiffen
    for (let t = 0; t < 8_000; t += 100) {
      act(() => { vi.advanceTimersByTime(100); });
      expect(result.current.slideState.currentIndex, `bei +${String(t)} ms`).toBe(0);
    }
    expect(result.current.slideState.isTransitioning).toBe(false);
  });
});
