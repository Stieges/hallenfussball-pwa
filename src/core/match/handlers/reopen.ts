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
 *    b. noch kein REOPEN nach dem letzten Anpfiff („einmal“ je Anpfiff, Review A-25 M1: die Rücknahme einer
 *       Wertung vor dem Anpfiff zählt nicht) -> `ALREADY_CONTINUED`;
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

/** Zahl der angenommenen REOPEN im Log (Grundlage für `undo.reopensBeforeStart`, SQL zählt dieselben Einträge). */
export function acceptedReopenCount(state: MatchState): number {
  return Object.values(state.accepted).filter((accepted) => accepted.type === 'REOPEN').length;
}

function helperContinueBlock(state: MatchState, at: number): ContinueBlockReason | null {
  if (state.baseDecidedBy === null || state.finishedAt === null || !endedByClock(state)) {
    return 'NOT_ENDED_BY_CLOCK';
  }
  if (acceptedReopenCount(state) > state.undo.reopensBeforeStart) {
    return 'ALREADY_CONTINUED';
  }
  if (at - state.finishedAt > CONTINUE_WINDOW_MS) {
    return 'CONTINUE_WINDOW_EXPIRED';
  }
  return null;
}

/**
 * R-LT2 (Plan Cockpit Scheibe 3, LT-6): warum ein Helfer das Spiel zum Zeitpunkt `at` NICHT fortsetzen dürfte -- dieselben
 * Gründe und dieselbe Reihenfolge wie `applyReopen` (Strafstoßschießen, dann 2a–2c); `null` = „Spiel fortsetzen“ ginge.
 * Das Cockpit bietet die Taste nur bei `null` an (@SL-074, @SL-075, @SL-146); die Frist von 30 Sekunden kommt dort aus der
 * Quittung. Ein Eintrag der Status-Prüfung (Spiel beendet?) gehört nicht hierher -- das prüft der Übergang.
 */
export function continueBlockReason(state: MatchState, at: number): ContinueBlockReason | 'SHOOTOUT_FINISHED' | null {
  if (state.phase === 'shootout') {
    return 'SHOOTOUT_FINISHED';
  }
  return helperContinueBlock(state, at);
}

export function applyReopen(state: MatchState, event: EngineEvent): ReopenOutcome {
  if (state.phase === 'shootout') {
    return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'SHOOTOUT_FINISHED' } };
  }
  if (event.actor !== 'leitung') {
    const reason = helperContinueBlock(state, event.at);
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
