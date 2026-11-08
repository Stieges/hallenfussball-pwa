/**
 * Sekundentakt der Zeitstrafen-Kreise (@ZM-182, @ZM-192): ein Takt läuft nur, solange eine Strafe bei laufender Uhr abläuft.
 * Ohne Strafe, bei stehender Uhr und nach Ablauf aller Strafen läuft keiner. Ist keiner nötig, ist der Stand trotzdem frisch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NowSourceContext } from '../../schedule/useTickingNow';
import { useLaufendeZeitstrafen } from '../useLaufendeZeitstrafen';
import type { RuntimeMatchEvent } from '../../../types/tournament';

const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const NORD = 'team-nord';
const SUED = 'team-sued';

const strafe: RuntimeMatchEvent = {
  id: 'ev-1',
  type: 'TIME_PENALTY',
  timestampSeconds: 200,
  clockMs: 200_000,
  payload: { teamId: SUED, playerNumber: 5, durationSeconds: 120, penaltyDuration: 120 },
  scoreAfter: { home: 0, away: 0 },
};

function uhr(gespieltMs: number, laeuft: boolean) {
  return { status: laeuft ? 'running' : 'paused', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, overtimeSeconds: 120, sectionStartMs: 0, elapsedMs: gespieltMs, anchorAt: laeuft ? T0 : null };
}

function rendern(events: RuntimeMatchEvent[], liveState: unknown) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NowSourceContext.Provider value={() => Date.now()}>{children}</NowSourceContext.Provider>
  );
  return renderHook(() => useLaufendeZeitstrafen({ events, liveState }, NORD, SUED), { wrapper });
}

describe('@ZM-182 @ZM-192 Sekundentakt der Zeitstrafen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('läuft die Uhr und läuft eine Strafe, tickt es im Sekundentakt', () => {
    const { result } = rendern([strafe], uhr(210_000, true));
    expect(vi.getTimerCount()).toBe(1);
    expect(result.current.away).toHaveLength(1);
  });

  it('Gegenbeispiel: ohne Zeitstrafe kein Takt', () => {
    rendern([], uhr(210_000, true));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Gegenbeispiel: steht die Uhr, kein Takt – der Kreis ist grau und steht', () => {
    const { result } = rendern([strafe], uhr(210_000, false));
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.steht).toBe(true);
    expect(result.current.away).toHaveLength(1);
  });

  it('Gegenbeispiel: ist die Strafe abgelaufen, kein Takt und kein Kreis', () => {
    const { result } = rendern([strafe], uhr(400_000, true));
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.away).toHaveLength(0);
  });
});
