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
import { completeMatchCockpitSettings } from '../../types/tournament';
// Renamed on import: this file already has its own `MatchUpdate` (the Supabase table's Update
// shape, below) -- `DomainMatchUpdate` is the frontend/domain DTO (`core/models/types.ts`), which
// (since A2 Fixrunde 3, N2) allows `null` on result/status fields to survive the offline mutation
// queue's JSON round-trip.
import type { MatchUpdate as DomainMatchUpdate } from '../models/types';
import { RepositoryError } from '../errors';
import { SlotSourceSchema, TeamIdSchema, type MatchSlot, type SlotSource } from '../models/schemas/MatchSlotSchema';
import { pendingSlot, slotSource, slotTeamId, teamSlot } from '../models/matchSlot';
import { ensureMatchNumbers, sortByMatchNumber } from '../models/matchNumbers';
import { originFromRow, originToColumns, type MatchOriginColumns } from './matchOriginColumns';
import { kitFromRow } from './matchKitRow';
import { bibColorFromConfig, bibColorToConfig } from './tournamentBibColor';
import { spectatorDisplayFromConfig, spectatorDisplayToConfig } from './tournamentSpectatorDisplay';
import { hostTeamsFromConfig, hostTeamsToConfig } from './tournamentHostTeams';
import { changeRevisionFromRow } from './tournamentChangeRevisionRow';
import { effectivePlacementLogic } from '../standings/placementDefaults';
import { standingDecisionsFromConfig, standingDecisionsToConfig } from './standingDecisionsConfig';
import { forfeitFromRow, forfeitScoreFromConfig, forfeitScoreToConfig, type MatchForfeitColumns } from './matchForfeitRow';

// Supabase Row Types
type TournamentRow = Database['public']['Tables']['tournaments']['Row'];
type TournamentInsert = Database['public']['Tables']['tournaments']['Insert'];
type TournamentUpdate = Database['public']['Tables']['tournaments']['Update'];
type TeamRow = Database['public']['Tables']['teams']['Row'];
type TeamInsert = Database['public']['Tables']['teams']['Insert'];
// A-36a: `origin_a/origin_b` (20261026_001_match_origin.sql) bis zur Neuerzeugung von supabase.ts von Hand ergänzt.
type MatchRow = Database['public']['Tables']['matches']['Row'] & MatchOriginColumns & MatchForfeitColumns;
type MatchInsert = Database['public']['Tables']['matches']['Insert'] & MatchOriginColumns;
type MatchUpdate = Database['public']['Tables']['matches']['Update'];
type CollaboratorInsert = Database['public']['Tables']['tournament_collaborators']['Insert'];
type CollaboratorUpdate = Database['public']['Tables']['tournament_collaborators']['Update'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

// Re-export so callers don't need to know the table-key plumbing.
export type { TournamentUpdate, CollaboratorInsert, CollaboratorUpdate, ProfileUpdate };

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
 * Extended TeamInsert with denormalized owner_id for RLS
 * owner_id is added via migration 002_denormalize_owner
 */
type TeamInsertWithOwner = TeamInsert & {
  owner_id?: string | null;
  is_public?: boolean | null;
};

/**
 * Maps a frontend Team to Supabase insert format
 * @param team - The team to map
 * @param tournamentId - The tournament ID
 * @param ownerId - Optional owner ID for RLS denormalization
 * @param isPublic - Optional public visibility flag
 */
export function mapTeamToSupabase(
  team: Team,
  tournamentId: string,
  ownerId?: string,
  isPublic?: boolean
): TeamInsertWithOwner {
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
    // Denormalized fields for RLS performance
    owner_id: ownerId ?? null,
    is_public: isPublic ?? false,
  };
}

// =============================================================================
// MATCH MAPPERS
// =============================================================================

type Side = 'A' | 'B';

/**
 * A-02: Spielseite aus der Zeile – `team_x_id` gesetzt → Team-Slot (Herkunft, falls vorhanden, als
 * `resolvedFrom`); sonst offener Slot mit Herkunft. Keine Namens-Map, kein Platzhalter-Text.
 * Weder Team-ID noch Herkunft oder eine ungültige Herkunft → lautes Scheitern (die DB-Prüfung
 * `matches_slot_x_present`/`matches_slot_x_source_valid` macht das unerreichbar; tritt es doch auf,
 * ist die Zeile kaputt und darf nicht still als „TBD“ weiterleben).
 */
function slotFromRow(matchId: string, side: Side, teamId: string | null, source: Json | null | undefined): MatchSlot {
  let origin: SlotSource | undefined;
  if (source !== null && source !== undefined) {
    const parsed = SlotSourceSchema.safeParse(source);
    if (!parsed.success) {
      throw new RepositoryError('mapMatch', `Spiel ${matchId}, Seite ${side}: Herkunft ungültig (${JSON.stringify(source)})`);
    }
    origin = parsed.data;
  }
  if (teamId !== null) {
    if (!TeamIdSchema.safeParse(teamId).success) {
      throw new RepositoryError('mapMatch', `Spiel ${matchId}, Seite ${side}: Team-ID ist keine UUID (${teamId})`);
    }
    return teamSlot(teamId, origin);
  }
  if (origin === undefined) {
    throw new RepositoryError('mapMatch', `Spiel ${matchId}, Seite ${side}: weder Team-ID noch Herkunft`);
  }
  return pendingSlot(origin);
}

/**
 * Anstoß eines Spiels = Turnierdatum + Anstoßzeit (C-ANSTOSS-OHNE-DATUM, @SL-118). `matches.scheduled_start` ist nur
 * eine Uhrzeit (`time`); ohne das Datum des Turniers rechnete das Cockpit ab dem 1.1.1970. Die Wanduhr gilt wie im
 * Erzeuger (`parseStartTime`), in `kickoffLocal` und beim Rückschreiben (`toTimeString`) als Ortszeit des Geräts.
 */
function kickoffOf(tournamentDate: string, startTime: string | null): Date | undefined {
  if (!startTime) {
    return undefined;
  }
  const kickoff = new Date(`${tournamentDate.slice(0, 10)}T${startTime}`);
  return Number.isNaN(kickoff.getTime()) ? undefined : kickoff;
}

/**
 * Maps a Supabase match row to frontend Match type.
 *
 * `tournamentDate`: Turnierdatum (`tournaments.date`, YYYY-MM-DD) – der Tag, an dem die Anstoßzeit liegt.
 *
 * A-02: `slotA/slotB` aus Team-ID bzw. Herkunft (siehe `slotFromRow`); A-36a: `originA/originB` aus
 * `origin_a/origin_b` (Herkunft des Platzes, `originFromRow`).
 */
export function mapMatchFromSupabase(row: MatchRow, tournamentDate: string): Match {
  const slotA = slotFromRow(row.id, 'A', row.team_a_id, row.slot_a_source);
  const slotB = slotFromRow(row.id, 'B', row.team_b_id, row.slot_b_source);

  return {
    id: row.id,
    round: row.round,
    field: row.field,
    slot: row.slot ?? undefined,
    slotA,
    slotB,
    ...originFromRow(row), ...kitFromRow(row), // A-36a: Herkunft des Platzes; A-30a: getragene Farben (nur lesen)
    scoreA: row.score_a ?? undefined,
    scoreB: row.score_b ?? undefined,
    group: row.group_letter ?? undefined,
    isFinal: row.is_final ?? undefined,
    finalType: row.final_type as Match['finalType'],
    label: row.label ?? undefined,
    scheduledTime: kickoffOf(tournamentDate, row.scheduled_start),
    matchNumber: row.match_number ?? undefined,
    phase: row.phase ?? undefined,
    referee: row.referee_number ?? undefined,
    matchStatus: (row.match_status as MatchStatus | null) ?? 'scheduled',
    liveState: row.live_state ?? undefined,
    finishedAt: row.actual_end ?? undefined,
    timerStartTime: row.timer_start_time ?? undefined,
    timerPausedAt: row.timer_paused_at ?? undefined,
    timerElapsedSeconds: row.timer_elapsed_seconds ?? undefined,
    overtimeScoreA: row.overtime_score_a ?? undefined,
    overtimeScoreB: row.overtime_score_b ?? undefined,
    penaltyScoreA: row.penalty_score_a ?? undefined,
    penaltyScoreB: row.penalty_score_b ?? undefined,
    decidedBy: row.decided_by as MatchDecidedBy | undefined,
    ...forfeitFromRow(row), // A-25c: wer bei einer Wertung fehlte (nur aus select('*'), ab 20261110_005)
    skippedReason: row.skipped_reason ?? undefined,
    skippedAt: row.skipped_at ?? undefined,
  };
}

/**
 * Extended MatchInsert with denormalized owner_id for RLS
 * owner_id is added via migration 002_denormalize_owner
 */
type MatchInsertWithOwner = MatchInsert & {
  owner_id?: string | null;
  is_public?: boolean | null;
};

/** A-02: Slot einer Seite – fehlt er, scheitert das Schreiben laut (kein Rückfall auf `teamA`). */
function requireSlot(match: Pick<Match, 'id' | 'slotA' | 'slotB'>, side: Side): MatchSlot {
  const slot = side === 'A' ? match.slotA : match.slotB;
  if (slot === undefined) {
    throw new RepositoryError('mapMatch', `Spiel ${match.id}: Seite ${side} ohne Slot (Team-ID oder Herkunft)`);
  }
  return slot;
}

/** Spalten einer Seite: Team-ID (offen → NULL) und Herkunft (direkt besetzt → NULL). */
function slotColumns(slot: MatchSlot): { teamId: string | null; source: Json | null } {
  return { teamId: slotTeamId(slot) ?? null, source: slotSource(slot) ?? null };
}

/** C2 (@TM-027): lokal offene Seite (keine Team-ID) + in der Cloud besetzt → die Cloud-Seite bleibt. */
function keepsRemoteSide(localTeamId: string | null, remoteTeamId: string | null | undefined): boolean {
  return localTeamId === null && (remoteTeamId ?? null) !== null;
}

/**
 * Maps a frontend Match to Supabase insert format.
 *
 * A-02 (MVP-Bauplan Spur A, C-TEAMREF): die Spielseiten kommen AUSSCHLIESSLICH aus `slotA/slotB` –
 * `team_x_id` = Team-ID, `slot_x_source` = Herkunft. Keine Namenssuche mehr: vorher suchte der
 * Mapper das Übergangsfeld `teamA` (eine Team-ID) in einer Name→ID-Map, fand nichts, schrieb die ID als Text in
 * `team_x_placeholder` und `team_x_id = NULL` – `append_match_events` lehnte jedes Spiel mit 22023 ab.
 * `team_x_placeholder` wird nicht mehr befüllt (Altspalte, nur noch NULL).
 *
 * C3a-2b (V4b/F2/R1): the INSERT carries only NEUTRAL initial values for result/status/timer
 * columns — score_a/score_b are hard-set to `null` (NOT `match.scoreA ?? null`: the DB default
 * is `0`, which would fake a played 0:0), match_status hard 'scheduled', timer_elapsed_seconds
 * hard `0`. Every other result/status/timer/skip column (actual_end, timer_start_time,
 * timer_paused_at, overtime_*, penalty_*, decided_by, skipped_reason, skipped_at) is not sent at
 * all. Guest migration therefore loses local results honestly instead of faking them.
 *
 * @param match - The match to map
 * @param tournamentId - The tournament ID
 * @param ownerId - Optional owner ID for RLS denormalization
 * @param isPublic - Optional public visibility flag
 */
export function mapMatchToSupabase(
  match: Match,
  tournamentId: string,
  ownerId?: string,
  isPublic?: boolean
): MatchInsertWithOwner {
  const a = slotColumns(requireSlot(match, 'A'));
  const b = slotColumns(requireSlot(match, 'B'));

  return {
    id: match.id,
    tournament_id: tournamentId,
    round: match.round,
    field: match.field,
    slot: match.slot ?? null,
    team_a_id: a.teamId,
    team_b_id: b.teamId,
    slot_a_source: a.source,
    slot_b_source: b.source,
    ...originToColumns(match), // A-36a: nur beim Anlegen, Update-Wege senden sie nie
    team_a_placeholder: null,
    team_b_placeholder: null,
    score_a: null,
    score_b: null,
    group_letter: match.group ?? null,
    is_final: match.isFinal ?? false,
    final_type: match.finalType ?? null,
    label: match.label ?? null,
    scheduled_start: match.scheduledTime
      ? (match.scheduledTime instanceof Date
          ? match.scheduledTime.toTimeString().slice(0, 8)
          : String(match.scheduledTime).slice(0, 8))
      : null,
    match_number: match.matchNumber ?? null,
    phase: match.phase ?? 'groupStage',
    referee_number: match.referee ?? null,
    match_status: 'scheduled',
    timer_elapsed_seconds: 0,
    // Denormalized fields for RLS performance
    owner_id: ownerId ?? null,
    is_public: isPublic ?? false,
  };
}

/**
 * Extracts ONLY the schedule columns from a full match insert row — used by
 * SupabaseRepository.save() when updating an EXISTING match (A2,
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-brief.md).
 *
 * Deliberately excludes every live/result column: score_a, score_b, match_status,
 * actual_end/actual_start, timer_start_time, timer_paused_at, timer_elapsed_seconds,
 * overtime_score_a/b, penalty_score_a/b, decided_by, skipped_reason, skipped_at, live_state,
 * last_modified_by, version, owner_id, is_public. A full-save from a stale local state (e.g. the
 * tournament owner editing a team name) must never overwrite a helper's in-progress live match.
 *
 * Included ("schedule columns"): team_a_id/team_b_id + slot_a_source/slot_b_source (A-02),
 * team_a/b_placeholder (always NULL since A-02), round, field, slot,
 * group_letter, is_final, final_type, label, scheduled_start, match_number, phase,
 * referee_number — everything the Schedule Editor / Wizard can change about WHEN/WHERE/WHO
 * plays, never the running result.
 *
 * A-02 (V-TEAM-Review C2, @TM-027): `remote` = Team-Spalten der Cloud-Zeile. Ist eine Seite lokal
 * OFFEN (`team_x_id` NULL), in der Cloud aber schon BESETZT (ein anderes Gerät hat aufgelöst), werden
 * `team_x_id`/`slot_x_source` dieser Seite NICHT gesendet – ein veralteter lokaler Stand setzt eine
 * Auflösung nie zurück (die Turnierversion schützt hier nicht: Slot-Updates zählen sie nicht hoch).
 * Lokal besetzte Seiten werden immer gesendet (Tausch/Ersatz durch die Leitung).
 * Server-seitige Auflösung: A-13/A-14, Befund C-DELTA-LOKALE-AUFLOESUNG.
 */
export function mapMatchToScheduleUpdate(
  row: MatchInsert,
  remote?: Pick<MatchRow, 'team_a_id' | 'team_b_id'>
): MatchUpdate {
  const keepRemoteA = keepsRemoteSide(row.team_a_id ?? null, remote?.team_a_id);
  const keepRemoteB = keepsRemoteSide(row.team_b_id ?? null, remote?.team_b_id);
  return {
    ...(keepRemoteA ? {} : { team_a_id: row.team_a_id, slot_a_source: row.slot_a_source ?? null }),
    ...(keepRemoteB ? {} : { team_b_id: row.team_b_id, slot_b_source: row.slot_b_source ?? null }),
    team_a_placeholder: row.team_a_placeholder,
    team_b_placeholder: row.team_b_placeholder,
    round: row.round,
    field: row.field,
    slot: row.slot,
    group_letter: row.group_letter,
    is_final: row.is_final,
    final_type: row.final_type,
    label: row.label,
    scheduled_start: row.scheduled_start,
    match_number: row.match_number,
    phase: row.phase,
    referee_number: row.referee_number,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Maps a frontend Match update to Supabase update format
 *
 * C3a-2b (V4/R1): the client no longer sends ANY result/status/timer/skip column — score_a,
 * score_b, match_status, actual_end, timer_start_time, timer_paused_at, timer_elapsed_seconds,
 * overtime_score_a/b, penalty_score_a/b, decided_by, skipped_reason, skipped_at are never written
 * here, regardless of key presence in the incoming update. Skip/unskip is silenced completely
 * (R1): no value writes AND no explicit NULL clears — the row stays cleanly stale until C3d.
 * Local storage is unaffected (LocalStorageRepository keeps all fields).
 *
 * The A2 key-presence rule now applies ONLY to the match sides. A-02: the sides come from
 * `slotA`/`slotB` (never from `teamA`/`teamB`, never via a name lookup) – a caller that includes a
 * slot gets `team_x_id` + `slot_x_source` written, a caller that omits it (or sends `null`, the
 * queue's JSON form of a present `undefined`) leaves both columns untouched. `teamA`/`teamB` alone
 * (A-01 Übergangsfeld) reach the cloud no more. An update that mentions no side still carries
 * `updated_at` (see AP4's only-updated_at-guard in SupabaseRepository.updateMatches for the
 * skip-if-empty rule).
 *
 * A-03 (M3): `remote` = Team-Spalten der Cloud-Zeile (`SupabaseRepository.updateMatches` liest sie, sobald
 * ein Update eine offene Seite enthält). Offene lokale Seite + besetzte Cloud-Seite → die Spalten dieser
 * Seite werden nicht gesendet (C2, siehe `mapMatchToScheduleUpdate`).
 */
export function mapMatchUpdateToSupabase(
  match: DomainMatchUpdate | Partial<Match>,
  remote?: Pick<MatchRow, 'team_a_id' | 'team_b_id'>
): MatchUpdate {
  const update: MatchUpdate = {};

  // `null` kann nur aus der Warteschlange kommen (normalizeMatchUpdateForQueue) – nie ein gültiger Slot.
  const slotA = match.slotA;
  const slotB = match.slotB;
  if (slotA !== undefined && slotA !== null) {
    const a = slotColumns(slotA);
    // A-03 (M3, @TM-027): C2-Schutz wie im Voll-Speichern – eine lokal OFFENE Seite setzt eine in der
    // Cloud schon besetzte nie zurück (der Stand dieses Geräts ist veraltet).
    if (!keepsRemoteSide(a.teamId, remote?.team_a_id)) {
      update.team_a_id = a.teamId;
      update.slot_a_source = a.source;
    }
  }
  if (slotB !== undefined && slotB !== null) {
    const b = slotColumns(slotB);
    if (!keepsRemoteSide(b.teamId, remote?.team_b_id)) {
      update.team_b_id = b.teamId;
      update.slot_b_source = b.source;
    }
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
  rulebook?: string;

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

  // Mannschaften des Veranstalters, Eröffnung (@W4-034)
  hostTeamIds?: string[];
  openingMode?: string;

  // Paket TB: Gleichstands-Entscheidungen der Turnierleitung, auszuspielende Plätze (standingDecisionsConfig.ts)
  standingDecisions?: unknown[];
  placementsToPlayOut?: unknown;
  // A-25c: Wertung bei Nichtantritt (matchForfeitRow.ts)
  forfeitScore?: unknown;

  // Wizard state
  lastVisitedStep?: number;

  // Freigabe-Marker (ISO). Bewusst im config-JSONB statt als eigene Spalte —
  // siehe Tournament.publishedAt.
  publishedAt?: string;

  // L3: Monitor-/Sponsoren-Konfiguration. Bewusst JSONB in tournaments.config statt in den
  // verwaisten Tabellen monitors/sponsors — deren type-Enum passt nicht zum Slides-Modell.
  monitors?: unknown[];
  sponsors?: unknown[];
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

  // Map teams
  const teams = teamRows.map(mapTeamFromSupabase);

  // Map matches. C-SPIELNUMMER-FEHLT (@SL-049, @ZM-007): fehlt `match_number` (Altdaten NULL), zählt die
  // Rückfallregel in Spielplan-Reihenfolge; die Liste steht danach nach Spielnummer (die Abfrage sortiert nach
  // der Spalte, bei NULL in beliebiger Reihenfolge).
  const matches = sortByMatchNumber(ensureMatchNumbers(matchRows.map((m) => mapMatchFromSupabase(m, row.date))));

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
    name: row.location_name ?? '',
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
    tournamentType: (row.tournament_type ??
      config.tournamentType ??
      'classic') as Tournament['tournamentType'],
    mode: (config.mode ?? 'classic') as Tournament['mode'],
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
    // C-WERTUNG-LEER: fehlende oder leere Reihenfolge ⇒ Voreinstellung BFV privat (@W2A-046)
    placementLogic: effectivePlacementLogic(config.placementLogic as Tournament['placementLogic'] | undefined),
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
    resultMode: (config.resultMode ?? 'goals') as Tournament['resultMode'],
    pointSystem,
    title: row.title,
    ageClass: config.ageClass ?? '',
    date: row.date,
    timeSlot: timeFromDb(row.start_time) ?? '',
    startDate: row.date,
    startTime: timeFromDb(row.start_time),
    location,
    organizer: config.organizer,
    rulebook: config.rulebook, ...bibColorFromConfig(config), ...spectatorDisplayFromConfig(config), // A-30a: Leibchenfarbe (@W3-029); 2.1: Anzeige für Zuschauer (@ZM-152)
    contactInfo: config.contactInfo as Tournament['contactInfo'],
    teams,
    matches,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
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
    matchCockpitSettings: completeMatchCockpitSettings(config.matchCockpitSettings),
    isExternal: config.isExternal,
    externalSource: config.externalSource,
    useDFBKeys: config.useDFBKeys,
    dfbKeyPattern: config.dfbKeyPattern, ...hostTeamsFromConfig(config, teams), ...standingDecisionsFromConfig(config), // @W4-034/@W4-044, Paket TB
    ...forfeitScoreFromConfig(config), // A-25c @W2A-025: Wertung bei Nichtantritt
    monitors: config.monitors as Tournament['monitors'],
    sponsors: config.sponsors as Tournament['sponsors'],
    version: row.version ?? undefined, ...changeRevisionFromRow(row), // A-10: Änderungszählung (@TM-027)
    // K2: is_public/share_code müssen rundreisen — sonst sieht mapTournamentToSupabase
    // immer `undefined`, denormalisiert `false` auf alle Team-/Match-Zeilen (K1), und
    // OfflineRepository.getMetadataChanges meldet bei jedem Delta-Sync eine Phantom-Änderung.
    isPublic: row.is_public ?? false,
    shareCode: row.share_code ?? undefined,
    shareCodeCreatedAt: row.share_code_created_at ?? undefined,
    // Read-Time-Backfill: Bestandsturniere tragen kein config.publishedAt. Ein Turnier mit
    // status 'published' gilt als bereits freigegeben (created_at als Freigabezeit) — sonst
    // würde der Wizard-Statuswechsel auf 'draft' (SettingsTab.tsx) es nachträglich entwerten.
    //
    // NUR status, NICHT is_public/share_code (Review 2026-09-21, Fix 1): Beide waren unter dem
    // alten Code der DEFAULT für JEDES neu angelegte Turnier — createDraft() setzte
    // isPublic:true, und die Sichtbarkeits-Seite generierte beim Mounten automatisch einen
    // share_code. Dieser Branch hat beide Defaults entfernt, aber jedes davor angelegte Turnier
    // trägt die Altwerte noch. Sie als Beleg für "war freigegeben" zu lesen, hätte jeden
    // Altentwurf beim ersten Read dauerhaft freigegeben — genau der Schaden, den dieser Fix
    // verhindert.
    //
    // Die Erweiterung war für das "stuck-at-draft"-Szenario gedacht (freigegebenes Turnier,
    // das ein Reload mitten in der Bearbeitung auf status='draft' stehen lässt) und ist dafür
    // nicht mehr nötig: Migration 20260918_003 hat config.publishedAt für JEDE bereits
    // veröffentlichte Zeile einmalig materialisiert, und der Wert übersteht den Wizard-Roundtrip
    // (SettingsTab.tsx spreadet das ganze Tournament-Objekt, der Wizard seedet sein Formular
    // daraus). Ein solches Turnier trägt config.publishedAt also schon, wenn es hier ankommt,
    // und durchläuft den Backfill unten gar nicht erst (config.publishedAt ?? … gewinnt sofort).
    publishedAt:
      config.publishedAt ??
      (row.status === 'published' ? (row.created_at ?? undefined) : undefined),
  };
}

/**
 * Maps frontend Tournament to Supabase insert format
 * Returns tournament row, team rows, and match rows
 */
/**
 * @FU-128 (C-STARTTIME): `start_time` ist vom Typ time. Eine leere Zeichenkette oder ein Anzeigetext wie
 * „09:00 - 16:00“ lehnt Postgres ab; ohne gültige Uhrzeit geht NULL.
 */
export function startTimeForDb(value: string | undefined): string | null {
  const time = value?.trim();
  return time && /^\d{1,2}:\d{2}(:\d{2})?$/.test(time) ? time : null;
}

/** Erste Uhrzeit eines Anzeigetexts („09:00 - 16:00“ -> „09:00“), z. B. aus einem JSON-Import; sonst NULL. */
function firstTimeOf(text: string | undefined): string | null {
  const match = /(\d{1,2}:\d{2})/.exec(text ?? '');
  return match ? match[1] : null;
}

/** Der Server liefert time-Spalten als HH:MM:SS; die Anzeige zeigt HH:MM (@FU-128). */
function timeFromDb(value: string | null): string | undefined {
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : undefined;
}

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
    rulebook: tournament.rulebook, ...bibColorToConfig(tournament), ...spectatorDisplayToConfig(tournament), // A-30a: Leibchenfarbe (@W3-029); 2.1: Anzeige für Zuschauer (@ZM-152)
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
    dfbKeyPattern: tournament.dfbKeyPattern, ...hostTeamsToConfig(tournament), ...standingDecisionsToConfig(tournament), // @W4-034/@W4-044, Paket TB
    ...forfeitScoreToConfig(tournament), // A-25c @W2A-025
    monitors: tournament.monitors,
    sponsors: tournament.sponsors,
    publishedAt: tournament.publishedAt,
  };

  const tournamentRow: TournamentInsert = {
    id: tournament.id,
    owner_id: ownerId,
    status: tournament.status,
    title: tournament.title,
    sport: tournament.sport,
    tournament_type: tournament.tournamentType,
    date: tournament.startDate ?? tournament.date,
    start_time: startTimeForDb(tournament.startTime) ?? firstTimeOf(tournament.timeSlot), // @FU-128
    location_name: tournament.location.name ?? null,
    location_street: tournament.location.street ?? null,
    location_city: tournament.location.city ?? null,
    location_postal_code: tournament.location.postalCode ?? null,
    location_country: tournament.location.country ?? 'Deutschland',
    number_of_fields: tournament.numberOfFields,
    number_of_teams: tournament.numberOfTeams,
    number_of_groups: tournament.numberOfGroups ?? null,
    group_phase_duration: tournament.groupPhaseGameDuration,
    group_phase_break: tournament.groupPhaseBreakDuration ?? null,
    final_round_duration: tournament.finalRoundGameDuration ?? null,
    final_round_break: tournament.finalRoundBreakDuration ?? null,
    point_system: tournament.pointSystem as unknown as Json,
    finals_config: (tournament.finalsConfig ?? null) as unknown as Json,
    referee_config: (tournament.refereeConfig ?? null) as unknown as Json,
    config: config as unknown as Json,
    deleted_at: tournament.deletedAt ?? null,
    completed_at: tournament.completedAt ?? null,
    version: tournament.version ?? 1, // BP-1 C-TURNIER-VERSION-NULL: nie eine Zeile ohne Version (Backfill + NOT NULL: DB-Fenster)
  };

  // K1: is_public muss den echten Sichtbarkeitszustand tragen. SupabaseRepository.save()
  // nutzt upsert() — für bestehende Zeilen ein UPDATE. Der Trigger sync_owner_from_tournament
  // ist nur BEFORE INSERT (20260121_002_denormalize_owner.sql:133/139) und greift nicht.
  // Ein literales `false` hier sperrt anonyme Leser aus einem öffentlichen Turnier aus.
  const isPublic = tournament.isPublic ?? false;

  const teamRows = tournament.teams.map((team) =>
    mapTeamToSupabase(team, tournament.id, ownerId, isPublic)
  );
  // C-SPIELNUMMER-FEHLT: nie `match_number = NULL` schreiben – fehlt die Nummer lokal, gilt die Rückfallregel.
  const matchRows = ensureMatchNumbers(tournament.matches).map((match) =>
    mapMatchToSupabase(match, tournament.id, ownerId, isPublic)
  );

  return { tournamentRow, teamRows, matchRows };
}

// =============================================================================
// TOURNAMENT_COLLABORATORS MAPPERS (Invitations + Memberships)
// =============================================================================

export interface InvitationInsertInput {
  tournamentId: string;
  inviteCode: string;
  role: string;
  teamIds?: string[];
  label?: string | null;
  maxUses?: number;
  expiresAtIso: string;
  invitedBy: string;
  invitedAtIso?: string;
}

/**
 * Maps an invitation-creation request to a tournament_collaborators insert row.
 * Used by invitationService.createInvitation.
 */
export function mapInvitationInsertToSupabase(
  input: InvitationInsertInput
): CollaboratorInsert {
  return {
    tournament_id: input.tournamentId,
    invite_code: input.inviteCode,
    role: input.role,
    team_ids: input.teamIds ?? [],
    label: input.label ?? null,
    max_uses: input.maxUses ?? 1,
    use_count: 0,
    expires_at: input.expiresAtIso,
    invited_by: input.invitedBy,
    invited_at: input.invitedAtIso ?? new Date().toISOString(),
  };
}

export interface InvitationAcceptUpdate {
  userId: string;
  acceptedAtIso: string;
  newUseCount: number;
}

/**
 * Maps an "invitation accepted" event to the row update.
 */
export function mapInvitationAcceptToSupabase(
  input: InvitationAcceptUpdate
): CollaboratorUpdate {
  return {
    user_id: input.userId,
    accepted_at: input.acceptedAtIso,
    use_count: input.newUseCount,
  };
}

export interface MembershipInsertInput {
  tournamentId: string;
  userId: string;
  role: string;
  teamIds?: string[];
  createdAtIso?: string;
  acceptedAtIso?: string;
}

/**
 * Maps an owner-membership creation to a tournament_collaborators insert row.
 * Used by membershipService.createOwnerMembership.
 */
export function mapMembershipInsertToSupabase(
  input: MembershipInsertInput
): CollaboratorInsert {
  const now = new Date().toISOString();
  return {
    tournament_id: input.tournamentId,
    user_id: input.userId,
    role: input.role,
    team_ids: input.teamIds ?? [],
    created_at: input.createdAtIso ?? now,
    accepted_at: input.acceptedAtIso ?? now,
  };
}

export interface MembershipRoleUpdate {
  role: string;
  teamIds: string[];
}

/**
 * Maps a role-change to a tournament_collaborators update row.
 * Used by membershipService.changeRole.
 */
export function mapMembershipRoleUpdateToSupabase(
  input: MembershipRoleUpdate
): CollaboratorUpdate {
  return {
    role: input.role,
    team_ids: input.teamIds,
  };
}

/**
 * Maps trainer team-id changes to a tournament_collaborators update row.
 * Used by membershipService.updateTrainerTeams.
 */
export function mapMembershipTeamsUpdateToSupabase(
  teamIds: string[]
): CollaboratorUpdate {
  return {
    team_ids: teamIds,
  };
}

// =============================================================================
// PROFILES MAPPER
// =============================================================================

export interface ProfileUpdateInput {
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Maps a profile-update request from the auth layer to a profiles update row.
 * Only fields explicitly provided are forwarded.
 */
export function mapProfileUpdateToSupabase(
  input: ProfileUpdateInput
): ProfileUpdate {
  const update: ProfileUpdate = {};
  if (input.displayName !== undefined) {
    update.display_name = input.displayName;
  }
  if (input.avatarUrl !== undefined) {
    update.avatar_url = input.avatarUrl;
  }
  return update;
}
