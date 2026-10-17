/**
 * Uhr-Übergänge (R2 -- Spielzeit statt Wanduhr). Jede Funktion ist rein: sie
 * liest nur `state.clock` und das eingehende Ereignis, mutiert nichts und
 * liefert einen neuen `ClockState`.
 */
import { elapsedAt } from '../penalties';
import type { ClockState, EngineEvent, MatchState, Phase } from '../types';

/** ZA-3: eine Uhr-Korrektur mit ihrer Wirkung auf die Spielzeit (`deltaMs` = neu − vorher). */
export interface ClockAdjustRecord {
  id: string;
  deltaMs: number;
  section: number;
  phase: Phase;
}

/**
 * ZA-3: Grundlage für das Zurücknehmen von Anpfiff (@SL-066/@SL-067) und Uhr-Korrektur (@SL-109).
 * `acceptedBeforeStart` = Zahl der angenommenen Ereignisse vor dem letzten Anpfiff -- ist danach
 * nichts dazugekommen, steht nur der Anpfiff selbst im Log (SQL zählt dieselben Schlüssel).
 */
export interface UndoInfo {
  acceptedBeforeStart: number;
  clockAdjusts: ClockAdjustRecord[];
}

export const EMPTY_UNDO_INFO: UndoInfo = { acceptedBeforeStart: 0, clockAdjusts: [] };


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

/** CLOCK_ADJUST mit Merker (ZA-3, @SL-109): Uhr wie `adjustClock`, die Wirkung wird für RETRACT gemerkt. */
export function applyClockAdjust(state: MatchState, event: EngineEvent): MatchState {
  const clock = adjustClock(state.clock, event);
  const record: ClockAdjustRecord = {
    id: event.id,
    deltaMs: clock.elapsedMs - elapsedAt(state.clock, event.at),
    section: state.section,
    phase: state.phase,
  };
  return { ...state, clock, undo: { ...state.undo, clockAdjusts: [...state.undo.clockAdjusts, record] } };
}

/** RETRACT einer Uhr-Korrektur: Spielzeit ohne die Korrektur (Anker bleibt), Merker bleibt in der Liste. */
export function reverseClockAdjust(state: MatchState, record: ClockAdjustRecord): MatchState {
  return { ...state, clock: { ...state.clock, elapsedMs: state.clock.elapsedMs - record.deltaMs } };
}
