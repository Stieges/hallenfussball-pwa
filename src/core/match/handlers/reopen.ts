/**
 * REOPEN -- Wiedereröffnen (Turnierleitung, ohne Frist) bzw. „Spiel fortsetzen“ (Helfer, ZA-3).
 *
 * Reihenfolge (verbindlich, auch für den SQL-Zwilling match_engine.apply_effect):
 * 1. Ruling B-U11: nach Strafstoßschießen nie (INVALID_TRANSITION `SHOOTOUT_FINISHED`, für alle).
 * 2. Helfer (@SL-074/@SL-075, @HE-042), sonst FORBIDDEN_ACTOR mit Grund:
 *    a. Ende durch Ablauf der Spielzeit: Spielende-Prüfung (`baseDecidedBy` gesetzt, kein
 *       Direkteintrag) UND Uhr beim Spielende ≥ Ende des Abschnitts (`sectionStartMs +
 *       sectionSeconds·1000`, in der Verlängerung `overtimeSeconds`) -- ein Abpfiff von Hand vor
 *       Ablauf zählt nicht (Fixrunde 1, W2) -> `NOT_ENDED_BY_CLOCK`;
 *    b. noch kein REOPEN in diesem Spiel („einmal“) -> `ALREADY_CONTINUED`;
 *    c. `at − finishedAt ≤ 120 000` („höchstens 2 Minuten“) -> `CONTINUE_WINDOW_EXPIRED`.
 * 3. A-25n (@W2A-026, R-GA4-4): ist die letzte Überschreibung eine Nichtantritt-Wertung, nimmt REOPEN sie zurück --
 *    Spiel wieder `scheduled`, Wertung vom Stapel, kein Abpfiff, Uhr unverändert (nie angepfiffen: eine Wertung entsteht
 *    nur aus `scheduled`). Helfer scheitern vorher an 2a (eine Wertung hat keine Spielende-Prüfung).
 * 4. Wirkung sonst: `running`, Uhr läuft ab `clockMs` (Restzeit, die das Gerät gestellt hat) bzw. weiter.
 * Den Zielzustand setzt diese Wirkung selbst (Übergangszeile `finished → @reopen`).
 */
import { ERROR_CODES, type EngineEvent, type ErrorCode, type MatchState } from '../types';
import { resumeClock } from './clock';

/** „Spiel fortsetzen“ höchstens 2 Minuten nach dem Abpfiff (@SL-075). */
export const CONTINUE_WINDOW_MS = 120_000;

/**
 * Fixrunde 1 (W1): Toleranz für das Nachsenden ohne Netz, wenn der Server die Fristen
 * (Fortsetzen 120 s, Anpfiff zurücknehmen 30 s) zusätzlich an SEINER Uhr misst
 * (`append_match_events`, Konstante `c_server_clock_tolerance_ms`). Die Rechenfunktion selbst
 * kennt keine Serverzeit -- diese Prüfung gilt nur am Server.
 */
export const SERVER_CLOCK_TOLERANCE_MS = 600_000;

/** Uhr beim Spielende hat das Ende des Abschnitts erreicht (Ende durch Ablauf, nicht von Hand). */
function endedByClock(state: MatchState): boolean {
  if (state.rules === null) {
    return false;
  }
  const seconds = state.phase === 'overtime' ? state.rules.overtimeSeconds : state.rules.sectionSeconds;
  return state.clock.elapsedMs >= state.sectionStartMs + seconds * 1000;
}

export type ContinueBlockReason = 'NOT_ENDED_BY_CLOCK' | 'ALREADY_CONTINUED' | 'CONTINUE_WINDOW_EXPIRED';

export type ReopenOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail: { reason: 'SHOOTOUT_FINISHED' | ContinueBlockReason } };

function helperContinueBlock(state: MatchState, event: EngineEvent): ContinueBlockReason | null {
  if (state.baseDecidedBy === null || state.finishedAt === null || !endedByClock(state)) {
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
  if (state.overrides[state.overrides.length - 1]?.kind === 'forfeit') {
    // A-25n (@W2A-026): Wertung zurücknehmen -- der Stand ändert sich (lastScoreEventId wie RETRACT einer Korrektur).
    return {
      status: 'ok',
      state: {
        ...state,
        status: 'scheduled',
        overrides: state.overrides.slice(0, -1),
        finishedAt: null,
        baseDecidedBy: null,
        breakStartedAt: null,
        lastScoreEventId: event.id,
      },
    };
  }
  // Ruling K1: baseDecidedBy zurücksetzen, nicht decidedBy direkt -- eine noch aktive
  // Überschreibung (Korrektur/Direkteintrag) bleibt bestehen und bestimmt weiter decidedBy.
  // C0a (V2): sectionStartMs bleibt, eine Pause ist nach REOPEN nicht offen.
  return {
    status: 'ok',
    state: {
      ...state,
      status: 'running',
      clock: resumeClock(state.clock, event),
      finishedAt: null,
      baseDecidedBy: null,
      breakStartedAt: null,
    },
  };
}
