/**
 * Automatische Spielende-Prüfung (@endcheck, R5) -- nach MATCH_END und nach einem Golden-Goal-Tor.
 * (SHOOTOUT_END entscheidet in shootout.ts, REVIEW_ACCEPT folgt in F.)
 *
 * B1b (B-U3): Kein K.o. oder kein Remis -> finished (`regular` / `overtime` / `goldenGoal`).
 * K.o.-Remis am Ende der regulären Zeit -> je Modus Strafstoßschießen, Pause vor der Verlängerung
 * oder (ohne Modus) decision_pending. K.o.-Remis am Ende der Verlängerung -> Strafstoßschießen.
 */
import { effectiveScoreFor, type DecidedBy, type EngineEvent, type MatchContext, type MatchState } from '../types';
import { enterDecision, enterShootout } from './tiebreak';

function decidedByForPhase(state: MatchState, event: EngineEvent): DecidedBy {
  if (state.phase !== 'overtime') {
    return 'regular';
  }
  return event.type === 'GOAL' || event.type === 'OWN_GOAL' ? 'goldenGoal' : 'overtime';
}

export function runEndCheck(state: MatchState, event: EngineEvent, ctx: MatchContext): MatchState {
  const isDraw = effectiveScoreFor(state, ctx.teamAId) === effectiveScoreFor(state, ctx.teamBId);
  const isKnockout = state.rules?.knockout ?? false;

  if (!isKnockout || !isDraw) {
    return {
      ...state,
      status: 'finished',
      // Ruling K1: `decidedBy` wird zentral in applyEvent.ts aus baseDecidedBy + Überschreibungs-
      // Stapel abgeleitet (decidedByFor). Die Spielende-Prüfung setzt nur die Basis.
      baseDecidedBy: decidedByForPhase(state, event),
      finishedAt: event.at,
    };
  }

  if (state.phase === 'overtime') {
    return enterShootout(state);
  }
  return enterDecision(state, state.tiebreakMode);
}
