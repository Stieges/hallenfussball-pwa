/**
 * Supabase Type Mappers
 *
 * Converts between frontend types (Tournament, Team, Match)
 * and Supabase database row types.
 *
 * @see src/types/supabase.ts - Auto-generated Supabase types
 * @see src/types/tournament.ts - Frontend types
 */

import type { Database, Json } from '../../types/supabase';
import type {
  Tournament,
  Team,
  Match,
  PointSystem,
  FinalsConfig,
  RefereeConfig,
  LocationDetails,
  MatchStatus,
  MatchDecidedBy,
  TournamentStatus,
} from '../../types/tournament';

// Supabase Row Types
type TournamentRow = Database['public']['Tables']['tournaments']['Row'];
type TournamentInsert = Database['public']['Tables']['tournaments']['Insert'];
type TeamRow = Database['public']['Tables']['teams']['Row'];
type TeamInsert = Database['public']['Tables']['teams']['Insert'];
type MatchRow = Database['public']['Tables']['matches']['Row'];
type MatchInsert = Database['public']['Tables']['matches']['Insert'];
type MatchUpdate = Database['public']['Tables']['matches']['Update'];

// =============================================================================
// TEAM MAPPERS
// =============================================================================

/**
 * Maps a Supabase team row to frontend Team type
 */
export function mapTeamFromSupabase(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    group: row.group_letter ?? undefined,
    isRemoved: row.is_removed ?? undefined,
    removedAt: row.removed_at ?? undefined,
    logo: row.logo_path
      ? {
          type: 'url',
          value: row.logo_path,
          backgroundColor: row.logo_background_color ?? undefined,
        }
      : undefined,
    colors: row.color_primary
      ? {
          primary: row.color_primary,
          secondary: row.color_secondary ?? undefined,
        }
      : undefined,
  };
}

/**
 * Maps a frontend Team to Supabase insert format
 */
export function mapTeamToSupabase(
  team: Team,
  tournamentId: string
): TeamInsert {
  return {
    id: team.id,
    tournament_id: tournamentId,
    name: team.name,
    group_letter: team.group ?? null,
    is_removed: team.isRemoved ?? false,
    removed_at: team.removedAt ?? null,
    logo_path: team.logo?.type === 'url' ? team.logo.value : null,
    logo_background_color: team.logo?.backgroundColor ?? null,
    color_primary: team.colors?.primary ?? null,
    color_secondary: team.colors?.secondary ?? null,
  };
}

// =============================================================================
// MATCH MAPPERS
// =============================================================================

/**
 * Maps a Supabase match row to frontend Match type
 * Note: teamA/teamB are stored as UUIDs in Supabase, but frontend uses team names
 * The teamIdToName map is used for conversion
 */
export function mapMatchFromSupabase(
  row: MatchRow,
  teamIdToName: Map<string, string>
): Match {
  // Get team names from IDs, fallback to placeholder or 'TBD'
  const teamA = row.team_a_id
    ? teamIdToName.get(row.team_a_id) ?? row.team_a_placeholder ?? 'TBD'
    : row.team_a_placeholder ?? 'TBD';
  const teamB = row.team_b_id
    ? teamIdToName.get(row.team_b_id) ?? row.team_b_placeholder ?? 'TBD'
    : row.team_b_placeholder ?? 'TBD';

  return {
    id: row.id,
    round: row.round,
    field: row.field,
    slot: row.slot ?? undefined,
    teamA,
    teamB,
    scoreA: row.score_a ?? undefined,
    scoreB: row.score_b ?? undefined,
    group: row.group_letter ?? undefined,
    isFinal: row.is_final ?? undefined,
    finalType: row.final_type as Match['finalType'],
    label: row.label ?? undefined,
    scheduledTime: row.scheduled_start
      ? new Date(`1970-01-01T${row.scheduled_start}`)
      : undefined,
    matchNumber: row.match_number ?? undefined,
    phase: row.phase ?? undefined,
    referee: row.referee_number ?? undefined,
    matchStatus: (row.match_status as MatchStatus | null) ?? 'scheduled',
    finishedAt: row.actual_end ?? undefined,
    timerStartTime: row.timer_start_time ?? undefined,
    timerPausedAt: row.timer_paused_at ?? undefined,
    timerElapsedSeconds: row.timer_elapsed_seconds ?? undefined,
    overtimeScoreA: row.overtime_score_a ?? undefined,
    overtimeScoreB: row.overtime_score_b ?? undefined,
    penaltyScoreA: row.penalty_score_a ?? undefined,
    penaltyScoreB: row.penalty_score_b ?? undefined,
    decidedBy: row.decided_by as MatchDecidedBy | undefined,
    skippedReason: row.skipped_reason ?? undefined,
    skippedAt: row.skipped_at ?? undefined,
  };
}

/**
 * Maps a frontend Match to Supabase insert format
 * Note: teamA/teamB names need to be resolved to UUIDs
 * The teamNameToId map is used for conversion
 */
export function mapMatchToSupabase(
  match: Match,
  tournamentId: string,
  teamNameToId: Map<string, string>
): MatchInsert {
  const teamAId = teamNameToId.get(match.teamA);
  const teamBId = teamNameToId.get(match.teamB);

  return {
    id: match.id,
    tournament_id: tournamentId,
    round: match.round,
    field: match.field,
    slot: match.slot ?? null,
    team_a_id: teamAId ?? null,
    team_b_id: teamBId ?? null,
    team_a_placeholder: teamAId ? null : match.teamA,
    team_b_placeholder: teamBId ? null : match.teamB,
    score_a: match.scoreA ?? null,
    score_b: match.scoreB ?? null,
    group_letter: match.group ?? null,
    is_final: match.isFinal ?? false,
    final_type: match.finalType ?? null,
    label: match.label ?? null,
    scheduled_start: match.scheduledTime
      ? match.scheduledTime.toTimeString().slice(0, 8)
      : null,
    match_number: match.matchNumber ?? null,
    phase: match.phase ?? 'groupStage',
    referee_number: match.referee ?? null,
    match_status: match.matchStatus ?? 'scheduled',
    actual_end: match.finishedAt ?? null,
    timer_start_time: match.timerStartTime ?? null,
    timer_paused_at: match.timerPausedAt ?? null,
    timer_elapsed_seconds: match.timerElapsedSeconds ?? 0,
    overtime_score_a: match.overtimeScoreA ?? null,
    overtime_score_b: match.overtimeScoreB ?? null,
    penalty_score_a: match.penaltyScoreA ?? null,
    penalty_score_b: match.penaltyScoreB ?? null,
    decided_by: match.decidedBy ?? null,
    skipped_reason: match.skippedReason ?? null,
    skipped_at: match.skippedAt ?? null,
  };
}

/**
 * Maps a frontend Match update to Supabase update format
 */
export function mapMatchUpdateToSupabase(
  match: Partial<Match>,
  teamNameToId?: Map<string, string>
): MatchUpdate {
  const update: MatchUpdate = {};

  if (match.scoreA !== undefined) {
    update.score_a = match.scoreA;
  }
  if (match.scoreB !== undefined) {
    update.score_b = match.scoreB;
  }
  if (match.matchStatus !== undefined) {
    update.match_status = match.matchStatus;
  }
  if (match.finishedAt !== undefined) {
    update.actual_end = match.finishedAt;
  }
  if (match.timerStartTime !== undefined) {
    update.timer_start_time = match.timerStartTime;
  }
  if (match.timerPausedAt !== undefined) {
    update.timer_paused_at = match.timerPausedAt;
  }
  if (match.timerElapsedSeconds !== undefined) {
    update.timer_elapsed_seconds = match.timerElapsedSeconds;
  }
  if (match.overtimeScoreA !== undefined) {
    update.overtime_score_a = match.overtimeScoreA;
  }
  if (match.overtimeScoreB !== undefined) {
    update.overtime_score_b = match.overtimeScoreB;
  }
  if (match.penaltyScoreA !== undefined) {
    update.penalty_score_a = match.penaltyScoreA;
  }
  if (match.penaltyScoreB !== undefined) {
    update.penalty_score_b = match.penaltyScoreB;
  }
  if (match.decidedBy !== undefined) {
    update.decided_by = match.decidedBy;
  }
  if (match.skippedReason !== undefined) {
    update.skipped_reason = match.skippedReason;
  }
  if (match.skippedAt !== undefined) {
    update.skipped_at = match.skippedAt;
  }

  // Handle team changes if teamNameToId is provided
  if (teamNameToId && match.teamA !== undefined) {
    const teamAId = teamNameToId.get(match.teamA);
    update.team_a_id = teamAId ?? null;
    update.team_a_placeholder = teamAId ? null : match.teamA;
  }
  if (teamNameToId && match.teamB !== undefined) {
    const teamBId = teamNameToId.get(match.teamB);
    update.team_b_id = teamBId ?? null;
    update.team_b_placeholder = teamBId ? null : match.teamB;
  }

  update.updated_at = new Date().toISOString();

  return update;
}

// =============================================================================
// TOURNAMENT MAPPERS
// =============================================================================

/**
 * Extended config stored in tournaments.config JSON column
 * Contains fields not directly mapped to columns
 */
interface TournamentConfig {
  // Legacy/deprecated fields
  gameDuration?: number;
  breakDuration?: number;

  // Group/Finals config
  groupSystem?: string;
  numberOfRounds?: number;
  roundLogic?: string;
  minRestSlots?: number;

  // Bambini settings
  isKidsTournament?: boolean;
  hideScoresForPublic?: boolean;
  hideRankingsForPublic?: boolean;
  resultMode?: string;

  // Finals legacy
  finals?: {
    final: boolean;
    thirdPlace: boolean;
    fifthSixth: boolean;
    seventhEighth: boolean;
  };

  // Playoff config
  playoffConfig?: unknown;

  // Mode settings
  mode?: string;
  tournamentType?: string;
  ageClass?: string;
  organizer?: string;

  // Time settings
  gamePeriods?: number;
  halftimeBreak?: number;
  breakBetweenPhases?: number;

  // Dashboard metadata
  dashboardStatus?: string;
  tournamentSystem?: string;
  statsSnapshot?: unknown;
  cancelledReason?: string;
  cancelledAt?: string;
  adminNotes?: string;
  manuallyCompleted?: boolean;

  // Match cockpit settings
  matchCockpitSettings?: unknown;

  // Placement criteria
  placementLogic?: unknown[];

  // Field assignments
  fieldAssignments?: Record<string, number>;

  // Groups and fields config
  groups?: unknown[];
  fields?: unknown[];

  // Contact info
  contactInfo?: unknown;

  // External import marker
  isExternal?: boolean;
  externalSource?: string;

  // Sport ID
  sportId?: string;

  // DFB settings
  useDFBKeys?: boolean;
  dfbKeyPattern?: string;

  // Wizard state
  lastVisitedStep?: number;
}

/**
 * Maps Supabase tournament row + teams + matches to frontend Tournament type
 */
export function mapTournamentFromSupabase(
  row: TournamentRow,
  teamRows: TeamRow[],
  matchRows: MatchRow[]
): Tournament {
  // Build team ID to name map for match conversion
  const teamIdToName = new Map<string, string>();
  teamRows.forEach((t) => teamIdToName.set(t.id, t.name));

  // Map teams
  const teams = teamRows.map(mapTeamFromSupabase);

  // Map matches
  const matches = matchRows.map((m) => mapMatchFromSupabase(m, teamIdToName));

  // Parse config JSON
  const config = (row.config as TournamentConfig | null) ?? {};

  // Parse point system (cast via unknown due to Json type)
  const pointSystem = (row.point_system as unknown as PointSystem | null) ?? {
    win: 3,
    draw: 1,
    loss: 0,
  };

  // Parse finals config
  const finalsConfig = row.finals_config as FinalsConfig | null;

  // Parse referee config
  const refereeConfig = row.referee_config as RefereeConfig | null;

  // Build location
  const location: LocationDetails = {
    name: row.location_name || '',
    street: row.location_street ?? undefined,
    city: row.location_city ?? undefined,
    postalCode: row.location_postal_code ?? undefined,
    country: row.location_country ?? undefined,
  };

  return {
    id: row.id,
    status: row.status as TournamentStatus,
    sport: row.sport as Tournament['sport'],
    sportId: config.sportId as Tournament['sportId'],
    tournamentType: (row.tournament_type ||
      config.tournamentType ||
      'classic') as Tournament['tournamentType'],
    mode: (config.mode || 'classic') as Tournament['mode'],
    numberOfFields: row.number_of_fields,
    numberOfTeams: row.number_of_teams,
    groupSystem: config.groupSystem as Tournament['groupSystem'],
    numberOfGroups: row.number_of_groups ?? undefined,
    groupPhaseGameDuration: row.group_phase_duration,
    groupPhaseBreakDuration: row.group_phase_break ?? undefined,
    finalRoundGameDuration: row.final_round_duration ?? undefined,
    finalRoundBreakDuration: row.final_round_break ?? undefined,
    breakBetweenPhases: config.breakBetweenPhases,
    gamePeriods: config.gamePeriods,
    halftimeBreak: config.halftimeBreak,
    gameDuration: config.gameDuration,
    breakDuration: config.breakDuration,
    roundLogic: config.roundLogic as Tournament['roundLogic'],
    numberOfRounds: config.numberOfRounds,
    placementLogic: (config.placementLogic ??
      []) as Tournament['placementLogic'],
    finalsConfig: finalsConfig ?? undefined,
    refereeConfig: refereeConfig ?? undefined,
    fieldAssignments: config.fieldAssignments,
    groups: config.groups as Tournament['groups'],
    fields: config.fields as Tournament['fields'],
    finals: config.finals ?? {
      final: false,
      thirdPlace: false,
      fifthSixth: false,
      seventhEighth: false,
    },
    playoffConfig: config.playoffConfig as Tournament['playoffConfig'],
    minRestSlots: config.minRestSlots,
    isKidsTournament: config.isKidsTournament ?? false,
    hideScoresForPublic: config.hideScoresForPublic ?? false,
    hideRankingsForPublic: config.hideRankingsForPublic ?? false,
    resultMode: (config.resultMode || 'goals') as Tournament['resultMode'],
    pointSystem,
    title: row.title,
    ageClass: config.ageClass || '',
    date: row.date,
    timeSlot: row.start_time || '',
    startDate: row.date,
    startTime: row.start_time ?? undefined,
    location,
    organizer: config.organizer,
    contactInfo: config.contactInfo as Tournament['contactInfo'],
    teams,
    matches,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    lastVisitedStep: config.lastVisitedStep,
    manuallyCompleted: config.manuallyCompleted,
    completedAt: row.completed_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    dashboardStatus: config.dashboardStatus as Tournament['dashboardStatus'],
    tournamentSystem: config.tournamentSystem as Tournament['tournamentSystem'],
    statsSnapshot: config.statsSnapshot as Tournament['statsSnapshot'],
    cancelledReason: config.cancelledReason,
    cancelledAt: config.cancelledAt,
    adminNotes: config.adminNotes,
    matchCockpitSettings:
      config.matchCockpitSettings as Tournament['matchCockpitSettings'],
    isExternal: config.isExternal,
    externalSource: config.externalSource,
    useDFBKeys: config.useDFBKeys,
    dfbKeyPattern: config.dfbKeyPattern,
  };
}

/**
 * Maps frontend Tournament to Supabase insert format
 * Returns tournament row, team rows, and match rows
 */
export function mapTournamentToSupabase(
  tournament: Tournament,
  ownerId: string
): {
  tournamentRow: TournamentInsert;
  teamRows: TeamInsert[];
  matchRows: MatchInsert[];
} {
  // Build config object for extended fields
  const config: TournamentConfig = {
    mode: tournament.mode,
    tournamentType: tournament.tournamentType,
    groupSystem: tournament.groupSystem,
    numberOfRounds: tournament.numberOfRounds,
    roundLogic: tournament.roundLogic,
    minRestSlots: tournament.minRestSlots,
    isKidsTournament: tournament.isKidsTournament,
    hideScoresForPublic: tournament.hideScoresForPublic,
    hideRankingsForPublic: tournament.hideRankingsForPublic,
    resultMode: tournament.resultMode,
    finals: tournament.finals,
    playoffConfig: tournament.playoffConfig,
    gameDuration: tournament.gameDuration,
    breakDuration: tournament.breakDuration,
    gamePeriods: tournament.gamePeriods,
    halftimeBreak: tournament.halftimeBreak,
    breakBetweenPhases: tournament.breakBetweenPhases,
    placementLogic: tournament.placementLogic,
    fieldAssignments: tournament.fieldAssignments,
    groups: tournament.groups,
    fields: tournament.fields,
    ageClass: tournament.ageClass,
    organizer: tournament.organizer,
    contactInfo: tournament.contactInfo,
    dashboardStatus: tournament.dashboardStatus,
    tournamentSystem: tournament.tournamentSystem,
    statsSnapshot: tournament.statsSnapshot,
    cancelledReason: tournament.cancelledReason,
    cancelledAt: tournament.cancelledAt,
    adminNotes: tournament.adminNotes,
    manuallyCompleted: tournament.manuallyCompleted,
    matchCockpitSettings: tournament.matchCockpitSettings,
    lastVisitedStep: tournament.lastVisitedStep,
    isExternal: tournament.isExternal,
    externalSource: tournament.externalSource,
    sportId: tournament.sportId,
    useDFBKeys: tournament.useDFBKeys,
    dfbKeyPattern: tournament.dfbKeyPattern,
  };

  const tournamentRow: TournamentInsert = {
    id: tournament.id,
    owner_id: ownerId,
    status: tournament.status,
    title: tournament.title,
    sport: tournament.sport,
    tournament_type: tournament.tournamentType,
    date: tournament.startDate || tournament.date,
    start_time: tournament.startTime || tournament.timeSlot || null,
    location_name: tournament.location.name || null,
    location_street: tournament.location.street || null,
    location_city: tournament.location.city || null,
    location_postal_code: tournament.location.postalCode || null,
    location_country: tournament.location.country || 'Deutschland',
    number_of_fields: tournament.numberOfFields,
    number_of_teams: tournament.numberOfTeams,
    number_of_groups: tournament.numberOfGroups || null,
    group_phase_duration: tournament.groupPhaseGameDuration,
    group_phase_break: tournament.groupPhaseBreakDuration || null,
    final_round_duration: tournament.finalRoundGameDuration || null,
    final_round_break: tournament.finalRoundBreakDuration || null,
    point_system: tournament.pointSystem as unknown as Json,
    finals_config: (tournament.finalsConfig ?? null) as unknown as Json,
    referee_config: (tournament.refereeConfig ?? null) as unknown as Json,
    config: config as unknown as Json,
    deleted_at: tournament.deletedAt || null,
    completed_at: tournament.completedAt || null,
  };

  // Map teams
  const teamRows = tournament.teams.map((team) =>
    mapTeamToSupabase(team, tournament.id)
  );

  // Build team name to ID map for match conversion
  const teamNameToId = new Map<string, string>();
  tournament.teams.forEach((t) => teamNameToId.set(t.name, t.id));

  // Map matches
  const matchRows = tournament.matches.map((match) =>
    mapMatchToSupabase(match, tournament.id, teamNameToId)
  );

  return { tournamentRow, teamRows, matchRows };
}
