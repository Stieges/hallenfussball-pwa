/**
 * Shared test factories for Supabase row types.
 *
 * Eliminates the duplication previously present in
 * `src/core/repositories/__tests__/supabaseMappers.test.ts` and
 * `src/core/repositories/__tests__/liveMatchMappers.test.ts`.
 *
 * Every factory returns a fully-populated row with safe defaults
 * (nulls where the schema allows), accepting a `Partial<…>` overrides
 * object. When the schema gains new columns, the central factory is
 * the single place to extend — keeping mapper tests in sync.
 */
import type { Database, Tables } from '../../src/types/supabase';

// Re-exported so Mapper-Test-Files das ganze Type-Set aus einer Quelle ziehen.
export type { Database, Tables };

export type TeamRow = Tables<'teams'>;
export type MatchRow = Tables<'matches'>;
export type TournamentRow = Tables<'tournaments'>;
export type MatchEventRow = Tables<'match_events'>;

export function createTeamRow(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    id: 'team-1',
    name: 'FC Test',
    tournament_id: 'tournament-1',
    group_letter: null,
    is_removed: null,
    removed_at: null,
    removed_reason: null,
    logo_path: null,
    logo_background_color: null,
    color_primary: null,
    color_secondary: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    sort_order: null,
    is_public: null,
    owner_id: null,
    created_at: null,
    updated_at: null,
    version: 1,
    ...overrides,
  };
}

// MatchRow factory accepts `live_state` in overrides to support the live-match
// mapper tests that exercise nested-jsonb fields; cast back to MatchRow keeps
// callers type-safe.
export function createMatchRow(
  overrides: Partial<MatchRow & { live_state?: unknown }> = {}
): MatchRow {
  return {
    id: 'match-1',
    tournament_id: 'tournament-1',
    round: 1,
    field: 1,
    slot: null,
    team_a_id: null,
    team_b_id: null,
    team_a_placeholder: null,
    team_b_placeholder: null,
    score_a: null,
    score_b: null,
    group_letter: null,
    is_final: null,
    final_type: null,
    label: null,
    scheduled_start: null,
    match_number: null,
    phase: null,
    referee_number: null,
    referee_team_id: null,
    match_status: null,
    actual_start: null,
    actual_end: null,
    timer_start_time: null,
    timer_paused_at: null,
    timer_elapsed_seconds: null,
    overtime_score_a: null,
    overtime_score_b: null,
    penalty_score_a: null,
    penalty_score_b: null,
    decided_by: null,
    skipped_reason: null,
    skipped_at: null,
    duration_minutes: null,
    last_modified_by: null,
    live_state: null,
    is_public: null,
    owner_id: null,
    created_at: null,
    updated_at: null,
    version: null,
    ...overrides,
  };
}

export function createTournamentRow(
  overrides: Partial<TournamentRow> = {}
): TournamentRow {
  return {
    id: 'tournament-1',
    owner_id: 'user-1',
    title: 'Test Turnier',
    status: 'draft',
    sport: 'football-indoor',
    tournament_type: 'classic',
    date: '2026-01-15',
    start_time: '14:00',
    location_name: 'Sporthalle Test',
    location_street: null,
    location_city: null,
    location_postal_code: null,
    location_country: null,
    number_of_fields: 2,
    number_of_teams: 8,
    number_of_groups: 2,
    group_phase_duration: 10,
    group_phase_break: 2,
    final_round_duration: 12,
    final_round_break: 3,
    point_system: { win: 3, draw: 1, loss: 0 },
    finals_config: null,
    referee_config: null,
    config: {},
    is_public: null,
    share_code: null,
    share_code_created_at: null,
    completed_at: null,
    deleted_at: null,
    last_modified_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

export function createEventRow(
  overrides: Partial<MatchEventRow> = {}
): MatchEventRow {
  return {
    id: 'event-1',
    match_id: 'match-1',
    timestamp_seconds: 120,
    type: 'GOAL',
    payload: { team: 'home', delta: 1 },
    score_home: 1,
    score_away: 0,
    team_id: null,
    player_id: null,
    period: null,
    incomplete: null,
    is_deleted: null,
    is_public: null,
    owner_id: null,
    version: 1,
    created_at: null,
    ...overrides,
  };
}
