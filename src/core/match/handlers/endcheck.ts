/**
 * Automatische Spielende-Prüfung (@endcheck, R5) -- B1a-Stand: nur nach MATCH_END.
 * Golden-Goal/SHOOTOUT_END/REVIEW_ACCEPT-Auslöser folgen mit ihrer Semantik in B1b/F.
 */
import { effectiveScoreFor, type EngineEvent, type MatchContext, type MatchState } from '../types';

export function runEndCheck(state: MatchState, event: EngineEvent, ctx: MatchContext): MatchState {
  const teamAEffective = effectiveScoreFor(state, ctx.teamAId);
  const teamBEffective = effectiveScoreFor(state, ctx.teamBId);
  const isDraw = teamAEffective === teamBEffective;
  const isKnockout = state.rules?.knockout ?? false;

  if (!isKnockout || !isDraw) {
    return {
      ...state,
      status: 'finished',
      decidedBy: state.phase === 'overtime' ? 'overtime' : 'regular',
      finishedAt: event.at,
    };
  }

  return { ...state, status: 'decision_pending' };
}
