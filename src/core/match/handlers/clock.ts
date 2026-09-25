/**
 * Uhr-Übergänge (R2 -- Spielzeit statt Wanduhr). Jede Funktion ist rein: sie
 * liest nur `state.clock` und das eingehende Ereignis, mutiert nichts und
 * liefert einen neuen `ClockState`.
 */
import type { ClockState, EngineEvent } from '../types';

/** MATCH_START: Uhr startet, `elapsedMs` aus `clockMs` (Offline-Fall) oder 0. */
export function startClock(event: EngineEvent): ClockState {
  return { running: true, elapsedMs: event.clockMs ?? 0, anchorAt: event.at };
}

/**
 * PAUSE / MATCH_END: Uhr stoppen. Nur wenn sie lief, wird `elapsedMs` neu
 * berechnet (`clockMs` bevorzugt, sonst `elapsedMs + (at - anchorAt)`) --
 * sonst bleibt der zuvor gestoppte Stand unverändert (z. B. MATCH_END direkt
 * aus `paused`).
 */
export function stopClock(clock: ClockState, event: EngineEvent): ClockState {
  if (!clock.running) {
    return clock;
  }
  const elapsedMs = event.clockMs ?? clock.elapsedMs + (event.at - (clock.anchorAt ?? event.at));
  return { running: false, elapsedMs, anchorAt: null };
}

/** RESUME / REOPEN: Uhr läuft wieder, Anker = `at`, `elapsedMs` aus `clockMs` oder unverändert. */
export function resumeClock(clock: ClockState, event: EngineEvent): ClockState {
  return { running: true, anchorAt: event.at, elapsedMs: event.clockMs ?? clock.elapsedMs };
}

/** CLOCK_ADJUST: `elapsedMs` fest auf `clockMs`, bei laufender Uhr auch neuer Anker. */
export function adjustClock(clock: ClockState, event: EngineEvent): ClockState {
  // clockMs !== null ist bereits durch isPayloadValid() sichergestellt (CLOCK_ADJUST-Regel).
  const elapsedMs = event.clockMs ?? clock.elapsedMs;
  if (clock.running) {
    return { running: true, elapsedMs, anchorAt: event.at };
  }
  return { ...clock, elapsedMs };
}
