/**
 * viewAdapters (RC13): Abbildung von Engine-Zustand auf LiveMatch-Form für UI.
 * Hinweis: Flexibler EngineEvent-Record erzeugt architekturbedingte TS-Warnungen,
 * die bewusst akzeptiert und im Report belegt sind.
 */
import { cacheColumns, type MatchState } from '../';
import type { EngineEventWithSeq } from './catchUp';
import type { LiveMatch } from '../../models/LiveMatch';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import type { TournamentPhase } from '../../models/LiveMatch';
import type { MatchEventTeamRef } from '../../../utils/matchEvents';

export interface LiveMatchMeta {
  id: string;
  number: number;
  phaseLabel: string;
  fieldId: string;
  scheduledKickoff: string;
  refereeName?: string;
  homeTeam: MatchEventTeamRef;
  awayTeam: MatchEventTeamRef;
  version: number;
}

export function toLiveMatchView(state: MatchState, meta: LiveMatchMeta): LiveMatch {
  const ctx = { matchId: meta.id, teamAId: meta.homeTeam.id, teamBId: meta.awayTeam.id };
  const columns = cacheColumns(state, ctx);

  return {
    id: meta.id,
    number: meta.number,
    phaseLabel: meta.phaseLabel,
    fieldId: meta.fieldId,
    scheduledKickoff: meta.scheduledKickoff,
    refereeName: meta.refereeName,
    homeTeam: { id: meta.homeTeam.id, name: meta.homeTeam.name },
    awayTeam: { id: meta.awayTeam.id, name: meta.awayTeam.name },
    version: meta.version,
    homeScore: columns.score_a ?? 0,
    awayScore: columns.score_b ?? 0,
    status: mapStatus(state),
    elapsedSeconds: columns.timer_elapsed_seconds,
    durationSeconds: columns.live_state?.durationSeconds ?? 0,
    timerStartTime: state.clock.anchorAt ? new Date(state.clock.anchorAt).toISOString() : undefined,
    timerPausedAt: state.clock.running ? undefined : (state.clock.anchorAt ? new Date(state.clock.anchorAt).toISOString() : undefined),
    timerElapsedSeconds: columns.timer_elapsed_seconds,
    events: [], // Wird über toRuntimeEvents gefüllt
    tournamentPhase: meta.phaseLabel as TournamentPhase,
    playPhase: columns.live_state?.playPhase ?? 'regular',
    tiebreakerMode: columns.live_state?.tiebreakerMode ?? undefined,
    overtimeDurationSeconds: columns.live_state?.overtimeDurationSeconds ?? undefined,
    awaitingTiebreakerChoice: columns.live_state?.awaitingTiebreakerChoice ?? false,
    overtimeScoreA: columns.overtime_score_a ?? undefined,
    overtimeScoreB: columns.overtime_score_b ?? undefined,
    penaltyScoreA: columns.penalty_score_a ?? undefined,
    penaltyScoreB: columns.penalty_score_b ?? undefined,
  };
}

function mapStatus(state: MatchState): LiveMatch['status'] {
  switch (state.status) {
    case 'scheduled': return 'NOT_STARTED';
    case 'running': return 'RUNNING';
    case 'paused':
    case 'section_break':
    case 'decision_pending':
    case 'shootout':
      return 'PAUSED';
    case 'finished': return 'FINISHED';
    case 'skipped': return 'FINISHED';
    default: return 'NOT_STARTED';
  }
}

export function toRuntimeEvents(state: MatchState, log: EngineEventWithSeq[]): RuntimeMatchEvent[] {
  // Nur angenommene, nicht zurückgenommene Ereignisse der UI-Typen
  const shownTypes = new Set<string>(['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD', 'TIME_PENALTY', 'FOUL', 'SUBSTITUTION']);
  const filtered: EngineEventWithSeq[] = log.filter(
    (e) => shownTypes.has(e.type) && !state.retracted.includes(e.id)
  );
  const result: RuntimeMatchEvent[] = filtered.map((e: EngineEventWithSeq) => {
    const eventId: string = e.id;
    const eventTypeStr: RuntimeMatchEvent['type'] = e.type as RuntimeMatchEvent['type'];
    const eventAt: number = e.at;
    const eventPayload: Record<string, unknown> = e.payload;
    const eventTeamId: string | null | undefined = e.teamId;
    const rtEvent: RuntimeMatchEvent = {
      id: eventId,
      matchId: '',
      timestampSeconds: Math.floor(eventAt / 1000),
      type: eventTypeStr,
      payload: { ...eventPayload, teamId: eventTeamId ?? undefined },
      scoreAfter: { home: 0, away: 0 },
    };
    return rtEvent;
  });
  return result;
}

export function stableEvents(prev: RuntimeMatchEvent[], next: RuntimeMatchEvent[]): RuntimeMatchEvent[] {
  if (prev.length !== next.length) {return next;}
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id) {return next;}
  }
  return prev;
}

export function activePenaltiesView(state: MatchState): { id: string; teamId: string; remainingMs: number }[] {
  return state.penalties.map((p) => ({
    id: p.id,
    teamId: p.teamId,
    remainingMs: Math.max(0, p.durationMs - (state.clock.elapsedMs - p.startMs)),
  }));
}

export function foulCounts(state: MatchState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const foul of state.fouls) {
    counts[foul.teamId] = (counts[foul.teamId] ?? 0) + 1;
  }
  return counts;
}
