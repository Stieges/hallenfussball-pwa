import { describe, it, expect } from 'vitest';
import {
  mapTeamToLiveTeamInfo,
  mapMatchEventFromSupabase,
  mapLiveMatchFromSupabase,
  isMatchActive,
} from '../liveMatchMappers';
import {
  createTeamRow,
  createMatchRow,
  createEventRow,
  type TeamRow,
  type MatchEventRow,
} from '../../../../tests/factories/supabase';

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
      // 'not_started' ist die Alt-Kennung von vor dem C-NSTART-Fix (wird nie mehr
      // geschrieben, aber beim Lesen weiter toleriert). 'scheduled' ist der neue,
      // vom CHECK-Constraint erlaubte Wert für "noch nicht gestartet".
      ['not_started', 'NOT_STARTED'],
      ['scheduled', 'NOT_STARTED'],
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

  // A-35 (@FU-038 „Dann ist das Tor nicht im Spielstand“, @FU-017, @HE-056): ein Eintrag in der Klärungsliste
  // (review_state 'pending') zählt nicht und erscheint nicht als Eintrag des Spiels; erst die Kopie nach „Übernehmen“.
  it('@FU-038 zeigt einen Eintrag der Klärungsliste nicht als Eintrag des Spiels (Gegenbeispiel: normaler Eintrag bleibt)', () => {
    const events = [
      createEventRow({ id: 'tor-tom-nach-uebernahme', timestamp_seconds: 60, event_format: 1, review_state: 'pending' }),
      createEventRow({ id: 'tor-olli', timestamp_seconds: 90, event_format: 1, review_state: null }),
      createEventRow({ id: 'tor-uebernommen', timestamp_seconds: 120, event_format: 1, target_event_id: 'tor-tom-nach-uebernahme' }),
    ];

    const liveMatch = mapLiveMatchFromSupabase(createMatchRow(), events, new Map<string, TeamRow>());

    expect(liveMatch.events.map((event) => event.id)).toEqual(['tor-olli', 'tor-uebernommen']);
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
    });
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
    });
    expect(isMatchActive(row)).toBe(true);
  });
});
