/**
 * Tor/Eigentor sowie Karten/Zeitstrafe/Foul/Wechsel -- reine Zustandsanreicherung,
 * die Strafen-Countdown-Semantik selbst kommt erst in B1b (Brief Abschnitt 3).
 */
import { otherTeamId, type CardRecord, type EngineEvent, type MatchContext, type MatchState } from '../types';

const CARD_TYPES = new Set(['YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD']);

function scorePhaseKey(state: MatchState): 'regular' | 'overtime' {
  return state.phase === 'overtime' ? 'overtime' : 'regular';
}

/** GOAL/OWN_GOAL: Punkt für das torende Team (bei OWN_GOAL das jeweils andere). */
export function applyGoal(state: MatchState, event: EngineEvent, ctx: MatchContext): MatchState {
  // teamId ist bereits durch isPayloadValid() als Pflichtfeld ∈ {teamAId, teamBId} geprüft.
  const eventTeamId = event.teamId ?? ctx.teamAId;
  const scoringTeam = event.type === 'OWN_GOAL' ? otherTeamId(ctx, eventTeamId) : eventTeamId;
  const phaseKey = scorePhaseKey(state);
  const previous = state.scores[scoringTeam];
  return {
    ...state,
    scores: {
      ...state.scores,
      [scoringTeam]: { ...previous, [phaseKey]: previous[phaseKey] + 1 },
    },
    lastScoreEventId: event.id,
  };
}

/** Rücknahme eines GOAL/OWN_GOAL: kehrt applyGoal exakt um. */
export function reverseGoal(state: MatchState, target: EngineEvent, ctx: MatchContext): MatchState {
  const eventTeamId = target.teamId ?? ctx.teamAId;
  const scoringTeam = target.type === 'OWN_GOAL' ? otherTeamId(ctx, eventTeamId) : eventTeamId;
  const phaseKey = scorePhaseKey(state);
  const previous = state.scores[scoringTeam];
  return {
    ...state,
    scores: {
      ...state.scores,
      [scoringTeam]: { ...previous, [phaseKey]: previous[phaseKey] - 1 },
    },
  };
}

export function applyCard(state: MatchState, event: EngineEvent): MatchState {
  const record: CardRecord = {
    id: event.id,
    type: event.type as CardRecord['type'],
    teamId: event.teamId ?? '',
    ...(event.payload.playerNumber !== undefined ? { playerNumber: event.payload.playerNumber as number } : {}),
    clockMs: event.clockMs,
    section: event.section,
  };
  return { ...state, cards: [...state.cards, record] };
}

export function applyFoul(state: MatchState, event: EngineEvent): MatchState {
  return {
    ...state,
    fouls: [
      ...state.fouls,
      {
        id: event.id,
        teamId: event.teamId ?? '',
        ...(event.payload.playerNumber !== undefined ? { playerNumber: event.payload.playerNumber as number } : {}),
        clockMs: event.clockMs,
        section: event.section,
      },
    ],
  };
}

export function applyTimePenalty(state: MatchState, event: EngineEvent): MatchState {
  const durationSeconds = (event.payload.durationSeconds as number | undefined) ?? state.rules?.penaltySeconds ?? 0;
  return {
    ...state,
    penalties: [
      ...state.penalties,
      {
        id: event.id,
        teamId: event.teamId ?? '',
        ...(event.payload.playerNumber !== undefined ? { playerNumber: event.payload.playerNumber as number } : {}),
        durationSeconds,
        clockMs: event.clockMs,
        section: event.section,
      },
    ],
  };
}

export function applySubstitution(state: MatchState, event: EngineEvent): MatchState {
  return {
    ...state,
    substitutions: [
      ...state.substitutions,
      {
        id: event.id,
        teamId: event.teamId ?? '',
        ...(event.payload.playerNumber !== undefined ? { playerNumber: event.payload.playerNumber as number } : {}),
        clockMs: event.clockMs,
        section: event.section,
      },
    ],
  };
}

export function isCardType(type: string): boolean {
  return CARD_TYPES.has(type);
}
