/**
 * `applyEvent` -- die reine Rechenfunktion für ein einzelnes Ereignis
 * (Brief Abschnitt 3, R1). Nie das Systemdatum lesen, keine Mutation des Eingangszustands:
 * jeder Zwischenschritt erzeugt ein neues Objekt per Spread.
 *
 * Prüfreihenfolge (verbindlich):
 * 1. Zod-Payload -> INVALID_PAYLOAD
 * 2. MATCH_END in `finished`, `section_break`, `decision_pending`, `shootout` -> noop (R9, K8/B-U7)
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
import { applySectionEnd, applySectionStart } from './handlers/sections';
import { applyShootoutEnd, applyShootoutKick } from './handlers/shootout';
import { applyTiebreakChoice } from './handlers/tiebreak';
import {
  decidedByFor,
  ERROR_CODES,
  MatchContextSchema,
  type EngineEvent,
  type ErrorCode,
  type MatchContext,
  type MatchState,
  type MatchStatus,
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
    tiebreakMode: null,
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

/** B-U7 (Ruling K8): ein weiteres Spielende in diesen Zuständen ist kein Fehler, sondern noop (R9). */
const MATCH_END_NOOP_STATUSES: ReadonlySet<MatchStatus> = new Set(['finished', 'section_break', 'decision_pending', 'shootout']);

/**
 * GOAL/OWN_GOAL; B-U3 Golden Goal: in der Verlängerung mit Modus goldenGoal stoppt das Tor die Uhr
 * (wie MATCH_END) und löst sofort die Spielende-Prüfung aus.
 */
function applyGoalEvent(state: MatchState, event: EngineEvent, ctx: MatchContext): MatchState {
  const scored = applyGoal(state, event, ctx);
  if (scored.phase !== 'overtime' || scored.tiebreakMode !== 'goldenGoal') {
    return scored;
  }
  return runEndCheck({ ...scored, clock: stopClock(scored.clock, event) }, event, ctx);
}

/** Typspezifische Wirkung vor Anwendung von `to` (Brief Abschnitt 3). */
function applyTypeSpecificEffect(state: MatchState, event: EngineEvent, ctx: MatchContext): EffectResult {
  switch (event.type) {
    case 'MATCH_START': {
      const payload = event.payload as { rules: MatchState['rules'] };
      const rules = payload.rules;
      return {
        status: 'ok',
        state: { ...state, rules, tiebreakMode: rules?.tiebreak ?? null, phase: 'regular', section: 1, clock: startClock(event) },
      };
    }
    case 'PAUSE':
    case 'MATCH_END':
      return { status: 'ok', state: { ...state, clock: stopClock(state.clock, event) } };
    case 'RESUME':
      return { status: 'ok', state: { ...state, clock: resumeClock(state.clock, event) } };
    case 'REOPEN':
      // Ruling B-U11: nur nach Spielende in phase regular/overtime; nach Strafstoßschießen korrigiert
      // die Turnierleitung per CORRECTION.
      if (state.phase === 'shootout') {
        return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'SHOOTOUT_FINISHED' } };
      }
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
      return { status: 'ok', state: applyGoalEvent(state, event, ctx) };
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
    case 'RETRACT':
      return applyRetract(state, event, ctx);
    case 'CORRECTION':
      return applyCorrection(state, event, ctx);
    case 'SECTION_END':
      return applySectionEnd(state, event);
    case 'SECTION_START':
      return { status: 'ok', state: applySectionStart(state, event) };
    case 'TIEBREAK_CHOICE':
      return { status: 'ok', state: applyTiebreakChoice(state, event) };
    case 'SHOOTOUT_KICK':
      return applyShootoutKick(state, event, ctx);
    case 'SHOOTOUT_END':
      return applyShootoutEnd(state, event, ctx);
    case 'RESULT_ENTRY':
      return { status: 'ok', state: applyResultEntry(state, event, ctx) };
    default:
      // SKIP/UNSKIP: nur der reine Statuswechsel via `to`.
      return { status: 'ok', state };
  }
}

export function applyEvent(state: MatchState, event: EngineEvent, ctx: MatchContext): ApplyResult {
  if (!isPayloadValid(event, ctx)) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_PAYLOAD };
  }

  if (event.type === 'MATCH_END' && MATCH_END_NOOP_STATUSES.has(state.status)) {
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
