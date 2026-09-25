import { describe, it, expect } from 'vitest';
import {
  mapTeamFromSupabase,
  mapTeamToSupabase,
  mapMatchFromSupabase,
  mapMatchToSupabase,
  mapMatchUpdateToSupabase,
  mapMatchToScheduleUpdate,
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
  mapInvitationInsertToSupabase,
  mapInvitationAcceptToSupabase,
  mapMembershipInsertToSupabase,
  mapMembershipRoleUpdateToSupabase,
  mapMembershipTeamsUpdateToSupabase,
  mapProfileUpdateToSupabase,
} from '../supabaseMappers';
import {
  createTeamRow,
  createMatchRow,
  createTournamentRow,
  type Database,
} from '../../../../tests/factories/supabase';

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

describe('mapMatchToScheduleUpdate (A2: task-A2-brief.md)', () => {
  it('carries over every schedule column from the full insert row', () => {
    const teamNameToId = new Map([
      ['Team Alpha', 'team-a-id'],
      ['Team Beta', 'team-b-id'],
    ]);
    const row = mapMatchToSupabase(
      {
        id: 'match-1',
        round: 2,
        field: 3,
        slot: 4,
        teamA: 'Team Alpha',
        teamB: 'Team Beta',
        group: 'A',
        isFinal: true,
        finalType: 'final',
        label: 'Finale',
        matchNumber: 7,
        phase: 'final',
        referee: 5,
      },
      'tournament-1',
      teamNameToId
    );

    const update = mapMatchToScheduleUpdate(row);

    expect(update.team_a_id).toBe('team-a-id');
    expect(update.team_b_id).toBe('team-b-id');
    expect(update.team_a_placeholder).toBeNull();
    expect(update.team_b_placeholder).toBeNull();
    expect(update.round).toBe(2);
    expect(update.field).toBe(3);
    expect(update.slot).toBe(4);
    expect(update.group_letter).toBe('A');
    expect(update.is_final).toBe(true);
    expect(update.final_type).toBe('final');
    expect(update.label).toBe('Finale');
    expect(update.match_number).toBe(7);
    expect(update.phase).toBe('final');
    expect(update.referee_number).toBe(5);
    expect(update.updated_at).toEqual(expect.any(String));
  });

  it('NEVER includes any live/result column, even though the source row has them', () => {
    const row = mapMatchToSupabase(
      {
        id: 'match-1',
        round: 1,
        field: 1,
        teamA: 'A',
        teamB: 'B',
        scoreA: 3,
        scoreB: 1,
        matchStatus: 'finished',
        finishedAt: '2026-01-01T10:00:00Z',
        timerStartTime: '2026-01-01T09:00:00Z',
        timerPausedAt: '2026-01-01T09:30:00Z',
        timerElapsedSeconds: 600,
        overtimeScoreA: 1,
        overtimeScoreB: 0,
        penaltyScoreA: 4,
        penaltyScoreB: 3,
        decidedBy: 'penalty',
        skippedReason: 'noShow',
        skippedAt: '2026-01-01T09:05:00Z',
      },
      'tournament-1',
      new Map()
    );

    const update = mapMatchToScheduleUpdate(row);

    expect(update).not.toHaveProperty('score_a');
    expect(update).not.toHaveProperty('score_b');
    expect(update).not.toHaveProperty('match_status');
    expect(update).not.toHaveProperty('actual_end');
    expect(update).not.toHaveProperty('actual_start');
    expect(update).not.toHaveProperty('timer_start_time');
    expect(update).not.toHaveProperty('timer_paused_at');
    expect(update).not.toHaveProperty('timer_elapsed_seconds');
    expect(update).not.toHaveProperty('overtime_score_a');
    expect(update).not.toHaveProperty('overtime_score_b');
    expect(update).not.toHaveProperty('penalty_score_a');
    expect(update).not.toHaveProperty('penalty_score_b');
    expect(update).not.toHaveProperty('decided_by');
    expect(update).not.toHaveProperty('skipped_reason');
    expect(update).not.toHaveProperty('skipped_at');
    expect(update).not.toHaveProperty('live_state');
    expect(update).not.toHaveProperty('owner_id');
    expect(update).not.toHaveProperty('is_public');
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

  it('K2: mappt is_public, share_code und share_code_created_at', () => {
    const row = createTournamentRow({
      is_public: true, share_code: 'ABC123', share_code_created_at: '2026-02-01T10:00:00Z',
    });
    const tournament = mapTournamentFromSupabase(row, [], []);
    expect(tournament.isPublic).toBe(true);
    expect(tournament.shareCode).toBe('ABC123');
    expect(tournament.shareCodeCreatedAt).toBe('2026-02-01T10:00:00Z');
  });

  it('K2: defaultet isPublic auf false wenn die Spalte null ist', () => {
    const tournament = mapTournamentFromSupabase(createTournamentRow({ is_public: null }), [], []);
    expect(tournament.isPublic).toBe(false);
    expect(tournament.shareCode).toBeUndefined();
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

  it('K1: denormalisiert is_public=true auf Team- und Match-Zeilen eines öffentlichen Turniers', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow({ is_public: true }),
      [createTeamRow({ id: 'team-1', name: 'Alpha' })],
      [createMatchRow({ id: 'match-1', team_a_id: 'team-1' })]
    );
    const result = mapTournamentToSupabase(tournament, 'user-1');
    expect(result.teamRows[0].is_public).toBe(true);
    expect(result.matchRows[0].is_public).toBe(true);
  });

  it('K1: denormalisiert is_public=false bei privatem Turnier', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow({ is_public: false }),
      [createTeamRow({ id: 'team-1', name: 'Alpha' })],
      [createMatchRow({ id: 'match-1', team_a_id: 'team-1' })]
    );
    const result = mapTournamentToSupabase(tournament, 'user-1');
    expect(result.teamRows[0].is_public).toBe(false);
    expect(result.matchRows[0].is_public).toBe(false);
  });
});

// =============================================================================
// TOURNAMENT_COLLABORATORS + PROFILE MAPPER TESTS (Supabase 2.105 upgrade)
// =============================================================================

describe('mapInvitationInsertToSupabase', () => {
  it('maps an invitation creation with defaults', () => {
    const result = mapInvitationInsertToSupabase({
      tournamentId: 't1',
      inviteCode: 'CODE123',
      role: 'trainer',
      expiresAtIso: '2026-12-31T00:00:00Z',
      invitedBy: 'user-1',
    });

    expect(result.tournament_id).toBe('t1');
    expect(result.invite_code).toBe('CODE123');
    expect(result.role).toBe('trainer');
    expect(result.team_ids).toEqual([]);
    expect(result.max_uses).toBe(1);
    expect(result.use_count).toBe(0);
    expect(result.expires_at).toBe('2026-12-31T00:00:00Z');
    expect(result.invited_by).toBe('user-1');
    expect(result.invited_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.label).toBeNull();
  });

  it('passes through provided teamIds, label, maxUses', () => {
    const result = mapInvitationInsertToSupabase({
      tournamentId: 't1',
      inviteCode: 'C',
      role: 'co-admin',
      teamIds: ['team-1', 'team-2'],
      label: 'Trainer-Einladung',
      maxUses: 5,
      expiresAtIso: '2026-12-31T00:00:00Z',
      invitedBy: 'user-1',
      invitedAtIso: '2026-05-23T10:00:00Z',
    });

    expect(result.team_ids).toEqual(['team-1', 'team-2']);
    expect(result.label).toBe('Trainer-Einladung');
    expect(result.max_uses).toBe(5);
    expect(result.invited_at).toBe('2026-05-23T10:00:00Z');
  });
});

describe('mapInvitationAcceptToSupabase', () => {
  it('produces an update payload with user_id, accepted_at, use_count', () => {
    const result = mapInvitationAcceptToSupabase({
      userId: 'user-42',
      acceptedAtIso: '2026-05-23T10:00:00Z',
      newUseCount: 3,
    });

    expect(result).toEqual({
      user_id: 'user-42',
      accepted_at: '2026-05-23T10:00:00Z',
      use_count: 3,
    });
  });
});

describe('mapMembershipInsertToSupabase', () => {
  it('maps an owner membership with defaults', () => {
    const result = mapMembershipInsertToSupabase({
      tournamentId: 't1',
      userId: 'u1',
      role: 'owner',
    });

    expect(result.tournament_id).toBe('t1');
    expect(result.user_id).toBe('u1');
    expect(result.role).toBe('owner');
    expect(result.team_ids).toEqual([]);
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('mapMembershipRoleUpdateToSupabase', () => {
  it('produces an update payload with role + team_ids', () => {
    const result = mapMembershipRoleUpdateToSupabase({
      role: 'trainer',
      teamIds: ['team-1'],
    });

    expect(result).toEqual({ role: 'trainer', team_ids: ['team-1'] });
  });
});

describe('mapMembershipTeamsUpdateToSupabase', () => {
  it('produces an update payload with only team_ids', () => {
    const result = mapMembershipTeamsUpdateToSupabase(['team-1', 'team-2']);
    expect(result).toEqual({ team_ids: ['team-1', 'team-2'] });
  });
});

describe('mapProfileUpdateToSupabase', () => {
  it('returns empty update for no inputs', () => {
    expect(mapProfileUpdateToSupabase({})).toEqual({});
  });

  it('forwards display_name when displayName is provided', () => {
    expect(mapProfileUpdateToSupabase({ displayName: 'Max' })).toEqual({
      display_name: 'Max',
    });
  });

  it('forwards avatar_url when avatarUrl is provided', () => {
    expect(
      mapProfileUpdateToSupabase({ avatarUrl: 'https://example.com/a.png' })
    ).toEqual({ avatar_url: 'https://example.com/a.png' });
  });

  it('forwards both fields when both are provided', () => {
    expect(
      mapProfileUpdateToSupabase({ displayName: 'Max', avatarUrl: 'url' })
    ).toEqual({ display_name: 'Max', avatar_url: 'url' });
  });
});

describe('Tournament-Mapper Round-Trip: Monitore und Sponsoren (L3)', () => {
  const monitor = {
    id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade',
    transitionDuration: 500, theme: 'dark' as const, performanceMode: 'auto' as const,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    slides: [
      { id: 's1', type: 'live' as const, config: { fieldId: 'field-1' }, duration: null, order: 0 },
      { id: 's2', type: 'sponsor' as const, config: { sponsorId: 'spo-1' }, duration: 10, order: 1 },
    ],
  };
  const sponsor = {
    id: 'spo-1', name: 'Autohaus Muster', tier: 'gold', websiteUrl: 'https://example.com',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };

  it('schreibt monitors und sponsors in das config-JSONB', () => {
    const base = mapTournamentFromSupabase(createTournamentRow(), [], []);
    const tournament = { ...base, monitors: [monitor], sponsors: [sponsor] } as typeof base;
    const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
    const config = tournamentRow.config as Record<string, unknown>;
    expect(config.monitors).toEqual([monitor]);
    expect(config.sponsors).toEqual([sponsor]);
  });

  it('liest monitors und sponsors verlustfrei aus dem config-JSONB zurück', () => {
    const row = createTournamentRow({ config: { monitors: [monitor], sponsors: [sponsor] } });
    const tournament = mapTournamentFromSupabase(row, [], []);
    expect(tournament.monitors).toEqual([monitor]);
    expect(tournament.sponsors).toEqual([sponsor]);
    expect(tournament.monitors?.[0].slides).toHaveLength(2);
  });

  it('überlebt einen vollständigen Round-Trip inklusive JSON-Serialisierung (wie JSONB)', () => {
    const base = mapTournamentFromSupabase(createTournamentRow(), [], []);
    const tournament = { ...base, monitors: [monitor], sponsors: [sponsor] } as typeof base;

    const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
    // Postgres speichert JSONB — was JSON.stringify verwirft (undefined-Felder, Funktionen,
    // Date-Objekte werden zu Strings), ist nach dem Laden weg. Ohne diese Grenze prüft der
    // Test nur Objektreferenzen und kann strukturell nicht fehlschlagen.
    const serialised = JSON.parse(JSON.stringify(tournamentRow.config)) as Record<string, unknown>;
    const back = mapTournamentFromSupabase(createTournamentRow({ config: serialised as never }), [], []);

    expect(back.monitors).toEqual([monitor]);
    expect(back.sponsors).toEqual([sponsor]);
    expect(back.monitors?.[0].slides).toHaveLength(2);
  });

  it('bleibt undefined wenn keine Monitore konfiguriert sind', () => {
    const tournament = mapTournamentFromSupabase(createTournamentRow(), [], []);
    expect(tournament.monitors).toBeUndefined();
    expect(tournament.sponsors).toBeUndefined();
  });
});
