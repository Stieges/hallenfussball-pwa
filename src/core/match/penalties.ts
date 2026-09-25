/**
 * Zeitstrafen-Countdown (B1b, B-U5, TS-only -- R18: nicht im serverState, SQL rechnet das nicht).
 *
 * Die Strafe rechnet ausschließlich in Spieluhr-ms (R2): `elapsedMs` wächst nur bei laufender Uhr,
 * die Spieluhr ist kumulativ über Abschnitte und Verlängerung (B-U1). Damit läuft eine Strafe nur
 * mit laufender Uhr, über Abschnittspausen hinweg und in die Verlängerung hinein -- ohne
 * Sonderfall. Alle Werte sind Ganzzahl-ms.
 */
import type { ClockState, MatchState, PenaltyRecord } from './types';

/** Spielzeit zum Wanduhr-Zeitpunkt `at`: bei laufender Uhr `elapsedMs + (at − anchorAt)`, sonst `elapsedMs`. */
export function elapsedAt(clock: ClockState, at: number): number {
  if (!clock.running) {
    return clock.elapsedMs;
  }
  return clock.elapsedMs + (at - (clock.anchorAt ?? at));
}

/** Rest einer Strafe bei Spielzeit `elapsedMs`: `max(0, durationMs − max(0, elapsedMs − startMs))`. */
export function penaltyRemainingMs(penalty: PenaltyRecord, elapsedMs: number): number {
  return Math.max(0, penalty.durationMs - Math.max(0, elapsedMs - penalty.startMs));
}

/** Laufende Strafen bei Spielzeit `elapsedMs`: nicht zurückgenommen und Rest > 0, in Log-Reihenfolge. */
export function activePenalties(state: MatchState, elapsedMs: number): PenaltyRecord[] {
  return state.penalties.filter(
    (penalty) => !state.retracted.includes(penalty.id) && penaltyRemainingMs(penalty, elapsedMs) > 0,
  );
}
