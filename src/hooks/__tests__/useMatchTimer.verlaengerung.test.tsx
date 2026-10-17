/**
 * C-VERLAENGERUNG-ENDET-SOFORT (Hook): `useMatchTimerExtended` bekommt die Ansicht des echten Adapters
 * (Engine-Log → `toLiveMatchView`) wie im Cockpit. Werte aus dem Gherkin: Halbfinale 1 nach 1:1 in der
 * Verlängerung von 3 Minuten (@SL-081, @SL-145, @TM-052), Golden Goal (@SL-082).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchTimerExtended } from '../useMatchTimer';
import type { LiveMatch } from '../../core/models/LiveMatch';
import {
  OT_KICKOFF_AT,
  OVERTIME_S,
  T0,
  overtimeRunningLog,
  regularTimeDrawLog,
  viewAt,
} from '../../core/match/client/__tests__/overtimeFixtures';

function timerFor(view: LiveMatch) {
  return renderHook(() =>
    useMatchTimerExtended(view.timerStartTime, view.timerElapsedSeconds ?? 0, view.status, view.durationSeconds, 'countdown', 120),
  );
}

describe('useMatchTimerExtended mit der Ansicht der Verlängerung (C-VERLAENGERUNG-ENDET-SOFORT)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('@SL-145 @SL-081: beim Anpfiff der Verlängerung zeigt die Uhr 3:00 und ist nicht abgelaufen, sie zählt danach weiter', () => {
    vi.setSystemTime(OT_KICKOFF_AT);
    const { result } = timerFor(viewAt(overtimeRunningLog('overtime-then-shootout'), OT_KICKOFF_AT));
    expect(result.current.isOvertime).toBe(false);
    expect(result.current.displaySeconds).toBe(180);

    // +50 ms: die Uhr tickt per requestAnimationFrame (~16 ms), nicht exakt auf der vollen Sekunde
    act(() => {
      vi.advanceTimersByTime(120_050);
    });
    expect(result.current.isOvertime).toBe(false);
    expect(result.current.displaySeconds).toBe(60);
  });

  it('@TM-052: abgelaufen erst nach den 3 Minuten der Verlängerung', () => {
    vi.setSystemTime(OT_KICKOFF_AT);
    const { result } = timerFor(viewAt(overtimeRunningLog('overtime-then-shootout'), OT_KICKOFF_AT));
    act(() => {
      vi.advanceTimersByTime(OVERTIME_S * 1000 - 1000);
    });
    expect(result.current.isOvertime).toBe(false);
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    expect(result.current.isOvertime).toBe(true);
  });

  it('@SL-082: auch im Golden Goal zählt die Uhr die Verlängerung (kein 00:00 beim Anpfiff)', () => {
    vi.setSystemTime(OT_KICKOFF_AT);
    const { result } = timerFor(viewAt(overtimeRunningLog('goldenGoal'), OT_KICKOFF_AT));
    expect(result.current.isOvertime).toBe(false);
    expect(result.current.displaySeconds).toBe(180);
  });

  it('Gegenbeispiel: in der regulären Spielzeit ist die Uhr nach 10:00 abgelaufen', () => {
    const at = T0 + 661_000;
    vi.setSystemTime(at);
    const { result } = timerFor(viewAt(regularTimeDrawLog('overtime-then-shootout').slice(0, -1), at));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.isOvertime).toBe(true);
    expect(result.current.displaySeconds).toBe(0);
  });
});
