/**
 * SupabaseRepository.save() — R5-H1 (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md)
 *
 * Root cause (found in the R5 adversarial review, task-R5-review.md, Befund R5-H1):
 * save() deletes teams/matches that are no longer in the local state via
 * `.delete().in('id', idsToDelete)`, but only checked `error`, never how many rows were
 * ACTUALLY deleted. teams_delete_v2/matches_delete_v2 gate DELETE on the caller having the
 * 'restructure' permission (see supabase/migrations/20260924_002_central_role_permissions.sql).
 * A caller WITHOUT it (e.g. a collaborator) hits 0 matching rows -- NOT a Postgres error -- so
 * the old code silently believed the delete had happened. The schedule ended up duplicated: the
 * subsequent upsert (which that same caller *can* do) still inserted/updated the surviving rows,
 * leaving the "deleted" ones stale in the cloud.
 *
 * Fix: count the actually-deleted rows (`.select('id')`) and throw a RepositoryError on a
 * mismatch, so the failure reaches the existing MutationQueue retry/dead-letter path instead of
 * silently leaving a half-updated schedule.
 *
 * Both directions, each test RED first (against the pre-fix code, which only checked `error`):
 * a mock that deletes fewer rows than requested must throw; a mock that deletes all requested
 * rows must succeed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../models/types';
import { createTeamRow, createMatchRow, createTournamentRow } from '../../../../tests/factories/supabase';
import { mapTournamentFromSupabase } from '../supabaseMappers';

// ============================================================================
// MOCKS
// ============================================================================

const hoisted = vi.hoisted(() => {
  const getUserMock = vi.fn();

  // tournaments: legacy/fallback upsert branch (tournament.version is null in the fixture below
  // -- keeps the mock focused on the teams/matches delete-count behaviour under test, instead of
  // also exercising the optimistic-locking update branch).
  const tournamentsUpsertMock = vi.fn();

  // teams: select (existing ids) -> delete().in().select() (R5-H1) -> upsert (survivors)
  const teamsSelectEqMock = vi.fn();
  const teamsSelectMock = vi.fn(() => ({ eq: teamsSelectEqMock }));
  const teamsDeleteSelectMock = vi.fn();
  const teamsDeleteInMock = vi.fn(() => ({ select: teamsDeleteSelectMock }));
  const teamsDeleteMock = vi.fn(() => ({ in: teamsDeleteInMock }));
  const teamsUpsertMock = vi.fn();

  // matches: same shape as teams, PLUS update (A2: existing matches are updated with
  // schedule-only columns instead of upserted with the full row -- see task-A2-brief.md).
  const matchesSelectEqMock = vi.fn();
  const matchesSelectMock = vi.fn(() => ({ eq: matchesSelectEqMock }));
  const matchesDeleteSelectMock = vi.fn();
  const matchesDeleteInMock = vi.fn(() => ({ select: matchesDeleteSelectMock }));
  const matchesDeleteMock = vi.fn(() => ({ in: matchesDeleteInMock }));
  const matchesUpsertMock = vi.fn();

  // match_events: A6 (task-A6-brief.md) -- save() checks for existing events on every match it
  // is about to delete, BEFORE attempting the delete.
  const matchEventsSelectInMock = vi.fn();
  const matchEventsSelectMock = vi.fn(() => ({ in: matchEventsSelectInMock }));
  // A2 Fixrunde 1 (M3): .update().eq().eq().select('id') -- the .select() surfaces a silently
  // RLS-filtered 0-row update, same reasoning as the R5-H1 delete-count check above.
  const matchesUpdateSelectMock = vi.fn().mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });
  const matchesUpdateEqTournamentMock = vi.fn(() => ({ select: matchesUpdateSelectMock }));
  const matchesUpdateEqIdMock = vi.fn(() => ({ eq: matchesUpdateEqTournamentMock }));
  const matchesUpdateMock = vi.fn((_update: Record<string, unknown>) => ({ eq: matchesUpdateEqIdMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === 'tournaments') {
      return { upsert: tournamentsUpsertMock };
    }
    if (table === 'teams') {
      return { select: teamsSelectMock, delete: teamsDeleteMock, upsert: teamsUpsertMock };
    }
    if (table === 'matches') {
      return {
        select: matchesSelectMock,
        delete: matchesDeleteMock,
        upsert: matchesUpsertMock,
        update: matchesUpdateMock,
      };
    }
    if (table === 'match_events') {
      return { select: matchEventsSelectMock };
    }
    throw new Error(`unexpected table in test mock: ${table}`);
  });

  const supabaseMock = {
    from: fromMock,
    auth: { getUser: getUserMock },
  };

  return {
    getUserMock,
    tournamentsUpsertMock,
    teamsSelectEqMock,
    teamsDeleteSelectMock,
    teamsUpsertMock,
    matchesSelectEqMock,
    matchesDeleteSelectMock,
    matchesDeleteMock,
    matchesUpsertMock,
    matchesUpdateMock,
    matchesUpdateEqTournamentMock,
    matchesUpdateSelectMock,
    matchEventsSelectInMock,
    fromMock,
    supabaseMock,
  };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

import { SupabaseRepository } from '../SupabaseRepository';

const {
  getUserMock,
  tournamentsUpsertMock,
  teamsSelectEqMock,
  teamsDeleteSelectMock,
  teamsUpsertMock,
  matchesSelectEqMock,
  matchesDeleteSelectMock,
  matchesDeleteMock,
  matchesUpsertMock,
  matchesUpdateMock,
  matchesUpdateEqTournamentMock,
  matchesUpdateSelectMock,
  matchEventsSelectInMock,
} = hoisted;

// ============================================================================
// FIXTURES
// ============================================================================

/** A tournament with ONE surviving team/match — the local state after a team/match was removed. */
function makeTournamentWithOneTeamAndMatch(): Tournament {
  const tournament = mapTournamentFromSupabase(
    createTournamentRow({ version: null }),
    [createTeamRow({ id: 'team-survivor', name: 'Survivor' })],
    [createMatchRow({ id: 'match-survivor', team_a_id: 'team-survivor' })]
  );
  return tournament;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  tournamentsUpsertMock.mockResolvedValue({ error: null });
  teamsUpsertMock.mockResolvedValue({ error: null });
  matchesUpsertMock.mockResolvedValue({ error: null });
  matchesUpdateSelectMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });
  // A6 default: no match_events exist for any match under test -- the guard is a no-op unless a
  // test explicitly overrides this.
  matchEventsSelectInMock.mockResolvedValue({ data: [], error: null });
  // Existing rows in the cloud: two teams / two matches, one of which ('team-removed' /
  // 'match-removed') is no longer in the local tournament passed to save() — exactly the
  // "user removed a team/match" scenario from the R5 review (Sonde S-CA).
  teamsSelectEqMock.mockResolvedValue({
    data: [{ id: 'team-survivor' }, { id: 'team-removed' }],
    error: null,
  });
  matchesSelectEqMock.mockResolvedValue({
    data: [
      { id: 'match-survivor', match_status: 'scheduled', match_number: 1 },
      { id: 'match-removed', match_status: 'scheduled', match_number: 2 },
    ],
    error: null,
  });
});

// ============================================================================
// TESTS
// ============================================================================

describe('SupabaseRepository.save() — R5-H1: counts deleted rows instead of trusting `error`', () => {
  it('RED-GUARD: fewer teams actually deleted than requested throws instead of silently continuing', async () => {
    // Simulates a caller without 'restructure' (e.g. a collaborator): the DELETE statement
    // succeeds (no Postgres error) but the RLS USING clause filters out the row it has no
    // permission for -- exactly what teams_delete_v2 does for a non-owner/non-co-admin.
    teamsDeleteSelectMock.mockResolvedValue({ data: [], error: null }); // 0 of 1 requested
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(
      /Expected to delete 1 team\(s\), but only 0 were actually deleted/
    );

    // The mismatch must be caught BEFORE the teams upsert silently "completes" the save.
    expect(teamsUpsertMock).not.toHaveBeenCalled();
  });

  it('RED-GUARD: fewer matches actually deleted than requested throws instead of silently continuing', async () => {
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [], error: null }); // 0 of 1 requested

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(
      /Expected to delete 1 match\(es\), but only 0 were actually deleted/
    );

    expect(matchesUpsertMock).not.toHaveBeenCalled();
  });

  it('all requested rows actually deleted (owner/co-admin path) succeeds and continues to update', async () => {
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toBeUndefined();

    expect(teamsUpsertMock).toHaveBeenCalledTimes(1);
    // 'match-survivor' already exists in the cloud (see beforeEach) -> A2: existing matches are
    // updated (schedule columns only), never upserted with the full row.
    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('no delete attempted (nothing removed locally) never calls delete, only update', async () => {
    // Ground state: nothing removed -- existing ids equal the tournament's own ids.
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: 'team-survivor' }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toBeUndefined();

    expect(teamsDeleteSelectMock).not.toHaveBeenCalled();
    expect(matchesDeleteSelectMock).not.toHaveBeenCalled();
    expect(teamsUpsertMock).toHaveBeenCalledTimes(1);
    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpdateMock).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================================
// A6 (task-A6-brief.md, C-K6): a match missing from the local tournament is only ever deleted
// when it has NO match_events AND is still 'scheduled' (or NULL) -- otherwise save() throws
// instead of silently deleting it (or silently keeping it without telling the user).
// ============================================================================================

describe('SupabaseRepository.save() — A6: never silently deletes a match with events', () => {
  it('RED-GUARD: a match-to-delete that already has match_events is NOT deleted, save() throws', async () => {
    matchEventsSelectInMock.mockResolvedValue({ data: [{ match_id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(
      /Spiel 2 hat Einträge – nur die Turnierleitung kann es absetzen\./
    );

    // Fail-fast for the matches batch: the delete is never attempted once any match is blocked.
    // Teams are handled in an earlier, independent step (2) and are unaffected by this guard.
    expect(matchesDeleteMock).not.toHaveBeenCalled();
  });

  it('RED-GUARD: a match-to-delete that is no longer "scheduled" is NOT deleted, save() throws', async () => {
    matchesSelectEqMock.mockResolvedValue({
      data: [
        { id: 'match-survivor', match_status: 'scheduled', match_number: 1 },
        { id: 'match-removed', match_status: 'finished', match_number: 2 },
      ],
      error: null,
    });
    matchEventsSelectInMock.mockResolvedValue({ data: [], error: null }); // no events, status alone blocks it

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(
      /Spiel 2 hat Einträge – nur die Turnierleitung kann es absetzen\./
    );

    expect(matchesDeleteMock).not.toHaveBeenCalled();
  });

  it('a match-to-delete with NO events and match_status "scheduled" is deleted as before', async () => {
    matchEventsSelectInMock.mockResolvedValue({ data: [], error: null });
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toBeUndefined();

    expect(matchesDeleteMock).toHaveBeenCalledTimes(1);
    expect(matchEventsSelectInMock).toHaveBeenCalledWith('match_id', ['match-removed']);
  });

  it('a match-to-delete with match_status NULL and no events is still deleted (treated like "scheduled")', async () => {
    matchesSelectEqMock.mockResolvedValue({
      data: [
        { id: 'match-survivor', match_status: 'scheduled', match_number: 1 },
        { id: 'match-removed', match_status: null, match_number: 2 },
      ],
      error: null,
    });
    matchEventsSelectInMock.mockResolvedValue({ data: [], error: null });
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toBeUndefined();

    expect(matchesDeleteMock).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// A2 (task-A2-brief.md): full save must never overwrite a helper's live match
// ============================================================================

describe('SupabaseRepository.save() — A2: existing matches update ONLY schedule columns', () => {
  it('an EXISTING match is inserted via the schedule-only update, not the full-row upsert', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: 'team-survivor' }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toBeUndefined();

    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpdateMock).toHaveBeenCalledTimes(1);

    const updatePayload = matchesUpdateMock.mock.calls[0][0];
    // Schedule columns are present ...
    expect(updatePayload).toHaveProperty('round');
    expect(updatePayload).toHaveProperty('field');
    expect(updatePayload).toHaveProperty('team_a_id');
    // ... but NOT ANY live/result column.
    expect(updatePayload).not.toHaveProperty('score_a');
    expect(updatePayload).not.toHaveProperty('score_b');
    expect(updatePayload).not.toHaveProperty('match_status');
    expect(updatePayload).not.toHaveProperty('actual_end');
    expect(updatePayload).not.toHaveProperty('actual_start');
    expect(updatePayload).not.toHaveProperty('timer_start_time');
    expect(updatePayload).not.toHaveProperty('timer_paused_at');
    expect(updatePayload).not.toHaveProperty('timer_elapsed_seconds');
    expect(updatePayload).not.toHaveProperty('overtime_score_a');
    expect(updatePayload).not.toHaveProperty('overtime_score_b');
    expect(updatePayload).not.toHaveProperty('penalty_score_a');
    expect(updatePayload).not.toHaveProperty('penalty_score_b');
    expect(updatePayload).not.toHaveProperty('decided_by');
    expect(updatePayload).not.toHaveProperty('skipped_reason');
    expect(updatePayload).not.toHaveProperty('skipped_at');
    expect(updatePayload).not.toHaveProperty('live_state');
  });

  it('a NEW match (not yet in the cloud) is still fully inserted via upsert', async () => {
    // Nothing exists in the cloud yet for this tournament -- e.g. right after schedule generation.
    teamsSelectEqMock.mockResolvedValue({ data: [], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toBeUndefined();

    expect(matchesUpdateMock).not.toHaveBeenCalled();
    expect(matchesUpsertMock).toHaveBeenCalledTimes(1);

    const insertedRows = matchesUpsertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(insertedRows).toHaveLength(1);
    // The new row keeps its full shape (live columns included, default 'scheduled').
    expect(insertedRows[0]).toHaveProperty('score_a');
    expect(insertedRows[0]).toHaveProperty('match_status', 'scheduled');
  });

  it('the schedule-only update scopes to the correct match AND tournament id', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: 'team-survivor' }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });

    const repo = new SupabaseRepository();
    const tournament = makeTournamentWithOneTeamAndMatch();
    await expect(repo.save(tournament)).resolves.toBeUndefined();

    expect(matchesUpdateMock).toHaveBeenCalledTimes(1);
    expect(matchesUpdateEqTournamentMock).toHaveBeenCalledWith('tournament_id', tournament.id);
  });

  // A2 Fixrunde 1 (M3): a silently RLS-filtered 0-row update must throw, not be treated as
  // success -- same reasoning as the R5-H1 delete-count check for teams/matches above.
  it('throws when the schedule-only update silently affects 0 rows (RLS-filtered, no Postgres error)', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: 'team-survivor' }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });
    matchesUpdateSelectMock.mockResolvedValue({ data: [], error: null }); // 0 of 1 expected

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(
      /0 rows updated \(expected 1, got 0\)/
    );
  });

  it('multiple existing matches are updated CONCURRENTLY (Promise.all), not one-at-a-time (I3)', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: 'team-survivor' }], error: null });
    matchesSelectEqMock.mockResolvedValue({
      data: [{ id: 'match-survivor' }, { id: 'match-survivor-2' }],
      error: null,
    });

    // Tracks how many `.select()` calls were IN FLIGHT at once -- a sequential `for await` loop
    // never has more than 1 in flight; `Promise.all` starts both before either resolves.
    let inFlight = 0;
    let maxInFlight = 0;
    matchesUpdateSelectMock.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve(); // yield once, so a sequential loop WOULD show inFlight drop to 0 first
      inFlight--;
      return { data: [{ id: 'match-survivor' }], error: null };
    });

    const tournament = mapTournamentFromSupabase(
      createTournamentRow({ version: null }),
      [createTeamRow({ id: 'team-survivor', name: 'Survivor' })],
      [
        createMatchRow({ id: 'match-survivor', team_a_id: 'team-survivor' }),
        createMatchRow({ id: 'match-survivor-2', team_a_id: 'team-survivor' }),
      ]
    );

    const repo = new SupabaseRepository();
    await expect(repo.save(tournament)).resolves.toBeUndefined();

    expect(matchesUpdateMock).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(2);
  });
});
