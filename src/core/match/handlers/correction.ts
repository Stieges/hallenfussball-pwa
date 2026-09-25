/**
 * CORRECTION / RESULT_ENTRY -- manuelle Standänderungen durch die Turnierleitung
 * (Brief Abschnitt 3, R8).
 */
import { effectiveScoreFor, type EngineEvent, type ErrorCode, type MatchContext, type MatchState } from '../types';
import { ERROR_CODES } from '../types';

export type CorrectionOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail: { currentScores: Record<string, number>; lastScoreEventId: string | null } };

/**
 * `basedOn` muss dem zuletzt standändernden Ereignis entsprechen (R8), sonst STALE_BASE
 * mit dem aktuellen Stand als Detail. Sonst wird `correctedScores` gesetzt.
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

  return {
    status: 'ok',
    state: {
      ...state,
      correctedScores: payload.scores,
      corrections: [
        ...state.corrections,
        { id: event.id, scores: payload.scores, reason: payload.reason, basedOn: payload.basedOn, at: event.at },
      ],
      decidedBy: 'correction',
      lastScoreEventId: event.id,
    },
  };
}

/** RESULT_ENTRY: Direkteintrag, beendet das Spiel sofort mit dem eingegebenen Stand. */
export function applyResultEntry(state: MatchState, event: EngineEvent): MatchState {
  const payload = event.payload as { scores: Record<string, number> };
  return {
    ...state,
    correctedScores: payload.scores,
    decidedBy: 'direct',
    finishedAt: event.at,
    lastScoreEventId: event.id,
  };
}
