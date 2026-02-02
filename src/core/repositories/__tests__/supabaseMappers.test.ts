import { describe, it, expect } from 'vitest';
import type { Database } from '../../../types/supabase';
import {
  mapTeamFromSupabase,
  mapTeamToSupabase,
  mapMatchFromSupabase,
  mapMatchToSupabase,
  mapMatchUpdateToSupabase,
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
} from '../supabaseMappers';

// =============================================================================
// Test Data Factories
// =============================================================================

type TeamRow = Database['public']['Tables']['teams']['Row'];
type MatchRow = Database['public']['Tables']['matches']['Row'];
type TournamentRow = Database['public']['Tables']['tournaments']['Row'];

function createTeamRow(overrides: Partial<TeamRow> = {}): TeamRow {
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
    created_at: null,
    updated_at: null,
    version: null,
    ...overrides,
  };
}

function createMatchRow(overrides: Partial<MatchRow> = {}): MatchRow {
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
    created_at: null,
    updated_at: null,
    version: null,
    ...overrides,
  };
}

function createTournamentRow(overrides: Partial<TournamentRow> = {}): TournamentRow {
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
    completed_at: null,
    deleted_at: null,
    last_modified_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

// =============================================================================
// TEAM MAPPER TESTS
// =============================================================================

describe('mapTeamFromSupabase', () => {
  it('maps minimal team row', () => {
    const row = createTeamRow();
    const team = mapTeamFromSupabase(row);

    expect(team.id).toBe('team-1');
    expect(team.name).toBe('FC Test');
    expect(team.group).toBeUndefined();
    expect(team.isRemoved).toBeUndefined();
    expect(team.logo).toBeUndefined();
    expect(team.colors).toBeUndefined();
  });

  it('maps team with logo', () => {
    const row = createTeamRow({
      logo_path: 'https://example.com/logo.png',
      logo_background_color: '#ffffff',
    });
    const team = mapTeamFromSupabase(row);

    expect(team.logo).toEqual({
      type: 'url',
      value: 'https://example.com/logo.png',
      backgroundColor: '#ffffff',
    });
  });

  it('maps team with colors', () => {
    const row = createTeamRow({
      color_primary: '#ff0000',
      color_secondary: '#0000ff',
    });
    const team = mapTeamFromSupabase(row);

    expect(team.colors).toEqual({
      primary: '#ff0000',
      secondary: '#0000ff',
    });
  });

  it('maps team with only primary color', () => {
    const row = createTeamRow({ color_primary: '#ff0000' });
    const team = mapTeamFromSupabase(row);

    expect(team.colors).toEqual({
      primary: '#ff0000',
      secondary: undefined,
    });
  });

  it('maps group and isRemoved', () => {
    const row = createTeamRow({
      group_letter: 'A',
      is_removed: true,
      removed_at: '2026-01-10T12:00:00Z',
    });
    const team = mapTeamFromSupabase(row);

    expect(team.group).toBe('A');
    expect(team.isRemoved).toBe(true);
    expect(team.removedAt).toBe('2026-01-10T12:00:00Z');
  });
});

describe('mapTeamToSupabase', () => {
  it('maps minimal team', () => {
    const row = mapTeamToSupabase(
      { id: 'team-1', name: 'FC Test' },
      'tournament-1'
    );

    expect(row.id).toBe('team-1');
    expect(row.tournament_id).toBe('tournament-1');
    expect(row.name).toBe('FC Test');
    expect(row.group_letter).toBeNull();
    expect(row.is_removed).toBe(false);
    expect(row.owner_id).toBeNull();
    expect(row.is_public).toBe(false);
  });

  it('maps team with owner and public flag', () => {
    const row = mapTeamToSupabase(
      { id: 'team-1', name: 'FC Test', group: 'B' },
      'tournament-1',
      'user-1',
      true
    );

    expect(row.owner_id).toBe('user-1');
    expect(row.is_public).toBe(true);
    expect(row.group_letter).toBe('B');
  });

  it('maps logo (only url type)', () => {
    const row = mapTeamToSupabase(
      {
        id: 'team-1',
        name: 'FC Test',
        logo: { type: 'url', value: 'https://example.com/logo.png', backgroundColor: '#fff' },
      },
      'tournament-1'
    );

    expect(row.logo_path).toBe('https://example.com/logo.png');
    expect(row.logo_background_color).toBe('#fff');
  });

  it('does not map non-url logo types', () => {
    const row = mapTeamToSupabase(
      {
        id: 'team-1',
        name: 'FC Test',
        logo: { type: 'initials', value: 'FT' },
      },
      'tournament-1'
    );

    expect(row.logo_path).toBeNull();
  });
});

// =============================================================================
// MATCH MAPPER TESTS
// =============================================================================

describe('mapMatchFromSupabase', () => {
  it('resolves team names via teamIdToName map', () => {
    const teamIdToName = new Map([
      ['team-a-id', 'Team Alpha'],
      ['team-b-id', 'Team Beta'],
    ]);
    const row = createMatchRow({
      team_a_id: 'team-a-id',
      team_b_id: 'team-b-id',
    });
    const match = mapMatchFromSupabase(row, teamIdToName);

    expect(match.teamA).toBe('Team Alpha');
    expect(match.teamB).toBe('Team Beta');
  });

  it('falls back to placeholder when team ID not in map', () => {
    const row = createMatchRow({
      team_a_id: 'unknown-id',
      team_a_placeholder: '1. Gruppe A',
      team_b_id: null,
      team_b_placeholder: '2. Gruppe B',
    });
    const match = mapMatchFromSupabase(row, new Map());

    expect(match.teamA).toBe('1. Gruppe A');
    expect(match.teamB).toBe('2. Gruppe B');
  });

  it('falls back to TBD when no ID and no placeholder', () => {
    const row = createMatchRow({
      team_a_id: null,
      team_a_placeholder: null,
      team_b_id: null,
      team_b_placeholder: null,
    });
    const match = mapMatchFromSupabase(row, new Map());

    expect(match.teamA).toBe('TBD');
    expect(match.teamB).toBe('TBD');
  });

  it('constructs Date from scheduled_start time string', () => {
    const row = createMatchRow({ scheduled_start: '14:30:00' });
    const match = mapMatchFromSupabase(row, new Map());

    expect(match.scheduledTime).toBeInstanceOf(Date);
    expect(match.scheduledTime!.getHours()).toBe(14);
    expect(match.scheduledTime!.getMinutes()).toBe(30);
  });

  it('returns undefined scheduledTime when scheduled_start is null', () => {
    const row = createMatchRow({ scheduled_start: null });
    const match = mapMatchFromSupabase(row, new Map());

    expect(match.scheduledTime).toBeUndefined();
  });

  it('maps match status with default', () => {
    const row = createMatchRow({ match_status: 'live' });
    const match = mapMatchFromSupabase(row, new Map());
    expect(match.matchStatus).toBe('live');

    const rowDefault = createMatchRow({ match_status: null });
    const matchDefault = mapMatchFromSupabase(rowDefault, new Map());
    expect(matchDefault.matchStatus).toBe('scheduled');
  });

  it('maps all score/timer fields', () => {
    const row = createMatchRow({
      score_a: 3,
      score_b: 1,
      timer_start_time: '2026-01-15T14:30:00Z',
      timer_paused_at: '2026-01-15T14:35:00Z',
      timer_elapsed_seconds: 300,
      overtime_score_a: 1,
      overtime_score_b: 0,
      penalty_score_a: 4,
      penalty_score_b: 3,
      decided_by: 'penalty',
    });
    const match = mapMatchFromSupabase(row, new Map());

    expect(match.scoreA).toBe(3);
    expect(match.scoreB).toBe(1);
    expect(match.timerStartTime).toBe('2026-01-15T14:30:00Z');
    expect(match.timerPausedAt).toBe('2026-01-15T14:35:00Z');
    expect(match.timerElapsedSeconds).toBe(300);
    expect(match.overtimeScoreA).toBe(1);
    expect(match.overtimeScoreB).toBe(0);
    expect(match.penaltyScoreA).toBe(4);
    expect(match.penaltyScoreB).toBe(3);
    expect(match.decidedBy).toBe('penalty');
  });

  it('maps final match fields', () => {
    const row = createMatchRow({
      is_final: true,
      final_type: 'semifinal',
      label: 'Halbfinale 1',
      phase: 'semifinal',
      match_number: 13,
    });
    const match = mapMatchFromSupabase(row, new Map());

    expect(match.isFinal).toBe(true);
    expect(match.finalType).toBe('semifinal');
    expect(match.label).toBe('Halbfinale 1');
    expect(match.phase).toBe('semifinal');
    expect(match.matchNumber).toBe(13);
  });
});

describe('mapMatchToSupabase', () => {
  it('resolves team names to IDs', () => {
    const teamNameToId = new Map([
      ['Team Alpha', 'team-a-id'],
      ['Team Beta', 'team-b-id'],
    ]);
    const row = mapMatchToSupabase(
      { id: 'match-1', round: 1, field: 1, teamA: 'Team Alpha', teamB: 'Team Beta' },
      'tournament-1',
      teamNameToId
    );

    expect(row.team_a_id).toBe('team-a-id');
    expect(row.team_b_id).toBe('team-b-id');
    expect(row.team_a_placeholder).toBeNull();
    expect(row.team_b_placeholder).toBeNull();
  });

  it('uses placeholder when team name not in map', () => {
    const row = mapMatchToSupabase(
      { id: 'match-1', round: 1, field: 1, teamA: '1. Gruppe A', teamB: '2. Gruppe B' },
      'tournament-1',
      new Map()
    );

    expect(row.team_a_id).toBeNull();
    expect(row.team_b_id).toBeNull();
    expect(row.team_a_placeholder).toBe('1. Gruppe A');
    expect(row.team_b_placeholder).toBe('2. Gruppe B');
  });

  it('serializes Date scheduledTime to time string', () => {
    const date = new Date('2026-01-15T14:30:00');
    const row = mapMatchToSupabase(
      { id: 'match-1', round: 1, field: 1, teamA: 'A', teamB: 'B', scheduledTime: date },
      'tournament-1',
      new Map()
    );

    expect(row.scheduled_start).toMatch(/14:30:00/);
  });

  it('serializes string scheduledTime', () => {
    const row = mapMatchToSupabase(
      { id: 'match-1', round: 1, field: 1, teamA: 'A', teamB: 'B', scheduledTime: '15:00:00' as unknown as Date },
      'tournament-1',
      new Map()
    );

    expect(row.scheduled_start).toBe('15:00:00');
  });

  it('maps owner_id and is_public for RLS', () => {
    const row = mapMatchToSupabase(
      { id: 'match-1', round: 1, field: 1, teamA: 'A', teamB: 'B' },
      'tournament-1',
      new Map(),
      'user-1',
      true
    );

    expect(row.owner_id).toBe('user-1');
    expect(row.is_public).toBe(true);
  });

  it('defaults phase to groupStage', () => {
    const row = mapMatchToSupabase(
      { id: 'match-1', round: 1, field: 1, teamA: 'A', teamB: 'B' },
      'tournament-1',
      new Map()
    );

    expect(row.phase).toBe('groupStage');
  });
});

describe('mapMatchUpdateToSupabase', () => {
  it('maps partial score update', () => {
    const update = mapMatchUpdateToSupabase({ scoreA: 2, scoreB: 1 });

    expect(update.score_a).toBe(2);
    expect(update.score_b).toBe(1);
    expect(update.updated_at).toBeDefined();
  });

  it('maps status update', () => {
    const update = mapMatchUpdateToSupabase({ matchStatus: 'running' });

    expect(update.match_status).toBe('running');
  });

  it('always sets updated_at even for empty update', () => {
    const update = mapMatchUpdateToSupabase({});

    expect(update.updated_at).toBeDefined();
    expect(typeof update.updated_at).toBe('string');
  });

  it('maps team changes with teamNameToId', () => {
    const teamNameToId = new Map([['FC Alpha', 'alpha-id']]);
    const update = mapMatchUpdateToSupabase(
      { teamA: 'FC Alpha', teamB: 'Unknown Team' },
      teamNameToId
    );

    expect(update.team_a_id).toBe('alpha-id');
    expect(update.team_a_placeholder).toBeNull();
    expect(update.team_b_id).toBeNull();
    expect(update.team_b_placeholder).toBe('Unknown Team');
  });

  it('does not map team changes without teamNameToId', () => {
    const update = mapMatchUpdateToSupabase({ teamA: 'FC Alpha' });

    expect(update.team_a_id).toBeUndefined();
    expect(update.team_a_placeholder).toBeUndefined();
  });

  it('maps all timer and tiebreaker fields', () => {
    const update = mapMatchUpdateToSupabase({
      timerStartTime: '2026-01-15T14:30:00Z',
      timerPausedAt: '2026-01-15T14:35:00Z',
      timerElapsedSeconds: 300,
      overtimeScoreA: 1,
      overtimeScoreB: 0,
      penaltyScoreA: 4,
      penaltyScoreB: 3,
      decidedBy: 'penalty',
      finishedAt: '2026-01-15T14:45:00Z',
      skippedReason: 'Team not present',
      skippedAt: '2026-01-15T14:00:00Z',
    });

    expect(update.timer_start_time).toBe('2026-01-15T14:30:00Z');
    expect(update.timer_paused_at).toBe('2026-01-15T14:35:00Z');
    expect(update.timer_elapsed_seconds).toBe(300);
    expect(update.overtime_score_a).toBe(1);
    expect(update.overtime_score_b).toBe(0);
    expect(update.penalty_score_a).toBe(4);
    expect(update.penalty_score_b).toBe(3);
    expect(update.decided_by).toBe('penalty');
    expect(update.actual_end).toBe('2026-01-15T14:45:00Z');
    expect(update.skipped_reason).toBe('Team not present');
    expect(update.skipped_at).toBe('2026-01-15T14:00:00Z');
  });
});

// =============================================================================
// TOURNAMENT MAPPER TESTS
// =============================================================================

describe('mapTournamentFromSupabase', () => {
  it('maps minimal tournament without teams/matches', () => {
    const row = createTournamentRow();
    const tournament = mapTournamentFromSupabase(row, [], []);

    expect(tournament.id).toBe('tournament-1');
    expect(tournament.title).toBe('Test Turnier');
    expect(tournament.status).toBe('draft');
    expect(tournament.sport).toBe('football-indoor');
    expect(tournament.numberOfFields).toBe(2);
    expect(tournament.numberOfTeams).toBe(8);
    expect(tournament.teams).toEqual([]);
    expect(tournament.matches).toEqual([]);
  });

  it('maps teams and matches', () => {
    const row = createTournamentRow();
    const teamRows = [
      createTeamRow({ id: 'team-1', name: 'Alpha' }),
      createTeamRow({ id: 'team-2', name: 'Beta' }),
    ];
    const matchRows = [
      createMatchRow({
        id: 'match-1',
        team_a_id: 'team-1',
        team_b_id: 'team-2',
        match_number: 1,
      }),
    ];

    const tournament = mapTournamentFromSupabase(row, teamRows, matchRows);

    expect(tournament.teams).toHaveLength(2);
    expect(tournament.matches).toHaveLength(1);
    expect(tournament.matches[0].teamA).toBe('Alpha');
    expect(tournament.matches[0].teamB).toBe('Beta');
  });

  it('uses default point system when null', () => {
    const row = createTournamentRow({ point_system: null as unknown as Database['public']['Tables']['tournaments']['Row']['point_system'] });
    const tournament = mapTournamentFromSupabase(row, [], []);

    expect(tournament.pointSystem).toEqual({ win: 3, draw: 1, loss: 0 });
  });

  it('parses custom point system', () => {
    const row = createTournamentRow({
      point_system: { win: 2, draw: 1, loss: 0 },
    });
    const tournament = mapTournamentFromSupabase(row, [], []);

    expect(tournament.pointSystem).toEqual({ win: 2, draw: 1, loss: 0 });
  });

  it('maps location fields', () => {
    const row = createTournamentRow({
      location_name: 'Sporthalle',
      location_street: 'Hauptstr. 1',
      location_city: 'Berlin',
      location_postal_code: '10115',
      location_country: 'Deutschland',
    });
    const tournament = mapTournamentFromSupabase(row, [], []);

    expect(tournament.location).toEqual({
      name: 'Sporthalle',
      street: 'Hauptstr. 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Deutschland',
    });
  });

  it('parses config JSON fields', () => {
    const row = createTournamentRow({
      config: {
        mode: 'bambini',
        gamePeriods: 2,
        halftimeBreak: 3,
        isKidsTournament: true,
        organizer: 'SV Test',
        sportId: 'football-indoor',
      },
    });
    const tournament = mapTournamentFromSupabase(row, [], []);

    expect(tournament.mode).toBe('bambini');
    expect(tournament.gamePeriods).toBe(2);
    expect(tournament.halftimeBreak).toBe(3);
    expect(tournament.isKidsTournament).toBe(true);
    expect(tournament.organizer).toBe('SV Test');
    expect(tournament.sportId).toBe('football-indoor');
  });

  it('maps version and timestamps', () => {
    const row = createTournamentRow({
      version: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-10T12:00:00Z',
      deleted_at: '2026-01-15T00:00:00Z',
      completed_at: '2026-01-14T18:00:00Z',
    });
    const tournament = mapTournamentFromSupabase(row, [], []);

    expect(tournament.version).toBe(5);
    expect(tournament.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(tournament.updatedAt).toBe('2026-01-10T12:00:00Z');
    expect(tournament.deletedAt).toBe('2026-01-15T00:00:00Z');
    expect(tournament.completedAt).toBe('2026-01-14T18:00:00Z');
  });
});

describe('mapTournamentToSupabase', () => {
  it('returns tournament row, team rows, and match rows', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow(),
      [createTeamRow({ id: 'team-1', name: 'Alpha' })],
      [createMatchRow({ id: 'match-1', team_a_id: 'team-1' })]
    );

    const result = mapTournamentToSupabase(tournament, 'user-1');

    expect(result.tournamentRow).toBeDefined();
    expect(result.teamRows).toHaveLength(1);
    expect(result.matchRows).toHaveLength(1);
  });

  it('sets owner_id on tournament row', () => {
    const tournament = mapTournamentFromSupabase(createTournamentRow(), [], []);
    const result = mapTournamentToSupabase(tournament, 'user-1');

    expect(result.tournamentRow.owner_id).toBe('user-1');
  });

  it('preserves config fields in JSON', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow({
        config: {
          mode: 'bambini',
          isKidsTournament: true,
          organizer: 'SV Test',
        },
      }),
      [],
      []
    );

    const result = mapTournamentToSupabase(tournament, 'user-1');
    const config = result.tournamentRow.config as Record<string, unknown>;

    expect(config.mode).toBe('bambini');
    expect(config.isKidsTournament).toBe(true);
    expect(config.organizer).toBe('SV Test');
  });

  it('builds team name to ID map for match conversion', () => {
    const teamRows = [
      createTeamRow({ id: 'team-a', name: 'Alpha' }),
      createTeamRow({ id: 'team-b', name: 'Beta' }),
    ];
    const matchRows = [
      createMatchRow({ id: 'match-1', team_a_id: 'team-a', team_b_id: 'team-b' }),
    ];
    const tournament = mapTournamentFromSupabase(createTournamentRow(), teamRows, matchRows);
    const result = mapTournamentToSupabase(tournament, 'user-1');

    // Match rows should have team IDs resolved
    expect(result.matchRows[0].team_a_id).toBe('team-a');
    expect(result.matchRows[0].team_b_id).toBe('team-b');
  });
});
