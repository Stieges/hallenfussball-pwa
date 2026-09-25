/**
 * `reduceMatch` faltet einen gespeicherten Ereignis-Log (Reihenfolge = Server-`seq`, R3)
 * über `initialState` ab, `applyBatch` tut dasselbe für einen Offline-Stapel mit
 * Folgeablehnung (R12). Beide sind rein -- das Systemdatum wird hier nicht gelesen.
 *
 * @see .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B1a-brief.md Abschnitt 4
 */
import { applyEvent, initialState } from './applyEvent';
import { ERROR_CODES, type EngineEvent, type ErrorCode, type MatchContext, type MatchState } from './types';

export interface EventResult {
  id: string;
  status: 'accepted' | 'noop' | 'duplicate' | 'rejected';
  code?: ErrorCode;
  detail?: unknown;
}

export interface ReduceResult {
  state: MatchState;
  results: EventResult[];
}

/** Ereignistypen, deren Ablehnung Folgeereignisse desselben Stapels DEPENDS_ON_REJECTED macht (R12). */
const CASCADE_TRIGGER_TYPES: ReadonlySet<EngineEvent['type']> = new Set([
  'MATCH_START',
  'RESUME',
  'SECTION_START',
  'REOPEN',
  'UNSKIP',
]);

/** Tiefer Vergleich zweier Ereignisse ohne `actorUser` (nur Fixture-Debug-Feld, R11). */
function isSameEventContent(a: EngineEvent, b: EngineEvent): boolean {
  const { actorUser: _actorUserA, ...restA } = a;
  const { actorUser: _actorUserB, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}

function processEvent(state: MatchState, event: EngineEvent, ctx: MatchContext): { state: MatchState; result: EventResult } {
  const existing = state.accepted[event.id];
  if (existing) {
    if (isSameEventContent(existing, event)) {
      return { state, result: { id: event.id, status: 'duplicate' } };
    }
    return { state, result: { id: event.id, status: 'rejected', code: ERROR_CODES.ID_CONFLICT } };
  }

  const outcome = applyEvent(state, event, ctx);
  if (outcome.status === 'accepted') {
    return { state: outcome.state, result: { id: event.id, status: 'accepted' } };
  }
  if (outcome.status === 'noop') {
    return { state: outcome.state, result: { id: event.id, status: 'noop' } };
  }
  return {
    state,
    result: {
      id: event.id,
      status: 'rejected',
      code: outcome.code,
      ...(outcome.detail !== undefined ? { detail: outcome.detail } : {}),
    },
  };
}

/** Faltet den gespeicherten Log ab `initialState` (keine Folgeablehnung -- das ist R12/applyBatch). */
export function reduceMatch(events: readonly EngineEvent[], ctx: MatchContext): ReduceResult {
  let state = initialState(ctx);
  const results: EventResult[] = [];
  for (const event of events) {
    const step = processEvent(state, event, ctx);
    state = step.state;
    results.push(step.result);
  }
  return { state, results };
}

/**
 * Wendet einen Offline-Stapel auf `state` an. Wird ein zustandsänderndes Ereignis
 * (MATCH_START, RESUME, SECTION_START, REOPEN, UNSKIP) abgelehnt, werden alle
 * folgenden Ereignisse dieses Stapels DEPENDS_ON_REJECTED, ohne den Zustand zu ändern (R12).
 */
export function applyBatch(state: MatchState, events: readonly EngineEvent[], ctx: MatchContext): ReduceResult {
  let currentState = state;
  const results: EventResult[] = [];
  let cascadeActive = false;

  for (const event of events) {
    if (cascadeActive) {
      results.push({ id: event.id, status: 'rejected', code: ERROR_CODES.DEPENDS_ON_REJECTED });
      continue;
    }

    const step = processEvent(currentState, event, ctx);
    currentState = step.state;
    results.push(step.result);

    if (step.result.status === 'rejected' && CASCADE_TRIGGER_TYPES.has(event.type)) {
      cascadeActive = true;
    }
  }

  return { state: currentState, results };
}
