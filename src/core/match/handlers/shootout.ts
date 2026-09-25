/**
 * Strafstoßschießen (B1b, B-U6). Stand je Team in `scores[team].shootout`, Serie in
 * `shootoutKicks` (beides im serverState). Die Reihenfolge der Teams wird nicht erzwungen.
 * `rules.suddenDeathAfter` wird bewusst NICHT ausgewertet (nur mitgeführt): Sudden Death beginnt
 * immer nach `shootersPerTeam` Schützen je Team.
 */
import { ERROR_CODES, type EngineEvent, type ErrorCode, type MatchContext, type MatchState } from '../types';

export type ShootoutEndOutcome =
  | { status: 'ok'; state: MatchState }
  | { status: 'rejected'; code: ErrorCode; detail: { shootoutScores: Record<string, number> } };

/** SHOOTOUT_KICK: Schuss anhängen, bei Treffer `scores[team].shootout + 1`. */
export function applyShootoutKick(state: MatchState, event: EngineEvent): MatchState {
  // teamId ist durch isPayloadValid() als Pflichtfeld ∈ {teamAId, teamBId} geprüft.
  const teamId = event.teamId ?? '';
  const payload = event.payload as { scored: boolean; shooterNumber?: number };
  const previous = state.scores[teamId];
  return {
    ...state,
    shootoutKicks: [
      ...state.shootoutKicks,
      {
        id: event.id,
        teamId,
        scored: payload.scored,
        ...(payload.shooterNumber !== undefined ? { shooterNumber: payload.shooterNumber } : {}),
      },
    ],
    scores: payload.scored
      ? { ...state.scores, [teamId]: { ...previous, shootout: previous.shootout + 1 } }
      : state.scores,
  };
}

/** Rücknahme eines Schusses: aus der Serie entfernen, Treffer zurücknehmen. */
export function reverseShootoutKick(state: MatchState, targetId: string): MatchState {
  const kick = state.shootoutKicks.find((candidate) => candidate.id === targetId);
  if (!kick) {
    return state;
  }
  const previous = state.scores[kick.teamId];
  return {
    ...state,
    shootoutKicks: state.shootoutKicks.filter((candidate) => candidate.id !== targetId),
    scores: kick.scored
      ? { ...state.scores, [kick.teamId]: { ...previous, shootout: previous.shootout - 1 } }
      : state.scores,
  };
}

function tally(state: MatchState, teamId: string): { kicks: number; goals: number } {
  const kicks = state.shootoutKicks.filter((kick) => kick.teamId === teamId);
  return { kicks: kicks.length, goals: kicks.filter((kick) => kick.scored).length };
}

/**
 * Sieger oder null. (a) Beide Teams haben höchstens `shootersPerTeam` geschossen und ein Team liegt
 * uneinholbar vorn (Tore + verbleibende Schüsse des anderen < eigene Tore). (b) Beide haben gleich
 * viele Schüsse (>= shootersPerTeam) und die Tore sind verschieden (Sudden Death).
 */
export function shootoutWinner(state: MatchState, ctx: MatchContext): string | null {
  const shooters = state.rules?.shootersPerTeam ?? 0;
  const a = tally(state, ctx.teamAId);
  const b = tally(state, ctx.teamBId);

  if (a.kicks <= shooters && b.kicks <= shooters) {
    if (b.goals + (shooters - b.kicks) < a.goals) {
      return ctx.teamAId;
    }
    if (a.goals + (shooters - a.kicks) < b.goals) {
      return ctx.teamBId;
    }
  }
  if (a.kicks === b.kicks && a.kicks >= shooters && a.goals !== b.goals) {
    return a.goals > b.goals ? ctx.teamAId : ctx.teamBId;
  }
  return null;
}

/** SHOOTOUT_END: ohne Sieger NO_WINNER (detail shootoutScores), sonst Spielende `decidedBy='shootout'`. */
export function applyShootoutEnd(state: MatchState, event: EngineEvent, ctx: MatchContext): ShootoutEndOutcome {
  if (shootoutWinner(state, ctx) === null) {
    return {
      status: 'rejected',
      code: ERROR_CODES.NO_WINNER,
      detail: {
        shootoutScores: {
          [ctx.teamAId]: state.scores[ctx.teamAId].shootout,
          [ctx.teamBId]: state.scores[ctx.teamBId].shootout,
        },
      },
    };
  }
  return { status: 'ok', state: { ...state, baseDecidedBy: 'shootout', finishedAt: event.at } };
}
