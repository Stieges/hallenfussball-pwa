import { describe, it, expect } from 'vitest';
import type { Tables } from '../../../types/supabase';
import {
  mapTeamToLiveTeamInfo,
  mapMatchEventFromSupabase,
  mapMatchEventToSupabase,
  mapLiveMatchFromSupabase,
  mapLiveMatchToSupabase,
  isMatchActive,
  clearLiveState,
} from '../liveMatchMappers';

// =============================================================================
// Test Data Factories
// =============================================================================

type TeamRow = Tables<'teams'>;
type MatchRow = Tables<'matches'>;
type MatchEventRow = Tables<'match_events'>;

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

function createMatchRow(overrides: Partial<MatchRow & { live_state?: unknown }> = {}): MatchRow {
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
  } as MatchRow;
}

function createEventRow(overrides: Partial<MatchEventRow> = {}): MatchEventRow {
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
    created_at: null,
    ...overrides,
  };
}

// =============================================================================
// TEAM INFO MAPPER
// =============================================================================

describe('mapTeamToLiveTeamInfo', () => {
  it('returns TBD for null team', () => {
    const info = mapTeamToLiveTeamInfo(null);

    expect(info.id).toBe('');
    expect(info.name).toBe('TBD');
    expect(info.logo).toBeUndefined();
    expect(info.colors).toBeUndefined();
  });

  it('maps team with logo', () => {
    const team = createTeamRow({
      logo_path: 'https://example.com/logo.png',
      logo_background_color: '#ffffff',
    });
    const info = mapTeamToLiveTeamInfo(team);

    expect(info.id).toBe('team-1');
    expect(info.name).toBe('FC Test');
    expect(info.logo).toEqual({
      type: 'url',
      value: 'https://example.com/logo.png',
      backgroundColor: '#ffffff',
    });
  });

  it('maps team with colors', () => {
    const team = createTeamRow({
      color_primary: '#ff0000',
      color_secondary: '#0000ff',
    });
    const info = mapTeamToLiveTeamInfo(team);

    expect(info.colors).toEqual({
      primary: '#ff0000',
      secondary: '#0000ff',
    });
  });

  it('uses defaults for missing secondary color', () => {
    const team = createTeamRow({ color_primary: '#ff0000' });
    const info = mapTeamToLiveTeamInfo(team);

    expect(info.colors?.primary).toBe('#ff0000');
    expect(info.colors?.secondary).toBe('#ffffff');
  });

  it('has no colors when both are null', () => {
    const team = createTeamRow();
    const info = mapTeamToLiveTeamInfo(team);

    expect(info.colors).toBeUndefined();
  });
});

// =============================================================================
// EVENT MAPPERS
// =============================================================================

describe('mapMatchEventFromSupabase', () => {
  it('maps GOAL event', () => {
    const row = createEventRow({
      type: 'GOAL',
      payload: { team: 'home', delta: 1, playerNumber: 7 },
      score_home: 1,
      score_away: 0,
    });
    const event = mapMatchEventFromSupabase(row);

    expect(event.id).toBe('event-1');
    expect(event.matchId).toBe('match-1');
    expect(event.timestampSeconds).toBe(120);
    expect(event.type).toBe('GOAL');
    expect(event.payload.team).toBe('home');
    expect(event.payload.delta).toBe(1);
    expect(event.payload.playerNumber).toBe(7);
    expect(event.scoreAfter).toEqual({ home: 1, away: 0 });
  });

  it('maps STATUS_CHANGE event', () => {
    const row = createEventRow({
      type: 'STATUS_CHANGE',
      payload: { toStatus: 'RUNNING' },
    });
    const event = mapMatchEventFromSupabase(row);

    expect(event.type).toBe('STATUS_CHANGE');
    expect(event.payload.toStatus).toBe('RUNNING');
  });

  it('handles null payload', () => {
    const row = createEventRow({ payload: null as unknown as MatchEventRow['payload'] });
    const event = mapMatchEventFromSupabase(row);

    expect(event.payload.team).toBeUndefined();
    expect(event.payload.delta).toBeUndefined();
  });
});

describe('mapMatchEventToSupabase', () => {
  it('maps event to DB row', () => {
    const event = {
      id: 'event-1',
      matchId: 'match-1',
      timestampSeconds: 120,
      type: 'GOAL' as const,
      payload: { team: 'home' as const, delta: 1 },
      scoreAfter: { home: 1, away: 0 },
    };
    const row = mapMatchEventToSupabase(event, 'match-1');

    expect(row.id).toBe('event-1');
    expect(row.match_id).toBe('match-1');
    expect(row.timestamp_seconds).toBe(120);
    expect(row.type).toBe('GOAL');
    expect(row.score_home).toBe(1);
    expect(row.score_away).toBe(0);
    expect(row.team_id).toBeNull();
    expect(row.player_id).toBeNull();
    expect(row.period).toBeNull();
    expect(row.incomplete).toBe(false);
    expect(row.is_deleted).toBe(false);
  });
});

// =============================================================================
// LIVE MATCH MAPPERS
// =============================================================================

describe('mapLiveMatchFromSupabase', () => {
  it('maps minimal match', () => {
    const matchRow = createMatchRow({
      match_number: 1,
      match_status: 'not_started',
    });
    const teamsMap = new Map<string, TeamRow>();

    const liveMatch = mapLiveMatchFromSupabase(matchRow, [], teamsMap);

    expect(liveMatch.id).toBe('match-1');
    expect(liveMatch.number).toBe(1);
    expect(liveMatch.status).toBe('NOT_STARTED');
    expect(liveMatch.homeScore).toBe(0);
    expect(liveMatch.awayScore).toBe(0);
    expect(liveMatch.homeTeam.name).toBe('TBD');
    expect(liveMatch.awayTeam.name).toBe('TBD');
    expect(liveMatch.events).toEqual([]);
    expect(liveMatch.version).toBe(1);
  });

  it('maps status correctly (all variants)', () => {
    const statuses = [
      ['not_started', 'NOT_STARTED'],
      ['running', 'RUNNING'],
      ['paused', 'PAUSED'],
      ['finished', 'FINISHED'],
    ] as const;

    const teamsMap = new Map<string, TeamRow>();
    for (const [dbStatus, frontendStatus] of statuses) {
      const matchRow = createMatchRow({ match_status: dbStatus });
      const liveMatch = mapLiveMatchFromSupabase(matchRow, [], teamsMap);
      expect(liveMatch.status).toBe(frontendStatus);
    }
  });

  it('maps teams from teamsMap', () => {
    const matchRow = createMatchRow({
      team_a_id: 'team-a',
      team_b_id: 'team-b',
    });
    const teamsMap = new Map<string, TeamRow>([
      ['team-a', createTeamRow({ id: 'team-a', name: 'Alpha' })],
      ['team-b', createTeamRow({ id: 'team-b', name: 'Beta' })],
    ]);

    const liveMatch = mapLiveMatchFromSupabase(matchRow, [], teamsMap);

    expect(liveMatch.homeTeam.name).toBe('Alpha');
    expect(liveMatch.awayTeam.name).toBe('Beta');
  });

  it('sorts events by timestamp and filters deleted', () => {
    const events = [
      createEventRow({ id: 'e3', timestamp_seconds: 300, is_deleted: null }),
      createEventRow({ id: 'e1', timestamp_seconds: 60, is_deleted: null }),
      createEventRow({ id: 'e2', timestamp_seconds: 180, is_deleted: true }),
    ];
    const matchRow = createMatchRow();
    const teamsMap = new Map<string, TeamRow>();

    const liveMatch = mapLiveMatchFromSupabase(matchRow, events, teamsMap);

    expect(liveMatch.events).toHaveLength(2);
    expect(liveMatch.events[0].id).toBe('e1');
    expect(liveMatch.events[1].id).toBe('e3');
  });

  it('parses live_state JSONB', () => {
    const matchRow = createMatchRow({
      match_status: 'running',
      live_state: {
        elapsedSeconds: 120,
        durationSeconds: 600,
        playPhase: 'regular',
        refereeName: 'SR1',
      },
    } as Partial<MatchRow>);
    const teamsMap = new Map<string, TeamRow>();

    const liveMatch = mapLiveMatchFromSupabase(matchRow, [], teamsMap);

    expect(liveMatch.elapsedSeconds).toBe(120);
    expect(liveMatch.durationSeconds).toBe(600);
    expect(liveMatch.playPhase).toBe('regular');
    expect(liveMatch.refereeName).toBe('SR1');
  });

  it('maps tournament phase', () => {
    const matchRow = createMatchRow({ phase: 'semifinal' });
    const teamsMap = new Map<string, TeamRow>();

    const liveMatch = mapLiveMatchFromSupabase(matchRow, [], teamsMap);

    expect(liveMatch.tournamentPhase).toBe('semifinal');
  });

  it('maps tiebreaker scores from match row', () => {
    const matchRow = createMatchRow({
      overtime_score_a: 1,
      overtime_score_b: 0,
      penalty_score_a: 4,
      penalty_score_b: 3,
    });
    const teamsMap = new Map<string, TeamRow>();

    const liveMatch = mapLiveMatchFromSupabase(matchRow, [], teamsMap);

    expect(liveMatch.overtimeScoreA).toBe(1);
    expect(liveMatch.overtimeScoreB).toBe(0);
    expect(liveMatch.penaltyScoreA).toBe(4);
    expect(liveMatch.penaltyScoreB).toBe(3);
  });
});

describe('mapLiveMatchToSupabase', () => {
  it('maps status to DB format', () => {
    const liveMatch = mapLiveMatchFromSupabase(
      createMatchRow({ match_status: 'running', score_a: 2, score_b: 1 }),
      [],
      new Map()
    );
    const { matchUpdate } = mapLiveMatchToSupabase(liveMatch);

    expect(matchUpdate.match_status).toBe('running');
    expect(matchUpdate.score_a).toBe(2);
    expect(matchUpdate.score_b).toBe(1);
    expect(matchUpdate.updated_at).toBeDefined();
  });

  it('clears live_state when FINISHED', () => {
    const liveMatch = mapLiveMatchFromSupabase(
      createMatchRow({ match_status: 'finished' }),
      [],
      new Map()
    );
    const { matchUpdate } = mapLiveMatchToSupabase(liveMatch);

    expect(matchUpdate.live_state).toBeNull();
  });

  it('preserves live_state when not finished', () => {
    const matchRow = createMatchRow({
      match_status: 'running',
      live_state: { elapsedSeconds: 120, durationSeconds: 600 },
    } as Partial<MatchRow>);
    const liveMatch = mapLiveMatchFromSupabase(matchRow, [], new Map());
    const { matchUpdate } = mapLiveMatchToSupabase(liveMatch);

    expect(matchUpdate.live_state).not.toBeNull();
    expect(matchUpdate.live_state?.elapsedSeconds).toBe(120);
    expect(matchUpdate.live_state?.durationSeconds).toBe(600);
  });

  it('filters new events not in existingEventIds', () => {
    const events = [
      createEventRow({ id: 'old-event', timestamp_seconds: 60 }),
      createEventRow({ id: 'new-event', timestamp_seconds: 120 }),
    ];
    const liveMatch = mapLiveMatchFromSupabase(
      createMatchRow({ match_status: 'running' }),
      events,
      new Map()
    );
    const existingIds = new Set(['old-event']);
    const { newEvents } = mapLiveMatchToSupabase(liveMatch, existingIds);

    expect(newEvents).toHaveLength(1);
    expect(newEvents[0].id).toBe('new-event');
  });

  it('returns all events as new when no existingEventIds', () => {
    const events = [
      createEventRow({ id: 'e1', timestamp_seconds: 60 }),
      createEventRow({ id: 'e2', timestamp_seconds: 120 }),
    ];
    const liveMatch = mapLiveMatchFromSupabase(
      createMatchRow({ match_status: 'running' }),
      events,
      new Map()
    );
    const { newEvents } = mapLiveMatchToSupabase(liveMatch);

    expect(newEvents).toHaveLength(2);
  });
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

describe('isMatchActive', () => {
  it('returns true for running match', () => {
    expect(isMatchActive(createMatchRow({ match_status: 'running' }))).toBe(true);
  });

  it('returns true for paused match', () => {
    expect(isMatchActive(createMatchRow({ match_status: 'paused' }))).toBe(true);
  });

  it('returns false for finished match', () => {
    expect(isMatchActive(createMatchRow({ match_status: 'finished' }))).toBe(false);
  });

  it('returns false for not_started without live_state', () => {
    expect(isMatchActive(createMatchRow({ match_status: 'not_started' }))).toBe(false);
  });

  it('returns true for not_started WITH live_state (initialized)', () => {
    const row = createMatchRow({
      match_status: 'not_started',
      live_state: { elapsedSeconds: 0 },
    } as Partial<MatchRow>);
    expect(isMatchActive(row)).toBe(true);
  });
});

describe('clearLiveState', () => {
  it('returns object with null live_state', () => {
    expect(clearLiveState()).toEqual({ live_state: null });
  });
});
