/**
 * `cacheColumns` -- TS-Zwilling von `match_engine.cache_columns` (supabase/migrations/
 * 20260928_003_append_match_events.sql, R15), erweitert um die Abschnittsuhr in `live_state`
 * (V2/RC12: `sections`, `sectionSeconds`, `breakSeconds`, `overtimeSeconds`, `sectionStartMs`,
 * `breakStartedAt`). Monitor und Cockpit rechnen daraus dieselbe Anzeige. Werte exakt wie SQL:
 * Ganzzahlen, `null` statt fehlender Schlüssel.
 */
import { effectiveScoreFor, type MatchContext, type MatchState, type MatchStatus, type Phase, type TiebreakMode } from '../types';

export type CacheMatchStatus = Exclude<MatchStatus, 'section_break' | 'decision_pending' | 'shootout'>;
export type CacheDecidedBy = 'regular' | 'overtime' | 'goldenGoal' | 'penalty';

export interface CacheLiveState {
  engine: true;
  status: MatchStatus;
  phase: Phase;
  section: number;
  running: boolean;
  elapsedMs: number;
  anchorAt: number | null;
  elapsedSeconds: number;
  durationSeconds: number;
  playPhase: 'regular' | 'overtime' | 'goldenGoal' | 'penalty';
  tiebreakerMode: TiebreakMode | null;
  overtimeDurationSeconds: number | null;
  awaitingTiebreakerChoice: boolean;
  sections: number | null;
  sectionSeconds: number | null;
  breakSeconds: number | null;
  overtimeSeconds: number | null;
  sectionStartMs: number;
  breakStartedAt: number | null;
}

export interface CacheColumns {
  score_a: number | null;
  score_b: number | null;
  overtime_score_a: number | null;
  overtime_score_b: number | null;
  penalty_score_a: number | null;
  penalty_score_b: number | null;
  match_status: CacheMatchStatus;
  decided_by: CacheDecidedBy | null;
  running: boolean;
  started: boolean;
  anchor_at: number | null;
  timer_elapsed_seconds: number;
  finished_at: number | null;
  live_state: CacheLiveState | null;
}

function cacheStatus(status: MatchStatus): CacheMatchStatus {
  return status === 'section_break' || status === 'decision_pending' || status === 'shootout' ? 'paused' : status;
}

function cacheDecidedBy(state: MatchState): CacheDecidedBy | null {
  if (state.status !== 'finished' || state.decidedBy === null) {
    return null;
  }
  if (state.decidedBy === 'shootout') {
    return 'penalty';
  }
  return state.decidedBy === 'correction' || state.decidedBy === 'direct' ? 'regular' : state.decidedBy;
}

function playPhaseOf(state: MatchState): CacheLiveState['playPhase'] {
  if (state.phase === 'shootout') {
    return 'penalty';
  }
  if (state.phase === 'overtime') {
    return state.tiebreakMode === 'goldenGoal' ? 'goldenGoal' : 'overtime';
  }
  return 'regular';
}

function liveStateOf(state: MatchState): CacheLiveState {
  const { rules, clock } = state;
  return {
    engine: true,
    status: state.status,
    phase: state.phase,
    section: state.section,
    running: clock.running,
    elapsedMs: clock.elapsedMs,
    anchorAt: clock.anchorAt,
    elapsedSeconds: Math.floor(clock.elapsedMs / 1000),
    durationSeconds: (rules?.sections ?? 1) * (rules?.sectionSeconds ?? 0),
    playPhase: playPhaseOf(state),
    tiebreakerMode: state.tiebreakMode,
    overtimeDurationSeconds: rules?.overtimeSeconds ?? null,
    awaitingTiebreakerChoice: state.status === 'decision_pending',
    sections: rules?.sections ?? null,
    sectionSeconds: rules?.sectionSeconds ?? null,
    breakSeconds: rules?.breakSeconds ?? null,
    overtimeSeconds: rules?.overtimeSeconds ?? null,
    sectionStartMs: state.sectionStartMs,
    breakStartedAt: state.breakStartedAt,
  };
}

export function cacheColumns(state: MatchState, ctx: MatchContext): CacheColumns {
  const { teamAId, teamBId } = ctx;
  const scoreA = state.scores[teamAId];
  const scoreB = state.scores[teamBId];
  const unplayed = state.status === 'scheduled' || state.status === 'skipped';
  const hasOverride = state.overrides.length > 0;
  const hadOvertime =
    state.phase === 'overtime' ||
    scoreA.overtime + scoreB.overtime > 0 ||
    state.baseDecidedBy === 'overtime' ||
    state.baseDecidedBy === 'goldenGoal';
  const inShootout = state.phase === 'shootout' && !unplayed;

  const regularScore = (teamId: string, breakdown: MatchState['scores'][string]): number | null => {
    if (unplayed) {
      return null;
    }
    return hasOverride ? effectiveScoreFor(state, teamId) : breakdown.regular;
  };
  const overtimeScore = (breakdown: MatchState['scores'][string]): number | null => {
    if (unplayed || !hadOvertime) {
      return null;
    }
    return hasOverride ? 0 : breakdown.overtime;
  };

  return {
    score_a: regularScore(teamAId, scoreA),
    score_b: regularScore(teamBId, scoreB),
    overtime_score_a: overtimeScore(scoreA),
    overtime_score_b: overtimeScore(scoreB),
    penalty_score_a: inShootout ? scoreA.shootout : null,
    penalty_score_b: inShootout ? scoreB.shootout : null,
    match_status: cacheStatus(state.status),
    decided_by: cacheDecidedBy(state),
    running: state.clock.running,
    started: !unplayed,
    anchor_at: state.clock.running ? state.clock.anchorAt : null,
    timer_elapsed_seconds: Math.floor(state.clock.elapsedMs / 1000),
    finished_at: state.finishedAt,
    live_state: unplayed || state.status === 'finished' ? null : liveStateOf(state),
  };
}
