import type { EngineEvent, MatchContext, MatchRules } from '../../';
import type { EngineEventWithSeq } from '../catchUp';
import type { LiveMatchMeta } from '../viewAdapters';

export const ctx: MatchContext = { matchId: 'm', teamAId: 'teamA', teamBId: 'teamB' };

export const RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

export const T = 1_790_000_000_000;

export function ev(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
}

export function withSeq(event: EngineEvent, seq: number): EngineEventWithSeq {
  return { ...event, seq };
}

export const start = (): EngineEvent => ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules: RULES } });

export const goal = (
  id: string,
  teamId: string,
  at: number,
  clockMs: number,
  payload: Record<string, unknown> = {},
): EngineEvent => ev({ id, type: 'GOAL', at, teamId, clockMs, payload });

export const meta: LiveMatchMeta = {
  id: 'm',
  number: 7,
  phaseLabel: 'Gruppe A',
  tournamentPhase: 'groupStage',
  fieldId: 'f1',
  scheduledKickoff: '2026-09-26T12:00:00.000Z',
  refereeName: 'Schiri',
  homeTeam: { id: 'teamA', name: 'Heim' },
  awayTeam: { id: 'teamB', name: 'Gast' },
  version: 3,
};
