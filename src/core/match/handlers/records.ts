/**
 * Tor/Eigentor sowie Karten/Zeitstrafe/Foul/Wechsel -- reine Zustandsanreicherung. Den
 * Strafen-Countdown rechnet penalties.ts (B1b).
 */
import { elapsedAt } from '../penalties';
import {
  otherTeamId,
  type CardRecord,
  type EngineEvent,
  type MatchContext,
  type MatchState,
  type PenaltyRecord,
} from '../types';

const CARD_TYPES = new Set(['YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD']);

function scorePhaseKey(state: MatchState): 'regular' | 'overtime' {
  return state.phase === 'overtime' ? 'overtime' : 'regular';
}

/**
 * GOAL/OWN_GOAL: Punkt für das torende Team (bei OWN_GOAL das jeweils andere). Ruling K5:
 * das Tor merkt sich seine Phase in `state.goals`, damit eine spätere Rücknahme -- auch nach
 * einem Phasenwechsel (Verlängerung, B1b) -- in genau dieser Phase abzieht statt in der dann
 * aktuellen.
 */
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
    goals: [...state.goals, { id: event.id, scoringTeamId: scoringTeam, phase: phaseKey, seq: state.nextSeq }],
    nextSeq: state.nextSeq + 1,
    lastScoreEventId: event.id,
  };
}

/** Rücknahme eines GOAL/OWN_GOAL: zieht in der beim Tor gespeicherten Phase ab (Ruling K5). */
export function reverseGoal(state: MatchState, targetId: string): MatchState {
  const goalRecord = state.goals.find((goal) => goal.id === targetId);
  if (!goalRecord) {
    // Kann nicht vorkommen: retract.ts prüft vorher, dass targetId ein GOAL/OWN_GOAL aus
    // `accepted` ist, und applyGoal legt für jedes solche Ereignis einen goals-Eintrag an.
    return state;
  }
  const previous = state.scores[goalRecord.scoringTeamId];
  return {
    ...state,
    scores: {
      ...state.scores,
      [goalRecord.scoringTeamId]: { ...previous, [goalRecord.phase]: previous[goalRecord.phase] - 1 },
    },
    goals: state.goals.filter((goal) => goal.id !== targetId),
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

/**
 * TIME_PENALTY (B1b, B-U5): `startMs = clockMs ?? aktuelle Spielzeit`, `durationMs =
 * (payload.durationSeconds ?? rules.penaltySeconds) * 1000` -- Ganzzahl-ms.
 */
export function applyTimePenalty(state: MatchState, event: EngineEvent): MatchState {
  const durationSeconds = (event.payload.durationSeconds as number | undefined) ?? state.rules?.penaltySeconds ?? 0;
  const record: PenaltyRecord = {
    id: event.id,
    teamId: event.teamId ?? '',
    ...(event.payload.playerNumber !== undefined ? { playerNumber: event.payload.playerNumber as number } : {}),
    startMs: event.clockMs ?? elapsedAt(state.clock, event.at),
    durationMs: durationSeconds * 1000,
  };
  return { ...state, penalties: [...state.penalties, record] };
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
