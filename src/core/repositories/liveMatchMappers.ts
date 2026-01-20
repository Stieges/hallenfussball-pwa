/**
 * LiveMatch Mappers - Supabase ↔ LiveMatch Type Conversion
 *
 * Converts between Supabase database rows and LiveMatch frontend types.
 * Used by SupabaseLiveMatchRepository for real-time match state sync.
 */

import type { Json, Tables } from '../../types/supabase';
import type {
  LiveMatch,
  LiveTeamInfo,
  MatchEvent,
  MatchEventType,
  MatchStatus,
  PlayPhase,
  TournamentPhase,
  TiebreakerMode,
} from '../models/LiveMatch';
import type { TeamLogo, TeamColors } from '../../types/tournament';

// ============================================================================
// TYPE ALIASES
// ============================================================================

type MatchRow = Tables<'matches'>;
type MatchEventRow = Tables<'match_events'>;
type TeamRow = Tables<'teams'>;

// ============================================================================
// STATUS MAPPING
// ============================================================================

const STATUS_TO_FRONTEND: Record<string, MatchStatus> = {
  not_started: 'NOT_STARTED',
  running: 'RUNNING',
  paused: 'PAUSED',
  finished: 'FINISHED',
};

const STATUS_TO_DB: Record<MatchStatus, string> = {
  NOT_STARTED: 'not_started',
  RUNNING: 'running',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

const PHASE_TO_FRONTEND: Record<string, TournamentPhase> = {
  groupStage: 'groupStage',
  roundOf16: 'roundOf16',
  quarterfinal: 'quarterfinal',
  semifinal: 'semifinal',
  final: 'final',
};

// ============================================================================
// TEAM INFO MAPPER
// ============================================================================

/**
 * Maps a TeamRow to LiveTeamInfo
 */
export function mapTeamToLiveTeamInfo(team: TeamRow | null): LiveTeamInfo {
  if (!team) {
    return {
      id: '',
      name: 'TBD',
    };
  }

  const logo: TeamLogo | undefined = team.logo_path
    ? {
        type: 'url',
        value: team.logo_path,
        backgroundColor: team.logo_background_color ?? undefined,
      }
    : undefined;

  const colors: TeamColors | undefined =
    team.color_primary || team.color_secondary
      ? {
          primary: team.color_primary ?? '#333333',
          secondary: team.color_secondary ?? '#ffffff',
        }
      : undefined;

  return {
    id: team.id,
    name: team.name,
    logo,
    colors,
  };
}

// ============================================================================
// EVENT MAPPERS
// ============================================================================

/**
 * Maps a Supabase match_events row to MatchEvent
 */
export function mapMatchEventFromSupabase(row: MatchEventRow): MatchEvent {
  const payload = row.payload as Record<string, unknown> | null;

  return {
    id: row.id,
    matchId: row.match_id,
    timestampSeconds: row.timestamp_seconds,
    type: row.type as MatchEventType,
    payload: {
      team: payload?.team as 'home' | 'away' | undefined,
      delta: payload?.delta as number | undefined,
      playerNumber: payload?.playerNumber as number | undefined,
      assists: payload?.assists as number[] | undefined,
      cardType: payload?.cardType as 'YELLOW' | 'RED' | undefined,
      toStatus: payload?.toStatus as MatchStatus | undefined,
      durationSeconds: payload?.durationSeconds as number | undefined,
      playersIn: payload?.playersIn as number[] | undefined,
      playersOut: payload?.playersOut as number[] | undefined,
    },
    scoreAfter: {
      home: row.score_home,
      away: row.score_away,
    },
  };
}

/**
 * Maps a MatchEvent to Supabase match_events insert format
 */
export function mapMatchEventToSupabase(
  event: MatchEvent,
  matchId: string
): Omit<MatchEventRow, 'created_at'> {
  return {
    id: event.id,
    match_id: matchId,
    timestamp_seconds: event.timestampSeconds,
    type: event.type,
    payload: event.payload as unknown as Json,
    score_home: event.scoreAfter.home,
    score_away: event.scoreAfter.away,
    team_id: null, // Could be mapped if we track team_id in payload
    player_id: null, // Could be mapped if we track player_id
    period: null,
    incomplete: false,
    is_deleted: false,
  };
}

// ============================================================================
// LIVE MATCH MAPPERS
// ============================================================================

/**
 * Live state stored in JSONB column - fields not in main match row
 */
interface LiveStateJson {
  elapsedSeconds?: number;
  durationSeconds?: number;
  playPhase?: PlayPhase;
  tiebreakerMode?: TiebreakerMode;
  overtimeDurationSeconds?: number;
  overtimeElapsedSeconds?: number;
  awaitingTiebreakerChoice?: boolean;
  refereeName?: string;
}

/**
 * Maps Supabase match row + events to LiveMatch
 *
 * @param matchRow - The match row from Supabase
 * @param events - Array of match events
 * @param teamsMap - Map of team ID to TeamRow for lookup
 */
export function mapLiveMatchFromSupabase(
  matchRow: MatchRow,
  events: MatchEventRow[],
  teamsMap: Map<string, TeamRow>
): LiveMatch {
  const homeTeam = teamsMap.get(matchRow.team_a_id ?? '');
  const awayTeam = teamsMap.get(matchRow.team_b_id ?? '');

  // Parse live_state JSONB if present (note: not in generated types yet, so we cast)
  const liveState = (matchRow as MatchRow & { live_state?: LiveStateJson }).live_state;

  // Map status
  const status = STATUS_TO_FRONTEND[matchRow.match_status ?? 'not_started'] ?? 'NOT_STARTED';

  // Map tournament phase
  const tournamentPhase = matchRow.phase
    ? (PHASE_TO_FRONTEND[matchRow.phase] ?? undefined)
    : undefined;

  // Sort events by timestamp
  const sortedEvents = [...events]
    .filter((e) => !e.is_deleted)
    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  return {
    // Identity
    id: matchRow.id,
    number: matchRow.match_number ?? 0,
    phaseLabel: matchRow.label ?? matchRow.phase ?? 'Gruppe',
    fieldId: String(matchRow.field),
    scheduledKickoff: matchRow.scheduled_start ?? new Date().toISOString(),
    refereeName: liveState?.refereeName,

    // Optimistic Locking (BUG-002)
    version: matchRow.version ?? 1,

    // Teams
    homeTeam: mapTeamToLiveTeamInfo(homeTeam ?? null),
    awayTeam: mapTeamToLiveTeamInfo(awayTeam ?? null),

    // Scores
    homeScore: matchRow.score_a ?? 0,
    awayScore: matchRow.score_b ?? 0,

    // Status
    status,
    elapsedSeconds: liveState?.elapsedSeconds ?? 0,
    durationSeconds: liveState?.durationSeconds ?? (matchRow.duration_minutes ?? 10) * 60,

    // Timer persistence
    timerStartTime: matchRow.timer_start_time ?? undefined,
    timerPausedAt: matchRow.timer_paused_at ?? undefined,
    timerElapsedSeconds: matchRow.timer_elapsed_seconds ?? undefined,

    // Events
    events: sortedEvents.map(mapMatchEventFromSupabase),

    // Tournament context
    tournamentPhase,

    // Tiebreaker
    playPhase: liveState?.playPhase,
    tiebreakerMode: liveState?.tiebreakerMode,
    overtimeDurationSeconds: liveState?.overtimeDurationSeconds,
    overtimeElapsedSeconds: liveState?.overtimeElapsedSeconds,
    awaitingTiebreakerChoice: liveState?.awaitingTiebreakerChoice,

    // Tiebreaker scores
    overtimeScoreA: matchRow.overtime_score_a ?? undefined,
    overtimeScoreB: matchRow.overtime_score_b ?? undefined,
    penaltyScoreA: matchRow.penalty_score_a ?? undefined,
    penaltyScoreB: matchRow.penalty_score_b ?? undefined,
  };
}

/**
 * Maps a LiveMatch to Supabase match update format
 *
 * Returns both the match update and new events to insert
 */
export function mapLiveMatchToSupabase(
  liveMatch: LiveMatch,
  existingEventIds: Set<string> = new Set<string>()
): {
  matchUpdate: Partial<MatchRow> & { live_state: LiveStateJson | null };
  newEvents: Array<Omit<MatchEventRow, 'created_at'>>;
} {
  // Build live_state JSONB
  const liveState: LiveStateJson = {
    elapsedSeconds: liveMatch.elapsedSeconds,
    durationSeconds: liveMatch.durationSeconds,
    playPhase: liveMatch.playPhase,
    tiebreakerMode: liveMatch.tiebreakerMode,
    overtimeDurationSeconds: liveMatch.overtimeDurationSeconds,
    overtimeElapsedSeconds: liveMatch.overtimeElapsedSeconds,
    awaitingTiebreakerChoice: liveMatch.awaitingTiebreakerChoice,
    refereeName: liveMatch.refereeName,
  };

  // Match update
  const matchUpdate: Partial<MatchRow> & { live_state: LiveStateJson | null } = {
    match_status: STATUS_TO_DB[liveMatch.status],
    score_a: liveMatch.homeScore,
    score_b: liveMatch.awayScore,
    timer_start_time: liveMatch.timerStartTime ?? null,
    timer_paused_at: liveMatch.timerPausedAt ?? null,
    timer_elapsed_seconds: liveMatch.timerElapsedSeconds ?? null,
    overtime_score_a: liveMatch.overtimeScoreA ?? null,
    overtime_score_b: liveMatch.overtimeScoreB ?? null,
    penalty_score_a: liveMatch.penaltyScoreA ?? null,
    penalty_score_b: liveMatch.penaltyScoreB ?? null,
    live_state: liveMatch.status === 'FINISHED' ? null : liveState,
    updated_at: new Date().toISOString(),
  };

  // Find new events (not yet in DB)
  const newEvents = liveMatch.events
    .filter((event) => !existingEventIds.has(event.id))
    .map((event) => mapMatchEventToSupabase(event, liveMatch.id));

  return { matchUpdate, newEvents };
}

/**
 * Checks if a match is "active" (has live state)
 */
export function isMatchActive(matchRow: MatchRow): boolean {
  const status = matchRow.match_status ?? 'not_started';
  return status === 'running' || status === 'paused';
}

/**
 * Clears live state when match finishes
 */
export function clearLiveState(): { live_state: null } {
  return { live_state: null };
}
