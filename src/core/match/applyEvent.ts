/**
 * `applyEvent` -- die reine Rechenfunktion für ein einzelnes Ereignis
 * (Brief Abschnitt 3, R1). Nie das Systemdatum lesen, keine Mutation des Eingangszustands:
 * jeder Zwischenschritt erzeugt ein neues Objekt per Spread.
 *
 * Prüfreihenfolge (verbindlich):
 * 1. Zod-Payload -> INVALID_PAYLOAD
 * 2. MATCH_END in `finished` -> noop (R9)
 * 3. Übergangszeile suchen -> INVALID_TRANSITION / MATCH_FINISHED
 * 4. Akteur-Check -> FORBIDDEN_ACTOR
 * 5. Typspezifische Wirkung, dann `to` anwenden (inkl. `@endcheck`)
 */
import { findTransition, isActorAllowed } from './transitions';
import { applyCorrection, applyResultEntry } from './handlers/correction';
import { adjustClock, resumeClock, startClock, stopClock } from './handlers/clock';
import { applyCard, applyFoul, applyGoal, applySubstitution, applyTimePenalty } from './handlers/records';
import { applyRetract } from './handlers/retract';
import { runEndCheck } from './handlers/endcheck';
import {
  decidedByFor,
  ERROR_CODES,
  MatchContextSchema,
  type EngineEvent,
  type ErrorCode,
  type MatchContext,
  type MatchState,
} from './types';
import { isPayloadValid } from './payloadValidation';

export type ApplyResult =
  | { status: 'accepted'; state: MatchState }
  | { status: 'noop'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail?: unknown };

/**
 * Frischer Anfangszustand für ein Spiel (Brief Abschnitt 3). Validiert `ctx` gegen
 * `MatchContextSchema` (M10, Fixrunde 1) -- teamAId === teamBId ist ein Aufrufer-Fehler und
 * wirft laut, statt ein Spiel mit nur einem Team-Schlüssel in `scores` zu erzeugen.
 */
export function initialState(ctx: MatchContext): MatchState {
  MatchContextSchema.parse(ctx);
  const zeroBreakdown = { regular: 0, overtime: 0, shootout: 0 };
  return {
    status: 'scheduled',
    phase: 'regular',
    section: 1,
    rules: null,
    clock: { running: false, elapsedMs: 0, anchorAt: null },
    scores: {
      [ctx.teamAId]: { ...zeroBreakdown },
      [ctx.teamBId]: { ...zeroBreakdown },
    },
    goals: [],
    overrides: [],
    nextSeq: 0,
    baseDecidedBy: null,
    shootoutKicks: [],
    cards: [],
    fouls: [],
    penalties: [],
    substitutions: [],
    accepted: {},
    retracted: [],
    lastScoreEventId: null,
    decidedBy: null,
    finishedAt: null,
  };
}

type EffectResult = { status: 'ok'; state: MatchState } | { status: 'rejected'; code: ErrorCode; detail?: unknown };

/** Typspezifische Wirkung vor Anwendung von `to` (Brief Abschnitt 3). */
function applyTypeSpecificEffect(state: MatchState, event: EngineEvent, ctx: MatchContext): EffectResult {
  switch (event.type) {
    case 'MATCH_START': {
      const payload = event.payload as { rules: MatchState['rules'] };
      return { status: 'ok', state: { ...state, rules: payload.rules, phase: 'regular', section: 1, clock: startClock(event) } };
    }
    case 'PAUSE':
    case 'MATCH_END':
      return { status: 'ok', state: { ...state, clock: stopClock(state.clock, event) } };
    case 'RESUME':
      return { status: 'ok', state: { ...state, clock: resumeClock(state.clock, event) } };
    case 'REOPEN':
      // Ruling K1: baseDecidedBy zurücksetzen, nicht decidedBy direkt -- eine noch aktive
      // Überschreibung (Korrektur/Direkteintrag) bleibt bestehen und bestimmt weiter decidedBy.
      return {
        status: 'ok',
        state: { ...state, clock: resumeClock(state.clock, event), finishedAt: null, baseDecidedBy: null },
      };
    case 'CLOCK_ADJUST':
      return { status: 'ok', state: { ...state, clock: adjustClock(state.clock, event) } };
    case 'GOAL':
    case 'OWN_GOAL':
      return { status: 'ok', state: applyGoal(state, event, ctx) };
    case 'YELLOW_CARD':
    case 'YELLOW_RED_CARD':
    case 'RED_CARD':
      return { status: 'ok', state: applyCard(state, event) };
    case 'TIME_PENALTY':
      return { status: 'ok', state: applyTimePenalty(state, event) };
    case 'FOUL':
      return { status: 'ok', state: applyFoul(state, event) };
    case 'SUBSTITUTION':
      return { status: 'ok', state: applySubstitution(state, event) };
    case 'RETRACT': {
      const outcome = applyRetract(state, event, ctx);
      return outcome.status === 'ok'
        ? { status: 'ok', state: outcome.state }
        : { status: 'rejected', code: outcome.code, detail: outcome.detail };
    }
    case 'CORRECTION': {
      const outcome = applyCorrection(state, event, ctx);
      return outcome.status === 'ok'
        ? { status: 'ok', state: outcome.state }
        : { status: 'rejected', code: outcome.code, detail: outcome.detail };
    }
    case 'RESULT_ENTRY':
      return { status: 'ok', state: applyResultEntry(state, event, ctx) };
    default:
      // SKIP/UNSKIP sowie die B1b-Zeilen (SECTION_END, SECTION_START, TIEBREAK_CHOICE,
      // SHOOTOUT_KICK, SHOOTOUT_END): in B1a nur der reine Statuswechsel via `to`.
      return { status: 'ok', state };
  }
}

export function applyEvent(state: MatchState, event: EngineEvent, ctx: MatchContext): ApplyResult {
  if (!isPayloadValid(event, ctx)) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_PAYLOAD };
  }

  if (event.type === 'MATCH_END' && state.status === 'finished') {
    return { status: 'noop', state };
  }

  const row = findTransition(state.status, event.type);
  if (!row) {
    return {
      status: 'rejected',
      code: state.status === 'finished' ? ERROR_CODES.MATCH_FINISHED : ERROR_CODES.INVALID_TRANSITION,
    };
  }

  if (!isActorAllowed(row, event.actor)) {
    return { status: 'rejected', code: ERROR_CODES.FORBIDDEN_ACTOR };
  }

  const effect = applyTypeSpecificEffect(state, event, ctx);
  if (effect.status === 'rejected') {
    return { status: 'rejected', code: effect.code, ...(effect.detail !== undefined ? { detail: effect.detail } : {}) };
  }

  let nextState = effect.state;
  if (row.to === '@endcheck') {
    nextState = runEndCheck(nextState, event, ctx);
  } else if (row.to !== '=') {
    nextState = { ...nextState, status: row.to };
  }

  // Ruling K1: decidedBy nach jedem Ereignis zentral aus baseDecidedBy + Überschreibungs-Stapel
  // ableiten, statt es in jedem einzelnen Handler von Hand zu pflegen.
  nextState = {
    ...nextState,
    decidedBy: decidedByFor(nextState),
    accepted: { ...nextState.accepted, [event.id]: event },
  };

  return { status: 'accepted', state: nextState };
}
