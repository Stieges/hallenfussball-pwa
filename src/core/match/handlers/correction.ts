/**
 * CORRECTION / RESULT_ENTRY -- manuelle Standänderungen durch die Turnierleitung
 * (Brief Abschnitt 3, R8). Ruling K1: beide legen eine "Überschreibung" auf den Stapel
 * (`state.overrides`), mit einem Snapshot des zu diesem Zeitpunkt aus Toren berechneten
 * Stands -- so zählen spätere Tore (z. B. nach REOPEN) auf die Überschreibung weiter, statt
 * unsichtbar zu werden.
 */
import {
  computedScoreFor,
  effectiveScoreFor,
  type EngineEvent,
  type ErrorCode,
  type MatchContext,
  type MatchState,
  type OverrideRecord,
} from '../types';
import { ERROR_CODES } from '../types';

export type CorrectionOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail: { currentScores: Record<string, number>; lastScoreEventId: string | null } };

function snapshotFor(state: MatchState, ctx: MatchContext): Record<string, number> {
  return {
    [ctx.teamAId]: computedScoreFor(state, ctx.teamAId),
    [ctx.teamBId]: computedScoreFor(state, ctx.teamBId),
  };
}

/**
 * `basedOn` muss dem zuletzt standändernden Ereignis entsprechen (R8), sonst STALE_BASE
 * mit dem aktuellen Stand als Detail. Sonst wird die Korrektur auf den Überschreibungs-Stapel gelegt.
 */
export function applyCorrection(state: MatchState, event: EngineEvent, ctx: MatchContext): CorrectionOutcome {
  const payload = event.payload as { scores: Record<string, number>; reason: string; basedOn: string | null };
  if (payload.basedOn !== state.lastScoreEventId) {
    return {
      status: 'rejected',
      code: ERROR_CODES.STALE_BASE,
      detail: {
        currentScores: {
          [ctx.teamAId]: effectiveScoreFor(state, ctx.teamAId),
          [ctx.teamBId]: effectiveScoreFor(state, ctx.teamBId),
        },
        lastScoreEventId: state.lastScoreEventId,
      },
    };
  }

  const override: OverrideRecord = {
    id: event.id,
    kind: 'correction',
    scores: payload.scores,
    snapshot: snapshotFor(state, ctx),
    reason: payload.reason,
    basedOn: payload.basedOn,
    at: event.at,
    seq: state.nextSeq,
  };

  return {
    status: 'ok',
    state: {
      ...state,
      overrides: [...state.overrides, override],
      nextSeq: state.nextSeq + 1,
      lastScoreEventId: event.id,
    },
  };
}

/** RESULT_ENTRY: Direkteintrag, beendet das Spiel sofort mit dem eingegebenen Stand (K1: als Überschreibung). */
export function applyResultEntry(state: MatchState, event: EngineEvent, ctx: MatchContext): MatchState {
  const payload = event.payload as { scores: Record<string, number> };
  const override: OverrideRecord = {
    id: event.id,
    kind: 'direct',
    scores: payload.scores,
    snapshot: snapshotFor(state, ctx),
    basedOn: null,
    at: event.at,
    seq: state.nextSeq,
  };
  return {
    ...state,
    overrides: [...state.overrides, override],
    nextSeq: state.nextSeq + 1,
    finishedAt: event.at,
    lastScoreEventId: event.id,
  };
}
