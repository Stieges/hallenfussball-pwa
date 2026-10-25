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
import { teamSlot } from '../../models/matchSlot';
import type { Match } from '../../models/types';
import { testUuid } from '../../../test/testIds';
import { withStaleSides } from '../../../test/matchSlotFixtures';

// A-02: Team-IDs sind UUIDs, jede Spielseite trägt Team-ID oder Herkunft (Slot-Tests:
// supabaseMappers.slots.test.ts). Bestandstests nutzen besetzte Seiten.
const TEAM_1 = testUuid(1);
const TEAM_2 = testUuid(2);

/** Zeile mit zwei besetzten Seiten. */
function matchRow(overrides: Parameters<typeof createMatchRow>[0] = {}) {
  return createMatchRow({ team_a_id: TEAM_1, team_b_id: TEAM_2, ...overrides });
}

/** Spiel mit zwei besetzten Seiten. */
function slotMatch(overrides: Partial<Match> = {}): Match {
  return { id: 'match-1', round: 1, field: 1, slotA: teamSlot(TEAM_1), slotB: teamSlot(TEAM_2), ...overrides };
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
  // A-02: Namens-/Platzhalter-Auflösung entfällt – Ersatz in supabaseMappers.slots.test.ts
  // („@TM-027 gesetzte Team-ID wird zum Team-Slot …“, „Seite ohne Team-ID und ohne Herkunft scheitert laut“).
  it('A-36a: kein Übergangsfeld teamA/teamB, die Seiten stehen im Slot (Ersatz für "resolves team names via teamIdToName map")', () => {
    const match = mapMatchFromSupabase(matchRow(), '2026-01-15');

    expect('teamA' in match || 'teamB' in match).toBe(false);
    expect(match.slotA).toEqual({ kind: 'team', teamId: TEAM_1 });
  });

  it('constructs Date from scheduled_start time string', () => {
    const row = matchRow({ scheduled_start: '14:30:00' });
    const match = mapMatchFromSupabase(row, '2026-01-15');

    expect(match.scheduledTime).toBeInstanceOf(Date);
    expect(match.scheduledTime!.getHours()).toBe(14);
    expect(match.scheduledTime!.getMinutes()).toBe(30);
  });

  it('returns undefined scheduledTime when scheduled_start is null', () => {
    const row = matchRow({ scheduled_start: null });
    const match = mapMatchFromSupabase(row, '2026-01-15');

    expect(match.scheduledTime).toBeUndefined();
  });

  it('maps match status with default', () => {
    const row = matchRow({ match_status: 'live' });
    const match = mapMatchFromSupabase(row, '2026-01-15');
    expect(match.matchStatus).toBe('live');

    const rowDefault = matchRow({ match_status: null });
    const matchDefault = mapMatchFromSupabase(rowDefault, '2026-01-15');
    expect(matchDefault.matchStatus).toBe('scheduled');
  });

  it('maps all score/timer fields', () => {
    const row = matchRow({
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
    const match = mapMatchFromSupabase(row, '2026-01-15');

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
    const row = matchRow({
      is_final: true,
      final_type: 'semifinal',
      label: 'Halbfinale 1',
      phase: 'semifinal',
      match_number: 13,
    });
    const match = mapMatchFromSupabase(row, '2026-01-15');

    expect(match.isFinal).toBe(true);
    expect(match.finalType).toBe('semifinal');
    expect(match.label).toBe('Halbfinale 1');
    expect(match.phase).toBe('semifinal');
    expect(match.matchNumber).toBe(13);
  });
});

describe('mapMatchToSupabase', () => {
  // A-02: Namenssuche entfällt – Ersatz in supabaseMappers.slots.test.ts („@FU-001 Pflicht …“,
  // „offene Seite schreibt keine Team-ID, nur die Herkunft“).
  it('serializes Date scheduledTime to time string', () => {
    const date = new Date('2026-01-15T14:30:00');
    const row = mapMatchToSupabase(
      slotMatch({ scheduledTime: date }),
      'tournament-1'
    );

    expect(row.scheduled_start).toMatch(/14:30:00/);
  });

  it('serializes string scheduledTime', () => {
    const row = mapMatchToSupabase(
      slotMatch({ scheduledTime: '15:00:00' as unknown as Date }),
      'tournament-1'
    );

    expect(row.scheduled_start).toBe('15:00:00');
  });

  it('maps owner_id and is_public for RLS', () => {
    const row = mapMatchToSupabase(
      slotMatch(),
      'tournament-1',
      'user-1',
      true
    );

    expect(row.owner_id).toBe('user-1');
    expect(row.is_public).toBe(true);
  });

  it('defaults phase to groupStage', () => {
    const row = mapMatchToSupabase(
      slotMatch(),
      'tournament-1'
    );

    expect(row.phase).toBe('groupStage');
  });

  it('Insert sendet nur neutrale Initialwerte – Ergebnis-/Status-/Uhr-/Skip-Spalten fehlen (C3a-2b V4b, F10/Gast-Upload)', () => {
    const row = mapMatchToSupabase(
      {
        id: 'match-1',
        round: 1,
        field: 1,
        slotA: teamSlot(TEAM_1),
        slotB: teamSlot(TEAM_2),
        scoreA: 3,
        scoreB: 1,
        matchStatus: 'finished',
        finishedAt: '2026-01-15T14:45:00Z',
        timerStartTime: '2026-01-15T14:30:00Z',
        timerPausedAt: '2026-01-15T14:35:00Z',
        timerElapsedSeconds: 300,
        overtimeScoreA: 1,
        overtimeScoreB: 0,
        penaltyScoreA: 4,
        penaltyScoreB: 3,
        decidedBy: 'overtime',
        skippedReason: 'Team not present',
        skippedAt: '2026-01-15T14:00:00Z',
      },
      'tournament-1'
    );

    expect(row.score_a).toBeNull();
    expect(row.score_b).toBeNull();
    expect(row.match_status).toBe('scheduled');
    expect(row.timer_elapsed_seconds).toBe(0);
    expect(row).not.toHaveProperty('actual_end');
    expect(row).not.toHaveProperty('timer_start_time');
    expect(row).not.toHaveProperty('timer_paused_at');
    expect(row).not.toHaveProperty('overtime_score_a');
    expect(row).not.toHaveProperty('overtime_score_b');
    expect(row).not.toHaveProperty('penalty_score_a');
    expect(row).not.toHaveProperty('penalty_score_b');
    expect(row).not.toHaveProperty('decided_by');
    expect(row).not.toHaveProperty('skipped_reason');
    expect(row).not.toHaveProperty('skipped_at');
  });

  it('Plomben sind hart gesetzt – match.scoreA erscheint NIE im Payload, kein Phantom-0:0 (F2)', () => {
    const rowMitWerten = mapMatchToSupabase(
      slotMatch({ scoreA: 3, scoreB: 1 }),
      'tournament-1'
    );
    const rowOhneWerte = mapMatchToSupabase(
      slotMatch(),
      'tournament-1'
    );

    expect(rowMitWerten.score_a).toBeNull();
    expect(rowMitWerten.score_b).toBeNull();
    expect(rowOhneWerte.score_a).toBeNull();
    expect(rowOhneWerte.score_b).toBeNull();
  });
});

describe('mapMatchToScheduleUpdate (A2: task-A2-brief.md)', () => {
  it('carries over every schedule column from the full insert row', () => {
    const row = mapMatchToSupabase(
      {
        id: 'match-1',
        round: 2,
        field: 3,
        slot: 4,
        slotA: teamSlot(TEAM_1),
        slotB: teamSlot(TEAM_2),
        group: 'A',
        isFinal: true,
        finalType: 'final',
        label: 'Finale',
        matchNumber: 7,
        phase: 'final',
        referee: 5,
      },
      'tournament-1'
    );

    const update = mapMatchToScheduleUpdate(row);

    expect(update.team_a_id).toBe(TEAM_1);
    expect(update.team_b_id).toBe(TEAM_2);
    expect(update.slot_a_source).toBeNull();
    expect(update.slot_b_source).toBeNull();
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
        slotA: teamSlot(TEAM_1),
        slotB: teamSlot(TEAM_2),
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
      'tournament-1'
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
  it('sendet Ergebnis-, Status-, Uhr- und Skip-Spalten nie – auch wenn alle Keys im Update stehen (C3a-2b V4/R1)', () => {
    const update = mapMatchUpdateToSupabase({
      scoreA: 2,
      scoreB: 1,
      matchStatus: 'running',
      finishedAt: '2026-01-15T14:45:00Z',
      timerStartTime: '2026-01-15T14:30:00Z',
      timerPausedAt: '2026-01-15T14:35:00Z',
      timerElapsedSeconds: 300,
      overtimeScoreA: 1,
      overtimeScoreB: 0,
      penaltyScoreA: 4,
      penaltyScoreB: 3,
      decidedBy: 'penalty',
      skippedReason: 'Team not present',
      skippedAt: '2026-01-15T14:00:00Z',
    });

    expect(update).not.toHaveProperty('score_a');
    expect(update).not.toHaveProperty('score_b');
    expect(update).not.toHaveProperty('match_status');
    expect(update).not.toHaveProperty('actual_end');
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
    expect(update).toEqual({ updated_at: expect.any(String) });
  });

  it('unskip-Payload (skippedReason/skippedAt: undefined) erzeugt keine skipped_*-Spalten, auch keine NULLs (B3)', () => {
    const update = mapMatchUpdateToSupabase({
      matchStatus: 'scheduled',
      skippedReason: undefined,
      skippedAt: undefined,
    });

    expect(update).not.toHaveProperty('skipped_reason');
    expect(update).not.toHaveProperty('skipped_at');
  });

  it('sendet score_a/score_b bewusst nicht (Ersatz: "maps partial score update")', () => {
    const update = mapMatchUpdateToSupabase({ scoreA: 2, scoreB: 1 });

    expect(update).not.toHaveProperty('score_a');
    expect(update).not.toHaveProperty('score_b');
    expect(update.updated_at).toBeDefined();
  });

  it('sendet match_status bewusst nicht (Ersatz: "maps status update")', () => {
    const update = mapMatchUpdateToSupabase({ matchStatus: 'running' });

    expect(update).not.toHaveProperty('match_status');
    expect(update.updated_at).toBeDefined();
  });

  it('always sets updated_at even for empty update', () => {
    const update = mapMatchUpdateToSupabase({});

    expect(update.updated_at).toBeDefined();
    expect(typeof update.updated_at).toBe('string');
  });

  // A-02: Namens-Map entfällt – Ersatz in supabaseMappers.slots.test.ts („Teamtausch erreicht die Cloud …“,
  // „Gegenbeispiel: ein Update ohne Slot-Schlüssel lässt beide Team-Spalten unberührt“).
  it('teamA allein (Übergangsfeld) wird nicht gesendet (Ersatz für "does not map team changes without teamNameToId")', () => {
    const update = mapMatchUpdateToSupabase(withStaleSides({}, 'FC Alpha', 'FC Beta'));

    expect(update.team_a_id).toBeUndefined();
    expect(update.team_a_placeholder).toBeUndefined();
  });

  it('sendet timer/tiebreaker/skip-Spalten bewusst nicht (Ersatz: "maps all timer and tiebreaker fields")', () => {
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

    expect(update).not.toHaveProperty('actual_end');
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
      createTeamRow({ id: TEAM_1, name: 'Alpha' }),
      createTeamRow({ id: TEAM_2, name: 'Beta' }),
    ];
    const matchRows = [
      matchRow({
        id: 'match-1',
        match_number: 1,
      }),
    ];

    const tournament = mapTournamentFromSupabase(row, teamRows, matchRows);

    expect(tournament.teams).toHaveLength(2);
    expect(tournament.matches).toHaveLength(1);
    // A-36a: kein Übergangsfeld mehr, die Seite steht nur im Slot (Name kommt aus tournament.teams).
    expect('teamA' in tournament.matches[0]).toBe(false);
    expect(tournament.matches[0].slotA).toEqual({ kind: 'team', teamId: TEAM_1 });
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
      finished_at: '2026-01-14T18:00:00Z',
    });
    const tournament = mapTournamentFromSupabase(row, [], []);

    expect(tournament.version).toBe(5);
    expect(tournament.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(tournament.updatedAt).toBe('2026-01-10T12:00:00Z');
    expect(tournament.deletedAt).toBe('2026-01-15T00:00:00Z');
    expect(tournament.finishedAt).toBe('2026-01-14T18:00:00Z');
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
      [createTeamRow({ id: TEAM_1, name: 'Alpha' })],
      [matchRow({ id: 'match-1' })]
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

  it('übernimmt die Team-IDs der gelesenen Spiele unverändert (Ersatz für "builds team name to ID map")', () => {
    const teamRows = [
      createTeamRow({ id: TEAM_1, name: 'Alpha' }),
      createTeamRow({ id: TEAM_2, name: 'Beta' }),
    ];
    const tournament = mapTournamentFromSupabase(createTournamentRow(), teamRows, [matchRow({ id: 'match-1' })]);
    const result = mapTournamentToSupabase(tournament, 'user-1');

    expect(result.matchRows[0].team_a_id).toBe(TEAM_1);
    expect(result.matchRows[0].team_b_id).toBe(TEAM_2);
  });

  it('K1: denormalisiert is_public=true auf Team- und Match-Zeilen eines öffentlichen Turniers', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow({ is_public: true }),
      [createTeamRow({ id: TEAM_1, name: 'Alpha' })],
      [matchRow({ id: 'match-1' })]
    );
    const result = mapTournamentToSupabase(tournament, 'user-1');
    expect(result.teamRows[0].is_public).toBe(true);
    expect(result.matchRows[0].is_public).toBe(true);
  });

  it('K1: denormalisiert is_public=false bei privatem Turnier', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow({ is_public: false }),
      [createTeamRow({ id: TEAM_1, name: 'Alpha' })],
      [matchRow({ id: 'match-1' })]
    );
    const result = mapTournamentToSupabase(tournament, 'user-1');
    expect(result.teamRows[0].is_public).toBe(false);
    expect(result.matchRows[0].is_public).toBe(false);
  });
});

// =============================================================================
// TOURNAMENT_COLLABORATORS + PROFILE MAPPER TESTS (Supabase 2.105 upgrade)
// =============================================================================

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
