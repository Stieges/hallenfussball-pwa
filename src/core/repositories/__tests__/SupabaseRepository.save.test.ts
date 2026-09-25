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
  const matchesUpdateEqTournamentMock = vi.fn().mockResolvedValue({ error: null });
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
    matchesUpsertMock,
    matchesUpdateMock,
    matchesUpdateEqTournamentMock,
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
  matchesUpsertMock,
  matchesUpdateMock,
  matchesUpdateEqTournamentMock,
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
  // Existing rows in the cloud: two teams / two matches, one of which ('team-removed' /
  // 'match-removed') is no longer in the local tournament passed to save() — exactly the
  // "user removed a team/match" scenario from the R5 review (Sonde S-CA).
  teamsSelectEqMock.mockResolvedValue({
    data: [{ id: 'team-survivor' }, { id: 'team-removed' }],
    error: null,
  });
  matchesSelectEqMock.mockResolvedValue({
    data: [{ id: 'match-survivor' }, { id: 'match-removed' }],
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
});
