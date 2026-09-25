/**
 * `toServerState` -- der Server-Ausschnitt aus R18/R2. Form ist verbindlich
 * (Ruling P2): B3a muss genau dieselben Felder in SQL liefern, der Gleichlauf
 * vergleicht exakt diesen Ausschnitt. Karten, Fouls und Strafen rechnet nur TS
 * (R18) und sind deshalb bewusst NICHT Teil dieses Ausschnitts.
 */
import { effectiveScoreFor, type DecidedBy, type MatchState, type ClockState, type TeamScoreBreakdown } from './types';

export interface ServerMatchState {
  status: MatchState['status'];
  phase: MatchState['phase'];
  section: number;
  clock: ClockState;
  scores: Record<string, TeamScoreBreakdown>;
  effectiveScores: Record<string, number>;
  shootoutKicks: Array<{ id: string; teamId: string; scored: boolean }>;
  lastScoreEventId: string | null;
  decidedBy: DecidedBy | null;
  finishedAt: number | null;
}

export function toServerState(state: MatchState): ServerMatchState {
  const effectiveScores: Record<string, number> = {};
  for (const teamId of Object.keys(state.scores)) {
    effectiveScores[teamId] = effectiveScoreFor(state, teamId);
  }

  return {
    status: state.status,
    phase: state.phase,
    section: state.section,
    clock: state.clock,
    scores: state.scores,
    effectiveScores,
    shootoutKicks: state.shootoutKicks.map((kick) => ({ id: kick.id, teamId: kick.teamId, scored: kick.scored })),
    lastScoreEventId: state.lastScoreEventId,
    decidedBy: state.decidedBy,
    finishedAt: state.finishedAt,
  };
}
