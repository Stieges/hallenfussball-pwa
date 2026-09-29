/**
 * C3b-1 (Plan §2 C3b-1 Nr. 1, §8 Zeile 24): Zeitstrafen-Countdown im Hook; eine zurueckgenommene
 * (oder aus dem Protokoll verschwundene) Zeitstrafe endet ihren lokalen Countdown sofort.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActivePenalties, type PenaltyEventRef } from '../useActivePenalties';

const penaltyEvent = (id: string, teamId: string, playerNumber?: number, penaltyDuration = 120): PenaltyEventRef => ({
  id,
  type: 'TIME_PENALTY',
  payload: { teamId, playerNumber, penaltyDuration },
});

describe('useActivePenalties', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('zaehlt im laufenden Spiel jede Sekunde herunter und entfernt Abgelaufenes', () => {
    const { result } = renderHook(() => useActivePenalties('m1', 'RUNNING', []));
    act(() => result.current.add({ teamId: 'a', playerNumber: 7, durationSeconds: 2 }));
    expect(result.current.penalties.map((p) => p.remainingSeconds)).toEqual([2]);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.penalties.map((p) => p.remainingSeconds)).toEqual([1]);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.penalties).toEqual([]);
  });

  it('pausiert, wenn das Spiel nicht laeuft', () => {
    const { result } = renderHook(() => useActivePenalties('m1', 'PAUSED', []));
    act(() => result.current.add({ teamId: 'a', durationSeconds: 120 }));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.penalties[0].remainingSeconds).toBe(120);
  });

  it('zurueckgenommene Zeitstrafe endet sofort (Ereignis verschwindet aus den wirksamen Ereignissen)', () => {
    const { result, rerender } = renderHook(
      ({ events }: { events: PenaltyEventRef[] }) => useActivePenalties('m1', 'RUNNING', events),
      { initialProps: { events: [] as PenaltyEventRef[] } },
    );
    act(() => result.current.add({ teamId: 'a', playerNumber: 7, durationSeconds: 120 }));
    // Die Engine hat das Ereignis angenommen -> Hook verknuepft Countdown und Ereignis.
    rerender({ events: [penaltyEvent('e1', 'a', 7)] });
    expect(result.current.penalties).toHaveLength(1);
    // RETRACT -> `events` enthaelt es nicht mehr -> Countdown sofort weg, ohne Zeitablauf.
    rerender({ events: [] });
    expect(result.current.penalties).toEqual([]);
  });

  it('zwei gleiche Strafen: nur die zurueckgenommene endet (Verknuepfung ueber die Ereignis-Id)', () => {
    const { result, rerender } = renderHook(
      ({ events }: { events: PenaltyEventRef[] }) => useActivePenalties('m1', 'RUNNING', events),
      { initialProps: { events: [] as PenaltyEventRef[] } },
    );
    act(() => result.current.add({ teamId: 'a', durationSeconds: 120 }));
    rerender({ events: [penaltyEvent('e1', 'a')] });
    act(() => { vi.advanceTimersByTime(10_000); });
    act(() => result.current.add({ teamId: 'a', durationSeconds: 120 }));
    rerender({ events: [penaltyEvent('e1', 'a'), penaltyEvent('e2', 'a')] });
    expect(result.current.penalties.map((p) => p.remainingSeconds)).toEqual([110, 120]);
    // Die AELTERE (e1) wird zurueckgenommen -> die juengere (120 s) bleibt.
    rerender({ events: [penaltyEvent('e2', 'a')] });
    expect(result.current.penalties.map((p) => p.remainingSeconds)).toEqual([120]);
  });

  it('Ereignisse, die schon vor dem Oeffnen da waren, werden nicht verknuepft und beenden nichts', () => {
    const { result, rerender } = renderHook(
      ({ events }: { events: PenaltyEventRef[] }) => useActivePenalties('m1', 'RUNNING', events),
      { initialProps: { events: [penaltyEvent('old', 'a', 3)] } },
    );
    act(() => result.current.add({ teamId: 'a', playerNumber: 3, durationSeconds: 120 }));
    rerender({ events: [penaltyEvent('old', 'a', 3)] });
    rerender({ events: [] });
    // 'old' war nie verknuepft: der neue lokale Countdown laeuft weiter (Anzeige aus dem Engine-Zustand: C3c).
    expect(result.current.penalties).toHaveLength(1);
  });

  it('Spielwechsel setzt zurueck; clear() beendet alle', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useActivePenalties(id, 'RUNNING', []),
      { initialProps: { id: 'm1' } },
    );
    act(() => result.current.add({ teamId: 'a', durationSeconds: 120 }));
    rerender({ id: 'm2' });
    expect(result.current.penalties).toEqual([]);
    act(() => result.current.add({ teamId: 'a', durationSeconds: 120 }));
    act(() => result.current.clear());
    expect(result.current.penalties).toEqual([]);
  });
});
