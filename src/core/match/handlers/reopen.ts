/**
 * REOPEN -- Wiedereröffnen (Turnierleitung, ohne Frist) bzw. „Spiel fortsetzen“ (Helfer, ZA-3).
 *
 * Reihenfolge (verbindlich, auch für den SQL-Zwilling match_engine.apply_effect):
 * 1. Ruling B-U11: nach Strafstoßschießen nie (INVALID_TRANSITION `SHOOTOUT_FINISHED`, für alle).
 * 2. Helfer (@SL-074/@SL-075, @HE-042), sonst FORBIDDEN_ACTOR mit Grund:
 *    a. Ende durch die Spielende-Prüfung (`baseDecidedBy` gesetzt), nicht durch Direkteintrag
 *       -> `NOT_ENDED_BY_CLOCK`;
 *    b. noch kein REOPEN in diesem Spiel („einmal“) -> `ALREADY_CONTINUED`;
 *    c. `at − finishedAt ≤ 120 000` („höchstens 2 Minuten“) -> `CONTINUE_WINDOW_EXPIRED`.
 * 3. Wirkung: Uhr läuft ab `clockMs` (Restzeit, die das Gerät gestellt hat) bzw. weiter.
 */
import { ERROR_CODES, type EngineEvent, type ErrorCode, type MatchState } from '../types';
import { resumeClock } from './clock';

/** „Spiel fortsetzen“ höchstens 2 Minuten nach dem Abpfiff (@SL-075). */
export const CONTINUE_WINDOW_MS = 120_000;

export type ContinueBlockReason = 'NOT_ENDED_BY_CLOCK' | 'ALREADY_CONTINUED' | 'CONTINUE_WINDOW_EXPIRED';

export type ReopenOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail: { reason: 'SHOOTOUT_FINISHED' | ContinueBlockReason } };

function helperContinueBlock(state: MatchState, event: EngineEvent): ContinueBlockReason | null {
  if (state.baseDecidedBy === null || state.finishedAt === null) {
    return 'NOT_ENDED_BY_CLOCK';
  }
  if (Object.values(state.accepted).some((accepted) => accepted.type === 'REOPEN')) {
    return 'ALREADY_CONTINUED';
  }
  if (event.at - state.finishedAt > CONTINUE_WINDOW_MS) {
    return 'CONTINUE_WINDOW_EXPIRED';
  }
  return null;
}

export function applyReopen(state: MatchState, event: EngineEvent): ReopenOutcome {
  if (state.phase === 'shootout') {
    return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'SHOOTOUT_FINISHED' } };
  }
  if (event.actor !== 'leitung') {
    const reason = helperContinueBlock(state, event);
    if (reason !== null) {
      return { status: 'rejected', code: ERROR_CODES.FORBIDDEN_ACTOR, detail: { reason } };
    }
  }
  // Ruling K1: baseDecidedBy zurücksetzen, nicht decidedBy direkt -- eine noch aktive
  // Überschreibung (Korrektur/Direkteintrag) bleibt bestehen und bestimmt weiter decidedBy.
  // C0a (V2): sectionStartMs bleibt, eine Pause ist nach REOPEN nicht offen.
  return {
    status: 'ok',
    state: { ...state, clock: resumeClock(state.clock, event), finishedAt: null, baseDecidedBy: null, breakStartedAt: null },
  };
}
