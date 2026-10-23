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
import { testUuid } from '../../../test/testIds';

// A-02: Team-IDs sind UUIDs (TeamIdSchema), jede Spielseite trägt Team-ID oder Herkunft.
const TEAM_SURVIVOR = testUuid(1);

/** Spiel des überlebenden Teams: Heimseite besetzt, Gastseite offen (Gruppe A, Platz 1). */
function survivorMatchRow(id: string) {
  return createMatchRow({
    id,
    team_a_id: TEAM_SURVIVOR,
    slot_b_source: { kind: 'groupRank', group: 'A', rank: 1 },
  });
}

// ============================================================================
// MOCKS
// ============================================================================

const hoisted = vi.hoisted(() => {
  const getUserMock = vi.fn();

  // tournaments: legacy/fallback upsert branch (tournament.version is null in the fixture below
  // -- keeps the mock focused on the teams/matches delete-count behaviour under test, instead of
  // also exercising the optimistic-locking update branch).
  const tournamentsUpsertMock = vi.fn();
  // C-VERSION-NACH-ERSTANLAGE: Zweig mit Version – update().eq().eq().select(), sonst select().eq().single() + insert()
  const tournamentsUpdateSelectMock = vi.fn();
  const tournamentsUpdateMock = vi.fn((_row: Record<string, unknown>) => ({ eq: () => ({ eq: () => ({ select: tournamentsUpdateSelectMock }) }) }));
  const tournamentsExistingSingleMock = vi.fn();
  const tournamentsInsertMock = vi.fn();

  // teams: select (existing ids) -> delete().in().select() (R5-H1) -> upsert (survivors)
  const teamsSelectEqMock = vi.fn();
  const teamsSelectMock = vi.fn(() => ({ eq: teamsSelectEqMock }));
  const teamsDeleteSelectMock = vi.fn();
  const teamsDeleteInMock = vi.fn(() => ({ select: teamsDeleteSelectMock }));
  const teamsDeleteMock = vi.fn(() => ({ in: teamsDeleteInMock }));
  const teamsUpsertMock = vi.fn();
  // A-02 Fixrunde 1 (I3): update().eq().select('id') -- zu löschende Teams mit Namenskollision umbenennen.
  const teamsUpdateSelectMock = vi.fn();
  const teamsUpdateEqMock = vi.fn(() => ({ select: teamsUpdateSelectMock }));
  const teamsUpdateMock = vi.fn((_update: Record<string, unknown>) => ({ eq: teamsUpdateEqMock }));

  // A6 Fixrunde 1 (I2, Ruling AN): save() no longer throws for a protected match -- it notifies
  // instead. Spy on the notification channel (core/services/matchProtectionNotices.ts).
  const notifyMatchesProtectedMock = vi.fn();

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
      return {
        upsert: tournamentsUpsertMock,
        update: tournamentsUpdateMock,
        select: () => ({ eq: () => ({ single: tournamentsExistingSingleMock }) }),
        insert: tournamentsInsertMock,
      };
    }
    if (table === 'teams') {
      return { select: teamsSelectMock, delete: teamsDeleteMock, upsert: teamsUpsertMock, update: teamsUpdateMock };
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
    tournamentsUpdateSelectMock,
    tournamentsUpdateMock,
    tournamentsExistingSingleMock,
    tournamentsInsertMock,
    teamsSelectEqMock,
    teamsDeleteSelectMock,
    teamsDeleteMock,
    teamsUpsertMock,
    teamsUpdateMock,
    teamsUpdateEqMock,
    teamsUpdateSelectMock,
    notifyMatchesProtectedMock,
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

vi.mock('../../services/matchProtectionNotices', () => ({
  notifyMatchesProtected: hoisted.notifyMatchesProtectedMock,
}));

import { SupabaseRepository } from '../SupabaseRepository';
import { OptimisticLockError } from '../../errors';
import { isAuthExpired } from '../../services/mutationQueueRetry';
import {
  TeamStillReferencedError,
  TournamentGoneError,
  definitiveRejectionReason,
  AuthenticationError,
  RepositoryError,
  isTransientMutationError,
} from '../../errors';

const {
  getUserMock,
  tournamentsUpsertMock,
  tournamentsUpdateSelectMock,
  tournamentsUpdateMock,
  tournamentsExistingSingleMock,
  tournamentsInsertMock,
  teamsSelectEqMock,
  teamsDeleteSelectMock,
  teamsDeleteMock,
  teamsUpsertMock,
  teamsUpdateMock,
  teamsUpdateEqMock,
  teamsUpdateSelectMock,
  notifyMatchesProtectedMock,
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
    [createTeamRow({ id: TEAM_SURVIVOR, name: 'Survivor' })],
    [survivorMatchRow('match-survivor')]
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
    data: [{ id: TEAM_SURVIVOR }, { id: 'team-removed' }],
    error: null,
  });
  matchesSelectEqMock.mockResolvedValue({
    data: [
      { id: 'match-survivor', match_status: 'scheduled', match_number: 1, team_a_id: TEAM_SURVIVOR, team_b_id: null },
      { id: 'match-removed', match_status: 'scheduled', match_number: 2, team_a_id: 'team-removed', team_b_id: null },
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

    // A-02 (I6): Teams werden zuerst angelegt/aktualisiert und erst NACH den Spielen gelöscht –
    // der Upsert lief also schon; entscheidend ist, dass die Abweichung laut scheitert.
    expect(teamsUpsertMock).toHaveBeenCalledTimes(1);
  });

  it('RED-GUARD: fewer matches actually deleted than requested throws instead of silently continuing', async () => {
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [], error: null }); // 0 of 1 requested

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(
      /Expected to delete 1 match\(es\), but only 0 were actually deleted/
    );

    expect(matchesUpsertMock).not.toHaveBeenCalled();
    // A-02 (I6): Teams werden erst nach den Spielen gelöscht – nach dem Fehler gar nicht mehr.
    expect(teamsDeleteMock).not.toHaveBeenCalled();
  });

  it('all requested rows actually deleted (owner/co-admin path) succeeds and continues to update', async () => {
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(teamsUpsertMock).toHaveBeenCalledTimes(1);
    // 'match-survivor' already exists in the cloud (see beforeEach) -> A2: existing matches are
    // updated (schedule columns only), never upserted with the full row.
    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('no delete attempted (nothing removed locally) never calls delete, only update', async () => {
    // Ground state: nothing removed -- existing ids equal the tournament's own ids.
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(teamsDeleteSelectMock).not.toHaveBeenCalled();
    expect(matchesDeleteSelectMock).not.toHaveBeenCalled();
    expect(teamsUpsertMock).toHaveBeenCalledTimes(1);
    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpdateMock).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================================
// A6 (task-A6-brief.md, C-K6; Fixrunde 1, task-A6-review.md I1/I2 Ruling AN): a match missing
// from the local tournament is only ever deleted when it has NO match_events AND is still
// 'scheduled' (or NULL) -- otherwise it is KEPT (not deleted) and `notifyMatchesProtected()` is
// called, but save() itself completes successfully (Ruling AN: NOT an error, or the queue would
// dead-letter this mutation after MAX_RETRIES and permanently block every later sync of this
// tournament). I1: the whole check runs BEFORE any write, and a team referenced by a protected
// match is preserved too (else `matches.team_a_id`/`team_b_id`, ON DELETE SET NULL, would still
// lose the pairing even though the match row survived).
// ============================================================================================

describe('SupabaseRepository.save() — A6: protects matches with events or a non-"scheduled" status', () => {
  it('RED-GUARD (Ruling AN): a match-to-delete with match_events is KEPT, save() resolves (does not throw)', async () => {
    matchEventsSelectInMock.mockResolvedValue({ data: [{ match_id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    const tournament = makeTournamentWithOneTeamAndMatch();
    await expect(repo.save(tournament)).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    // 'match-removed' was the only delete candidate -- once it's protected, nothing is left to
    // delete at all.
    expect(matchesDeleteMock).not.toHaveBeenCalled();
    // The rest of the save still completes (Ruling AN: not an error).
    expect(teamsUpsertMock).toHaveBeenCalledTimes(1);
    expect(tournamentsUpsertMock).toHaveBeenCalledTimes(1);

    expect(notifyMatchesProtectedMock).toHaveBeenCalledTimes(1);
    expect(notifyMatchesProtectedMock).toHaveBeenCalledWith({
      tournamentId: tournament.id,
      matches: [{ id: 'match-removed', matchNumber: 2 }],
    });
  });

  it('RED-GUARD: a match-to-delete that is no longer "scheduled" is also KEPT, save() resolves', async () => {
    matchesSelectEqMock.mockResolvedValue({
      data: [
        { id: 'match-survivor', match_status: 'scheduled', match_number: 1, team_a_id: TEAM_SURVIVOR, team_b_id: null },
        { id: 'match-removed', match_status: 'finished', match_number: 2, team_a_id: null, team_b_id: null },
      ],
      error: null,
    });
    matchEventsSelectInMock.mockResolvedValue({ data: [], error: null }); // no events, status alone blocks it

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(matchesDeleteMock).not.toHaveBeenCalled();
    expect(notifyMatchesProtectedMock).toHaveBeenCalledWith(
      expect.objectContaining({ matches: [{ id: 'match-removed', matchNumber: 2 }] })
    );
  });

  it('I1: a team referenced ONLY by a protected match is not deleted either (pairing survives)', async () => {
    // Default fixture (beforeEach) already has 'match-removed' with team_a_id: 'team-removed' --
    // both 'match-removed' AND 'team-removed' are missing from the local tournament.
    matchEventsSelectInMock.mockResolvedValue({ data: [{ match_id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    // 'team-removed' is referenced by the protected match -- must survive, or the FK
    // (ON DELETE SET NULL) would silently null out team_a_id on the match that was "kept".
    expect(teamsDeleteMock).not.toHaveBeenCalled();
    expect(teamsUpsertMock).toHaveBeenCalledTimes(1); // rest of the save still completes
  });

  it('I1 order: match_events is queried (the A6 check) before the tournament row is written', async () => {
    const callOrder: string[] = [];
    matchEventsSelectInMock.mockImplementation(async () => {
      callOrder.push('match_events');
      return { data: [], error: null };
    });
    tournamentsUpsertMock.mockImplementation(async () => {
      callOrder.push('tournaments');
      return { error: null };
    });
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(callOrder[0]).toBe('match_events');
    expect(callOrder).toContain('tournaments');
  });

  it('a match-to-delete with NO events and match_status "scheduled" is deleted as before', async () => {
    matchEventsSelectInMock.mockResolvedValue({ data: [], error: null });
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(matchesDeleteMock).toHaveBeenCalledTimes(1);
    expect(matchEventsSelectInMock).toHaveBeenCalledWith('match_id', ['match-removed']);
    expect(notifyMatchesProtectedMock).not.toHaveBeenCalled();
  });

  it('a match-to-delete with match_status NULL and no events is still deleted (treated like "scheduled")', async () => {
    matchesSelectEqMock.mockResolvedValue({
      data: [
        { id: 'match-survivor', match_status: 'scheduled', match_number: 1, team_a_id: TEAM_SURVIVOR, team_b_id: null },
        { id: 'match-removed', match_status: null, match_number: 2, team_a_id: null, team_b_id: null },
      ],
      error: null,
    });
    matchEventsSelectInMock.mockResolvedValue({ data: [], error: null });
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(matchesDeleteMock).toHaveBeenCalledTimes(1);
    expect(notifyMatchesProtectedMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
// A2 (task-A2-brief.md): full save must never overwrite a helper's live match
// ============================================================================

describe('SupabaseRepository.save() — A2: existing matches update ONLY schedule columns', () => {
  it('an EXISTING match is inserted via the schedule-only update, not the full-row upsert', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

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
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(matchesUpdateMock).not.toHaveBeenCalled();
    expect(matchesUpsertMock).toHaveBeenCalledTimes(1);

    const insertedRows = matchesUpsertMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(insertedRows).toHaveLength(1);
    // The new row keeps its full shape (live columns included, default 'scheduled').
    expect(insertedRows[0]).toHaveProperty('score_a');
    expect(insertedRows[0]).toHaveProperty('match_status', 'scheduled');
  });

  it('the schedule-only update scopes to the correct match AND tournament id', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });

    const repo = new SupabaseRepository();
    const tournament = makeTournamentWithOneTeamAndMatch();
    await expect(repo.save(tournament)).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(matchesUpdateMock).toHaveBeenCalledTimes(1);
    expect(matchesUpdateEqTournamentMock).toHaveBeenCalledWith('tournament_id', tournament.id);
  });

  // A2 Fixrunde 1 (M3): a silently RLS-filtered 0-row update must throw, not be treated as
  // success -- same reasoning as the R5-H1 delete-count check for teams/matches above.
  it('throws when the schedule-only update silently affects 0 rows (RLS-filtered, no Postgres error)', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });
    matchesUpdateSelectMock.mockResolvedValue({ data: [], error: null }); // 0 of 1 expected

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(
      /0 rows updated \(expected 1, got 0\)/
    );
  });

  it('multiple existing matches are updated CONCURRENTLY (Promise.all), not one-at-a-time (I3)', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR }], error: null });
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
      [createTeamRow({ id: TEAM_SURVIVOR, name: 'Survivor' })],
      [
        survivorMatchRow('match-survivor'),
        survivorMatchRow('match-survivor-2'),
      ]
    );

    const repo = new SupabaseRepository();
    await expect(repo.save(tournament)).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(matchesUpdateMock).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(2);
  });
});

// ============================================================================================
// C3a-2b Fixrunde 1 (I1): a failed read of the existing matches must abort save() -- treating it
// as "no matches exist" would classify every match as NEW and re-insert it with neutral values.
// ============================================================================================

describe('SupabaseRepository.save() — C3a-2b I1: read error and insert safety', () => {
  it('a failing select of existing matches makes save() throw before anything is written', async () => {
    matchesSelectEqMock.mockResolvedValue({ data: null, error: { message: 'boom-read' } });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).rejects.toThrow(/boom-read/);

    expect(tournamentsUpsertMock).not.toHaveBeenCalled();
    expect(teamsUpsertMock).not.toHaveBeenCalled();
    expect(teamsDeleteMock).not.toHaveBeenCalled();
    expect(matchesDeleteMock).not.toHaveBeenCalled();
    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpdateMock).not.toHaveBeenCalled();
  });

  it('inserting new matches uses ON CONFLICT DO NOTHING (never overwrites an existing row)', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [], error: null });

    const repo = new SupabaseRepository();
    await repo.save(makeTournamentWithOneTeamAndMatch());

    expect(matchesUpsertMock).toHaveBeenCalledTimes(1);
    expect(matchesUpsertMock.mock.calls[0][1]).toEqual({ onConflict: 'id', ignoreDuplicates: true });
  });
});

// ============================================================================================
// A-02 (MVP-Bauplan Spur A, GA1; V-TEAM-Review I6 + C2): Reihenfolge Teams vor Spielen, und ein
// Voll-Speichern aus veraltetem lokalem Stand setzt eine in der Cloud aufgelöste Seite nicht zurück.
// ============================================================================================

describe('SupabaseRepository.save() — A-02: Reihenfolge und aufgelöste Seiten', () => {
  it('I6: Teams upsert → Spiele löschen → Spiele schreiben → Teams löschen', async () => {
    const order: string[] = [];
    teamsUpsertMock.mockImplementation(async () => { order.push('teams.upsert'); return { error: null }; });
    matchesDeleteSelectMock.mockImplementation(async () => {
      order.push('matches.delete');
      return { data: [{ id: 'match-removed' }], error: null };
    });
    matchesUpdateSelectMock.mockImplementation(async () => {
      order.push('matches.update');
      return { data: [{ id: 'match-survivor' }], error: null };
    });
    teamsDeleteSelectMock.mockImplementation(async () => {
      order.push('teams.delete');
      return { data: [{ id: 'team-removed' }], error: null };
    });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(order).toEqual(['teams.upsert', 'matches.delete', 'matches.update', 'teams.delete']);
  });

  it('I6: ein neues Spiel wird eingefügt, bevor ein Team gelöscht wird', async () => {
    const order: string[] = [];
    matchesSelectEqMock.mockResolvedValue({
      data: [{ id: 'match-removed', match_status: 'scheduled', match_number: 2, team_a_id: 'team-removed', team_b_id: null }],
      error: null,
    });
    matchesUpsertMock.mockImplementation(async () => { order.push('matches.insert'); return { error: null }; });
    matchesDeleteSelectMock.mockResolvedValue({ data: [{ id: 'match-removed' }], error: null });
    teamsDeleteSelectMock.mockImplementation(async () => {
      order.push('teams.delete');
      return { data: [{ id: 'team-removed' }], error: null };
    });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(order).toEqual(['matches.insert', 'teams.delete']);
  });

  it('@TM-027 Gegenbeispiel: lokal offenes Finale überschreibt die in der Cloud aufgelöste Heimseite nicht', async () => {
    const resolvedElsewhere = testUuid(7);
    const finalRow = createMatchRow({
      id: 'match-final',
      team_a_id: null,
      slot_a_source: { kind: 'matchResult', matchId: testUuid(500), role: 'winner' },
      team_b_id: TEAM_SURVIVOR,
    });
    const staleLocal = mapTournamentFromSupabase(
      createTournamentRow({ version: null }),
      [createTeamRow({ id: TEAM_SURVIVOR, name: 'Survivor' })],
      [finalRow]
    );
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR }], error: null });
    matchesSelectEqMock.mockResolvedValue({
      data: [{ id: 'match-final', match_status: 'scheduled', match_number: 9, team_a_id: resolvedElsewhere, team_b_id: TEAM_SURVIVOR }],
      error: null,
    });
    matchesUpdateSelectMock.mockResolvedValue({ data: [{ id: 'match-final' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(staleLocal)).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    const payload = matchesUpdateMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('team_a_id');
    expect(payload).not.toHaveProperty('slot_a_source');
    expect(payload).toHaveProperty('team_b_id', TEAM_SURVIVOR);
  });

  it('@TM-027 lokal offenes Finale, Cloud ebenfalls offen → Herkunft wird mitgeschrieben', async () => {
    const source = { kind: 'matchResult', matchId: testUuid(500), role: 'winner' };
    const local = mapTournamentFromSupabase(
      createTournamentRow({ version: null }),
      [createTeamRow({ id: TEAM_SURVIVOR, name: 'Survivor' })],
      [createMatchRow({ id: 'match-final', team_a_id: null, slot_a_source: source, team_b_id: TEAM_SURVIVOR })]
    );
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR }], error: null });
    matchesSelectEqMock.mockResolvedValue({
      data: [{ id: 'match-final', match_status: 'scheduled', match_number: 9, team_a_id: null, team_b_id: TEAM_SURVIVOR }],
      error: null,
    });
    matchesUpdateSelectMock.mockResolvedValue({ data: [{ id: 'match-final' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(local)).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    const payload = matchesUpdateMock.mock.calls[0][0];
    expect(payload).toHaveProperty('team_a_id', null);
    expect(payload).toHaveProperty('slot_a_source', source);
  });
});

// ============================================================================================
// A-02 Fixrunde 1 (Review I3): Teams werden VOR den Spielen upserted (I6) und erst danach gelöscht.
// Wird ein Team entfernt und ein neues mit GLEICHEM Namen angelegt, kollidierte der Upsert mit der
// noch vorhandenen Zeile (teams UNIQUE(tournament_id, name), 23505) -- die SAVE_TOURNAMENT-Mutation
// hinge dauerhaft. Fix: die zu löschenden Teams mit Namenskollision zuerst umbenennen.
// ============================================================================================

describe('SupabaseRepository.save() — A-02 Fixrunde 1: gleichnamiges Ersatzteam', () => {
  const NEW_TEAM = testUuid(9);

  function tournamentWithReplacement(): Tournament {
    return mapTournamentFromSupabase(
      createTournamentRow({ version: null }),
      [createTeamRow({ id: TEAM_SURVIVOR, name: 'Survivor' }), createTeamRow({ id: NEW_TEAM, name: 'FC Nord' })],
      [survivorMatchRow('match-survivor')]
    );
  }

  it('Team entfernt + gleichnamiges neu: altes Team erst umbenannt, dann Upsert, am Ende gelöscht (kein 23505)', async () => {
    const order: string[] = [];
    teamsSelectEqMock.mockResolvedValue({
      data: [{ id: TEAM_SURVIVOR, name: 'Survivor' }, { id: 'team-removed', name: 'FC Nord' }],
      error: null,
    });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });
    teamsUpdateSelectMock.mockImplementation(async () => { order.push('teams.rename'); return { data: [{ id: 'team-removed' }], error: null }; });
    teamsUpsertMock.mockImplementation(async () => { order.push('teams.upsert'); return { error: null }; });
    teamsDeleteSelectMock.mockImplementation(async () => { order.push('teams.delete'); return { data: [{ id: 'team-removed' }], error: null }; });

    const repo = new SupabaseRepository();
    await expect(repo.save(tournamentWithReplacement())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(order).toEqual(['teams.rename', 'teams.upsert', 'teams.delete']);
    expect(teamsUpdateMock).toHaveBeenCalledTimes(1);
    const renamed = teamsUpdateMock.mock.calls[0][0];
    expect(renamed.name).not.toBe('FC Nord');
    expect(String(renamed.name)).toMatch(/^FC Nord /);
    expect(teamsUpdateEqMock).toHaveBeenCalledWith('id', 'team-removed');
  });

  it('Gegenbeispiel: ein zu löschendes Team ohne Namenskollision wird NICHT umbenannt', async () => {
    teamsSelectEqMock.mockResolvedValue({
      data: [{ id: TEAM_SURVIVOR, name: 'Survivor' }, { id: 'team-removed', name: 'SV Süd' }],
      error: null,
    });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: 'team-removed' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(tournamentWithReplacement())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(teamsUpdateMock).not.toHaveBeenCalled();
    expect(teamsDeleteMock).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ein bleibendes Team mit gleichem Namen wird nicht umbenannt (nur zu löschende)', async () => {
    teamsSelectEqMock.mockResolvedValue({ data: [{ id: TEAM_SURVIVOR, name: 'Survivor' }], error: null });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;

    expect(teamsUpdateMock).not.toHaveBeenCalled();
  });

  it('Umbenennen ohne Wirkung (0 Zeilen, z. B. RLS) scheitert laut vor dem Upsert', async () => {
    teamsSelectEqMock.mockResolvedValue({
      data: [{ id: TEAM_SURVIVOR, name: 'Survivor' }, { id: 'team-removed', name: 'FC Nord' }],
      error: null,
    });
    teamsUpdateSelectMock.mockResolvedValue({ data: [], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(tournamentWithReplacement())).rejects.toThrow(/rename/i);
    expect(teamsUpsertMock).not.toHaveBeenCalled();
  });
});

describe('SupabaseRepository.save() — A-05 Fixrunde 1 (@FU-086): Spiel zeigt noch auf ein zu löschendes Team', () => {
  const DOOMED = testUuid(7);

  /** Inkonsistenter Stand: das Team DOOMED ist lokal entfernt, das Spiel zeigt aber noch darauf. */
  function inconsistentTournament(): Tournament {
    return mapTournamentFromSupabase(
      createTournamentRow({ version: null }),
      [createTeamRow({ id: TEAM_SURVIVOR, name: 'Survivor' })],
      [createMatchRow({ id: 'match-doomed', team_a_id: DOOMED, team_b_id: TEAM_SURVIVOR })]
    );
  }

  it('@FU-086 bricht mit TeamStillReferencedError ab, bevor irgendetwas geschrieben wird', async () => {
    teamsSelectEqMock.mockResolvedValue({
      data: [{ id: TEAM_SURVIVOR, name: 'Survivor' }, { id: DOOMED, name: 'FC Nord' }],
      error: null,
    });
    matchesSelectEqMock.mockResolvedValue({ data: [], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.save(inconsistentTournament())).rejects.toBeInstanceOf(TeamStillReferencedError);

    expect(tournamentsUpsertMock).not.toHaveBeenCalled();
    expect(teamsUpsertMock).not.toHaveBeenCalled();
    expect(teamsUpdateMock).not.toHaveBeenCalled();
    expect(teamsDeleteMock).not.toHaveBeenCalled();
    expect(matchesUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpdateMock).not.toHaveBeenCalled();
    expect(matchesDeleteMock).not.toHaveBeenCalled();
  });

  it('@FU-086 der Fehler ist nicht transient (die Warteschlange zählt ihn und legt ihn im Dead-Letter ab)', () => {
    expect(isTransientMutationError(new TeamStillReferencedError('m'))).toBe(false);
  });

  it('@FU-086 Gegenbeispiel: zeigt das Spiel auf ein bleibendes Team und das entfernte Team hat kein Spiel, wird gespeichert', async () => {
    teamsSelectEqMock.mockResolvedValue({
      data: [{ id: TEAM_SURVIVOR, name: 'Survivor' }, { id: DOOMED, name: 'FC Nord' }],
      error: null,
    });
    matchesSelectEqMock.mockResolvedValue({ data: [{ id: 'match-survivor' }], error: null });
    teamsDeleteSelectMock.mockResolvedValue({ data: [{ id: DOOMED }], error: null });

    const consistent = mapTournamentFromSupabase(
      createTournamentRow({ version: null }),
      [createTeamRow({ id: TEAM_SURVIVOR, name: 'Survivor' })],
      [survivorMatchRow('match-survivor')]
    );
    await expect(new SupabaseRepository().save(consistent)).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;
    expect(teamsDeleteMock).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================================
// A-06a (MVP-Bauplan, Brief A1b): Netzfehler bei auth.getUser() ist vorübergehend, nicht
// dauerhaft — auth-js liefert dafür { user: null, error: AuthRetryableFetchError }.
// Szenarien: @FU-013, @FU-016, @FU-009.
// ============================================================================================

describe('SupabaseRepository.save() — erreichte Version (@FU-110, Befund C-VERSION-NACH-ERSTANLAGE)', () => {
  const mitVersion = (version: number): Tournament => ({ ...makeTournamentWithOneTeamAndMatch(), version });

  it('@FU-110 bestehende Zeile auf Version 7: save() liefert 8 (die Zeile trägt danach 8)', async () => {
    tournamentsUpdateSelectMock.mockResolvedValue({ data: [{ id: 't' }], error: null });
    const repo = new SupabaseRepository();

    await expect(repo.save(mitVersion(7))).resolves.toBe(8);
    expect(tournamentsUpdateMock.mock.calls[0][0]).toMatchObject({ version: 8 });
    expect(tournamentsInsertMock).not.toHaveBeenCalled();
  });

  it('@FU-110 Erstanlage: die Zeile fehlt noch (ohne Netz angelegt, lokal schon Version 2) – save() legt mit 1 an und liefert 1, nicht 3', async () => {
    tournamentsUpdateSelectMock.mockResolvedValue({ data: [], error: null });
    tournamentsExistingSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    tournamentsInsertMock.mockResolvedValue({ error: null });
    const repo = new SupabaseRepository();

    await expect(repo.save(mitVersion(2))).resolves.toBe(1);
    expect(tournamentsInsertMock.mock.calls[0][0]).toMatchObject({ version: 1 });
  });

  it('Upsert ohne Version (neues Turnier aus dem Assistenten): save() schreibt Version 1 und liefert genau 1', async () => {
    const repo = new SupabaseRepository();

    await expect(repo.save(makeTournamentWithOneTeamAndMatch())).resolves.toBe(1);
    expect(tournamentsUpsertMock.mock.calls[0][0]).toMatchObject({ version: 1 });
    expect(tournamentsUpdateMock).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: die Zeile trägt inzwischen eine andere Version – save() wirft OptimisticLockError, keine Version', async () => {
    tournamentsUpdateSelectMock.mockResolvedValue({ data: [], error: null });
    tournamentsExistingSingleMock.mockResolvedValue({ data: { id: 't' }, error: null });
    const repo = new SupabaseRepository();

    await expect(repo.save(mitVersion(7))).rejects.toBeInstanceOf(OptimisticLockError);
    expect(tournamentsInsertMock).not.toHaveBeenCalled();
  });
});

describe('SupabaseRepository.save() — A-06a A1b: Netzfehler bei auth.getUser()', () => {
  it("@FU-009 A1b Test 1: 'Failed to fetch' (AuthRetryableFetchError) → RepositoryError, transient, kein from(...)-Aufruf", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 }),
    });

    const err = await new SupabaseRepository()
      .save(makeTournamentWithOneTeamAndMatch())
      .catch((e: unknown): unknown => e);

    expect(err).toBeInstanceOf(RepositoryError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('Failed to fetch');
    expect(isTransientMutationError(err)).toBe(true);
    expect(hoisted.fromMock).not.toHaveBeenCalled();
  });

  it("@FU-009 A1b Test 2: 'Load failed' (Safari) → RepositoryError, transient", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('Load failed'), { name: 'AuthRetryableFetchError', status: 0 }),
    });

    const err = await new SupabaseRepository()
      .save(makeTournamentWithOneTeamAndMatch())
      .catch((e: unknown): unknown => e);

    expect(err).toBeInstanceOf(RepositoryError);
    expect(isTransientMutationError(err)).toBe(true);
    expect(hoisted.fromMock).not.toHaveBeenCalled();
  });

  it('@FU-009 A1b Gegenbeispiel: user null OHNE error (abgemeldet) → AuthenticationError, permanent', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    const err = await new SupabaseRepository()
      .save(makeTournamentWithOneTeamAndMatch())
      .catch((e: unknown): unknown => e);

    expect(err).toBeInstanceOf(AuthenticationError);
    expect(isTransientMutationError(err)).toBe(false);
  });

  it('@FU-016 A1b Gegenbeispiel: AuthSessionMissingError (abgemeldet) → AuthenticationError, permanent', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('Auth session missing'), { name: 'AuthSessionMissingError' }),
    });

    const err = await new SupabaseRepository()
      .save(makeTournamentWithOneTeamAndMatch())
      .catch((e: unknown): unknown => e);

    expect(err).toBeInstanceOf(AuthenticationError);
    expect(isTransientMutationError(err)).toBe(false);
  });

  it("@FU-013 A1b Gegenbeispiel: AuthApiError 401 ('invalid JWT') bleibt permanent", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('invalid JWT'), { name: 'AuthApiError', status: 401 }),
    });

    const err = await new SupabaseRepository()
      .save(makeTournamentWithOneTeamAndMatch())
      .catch((e: unknown): unknown => e);

    expect(err).toBeInstanceOf(RepositoryError);
    expect(isTransientMutationError(err)).toBe(false);
  });
});

// ============================================================================================
// BP-1 – Befund C-WARTESCHLANGE-LEGT-GELOESCHTES-NEU-AN, Szenarien @FU-123 (Grundriss) und @FU-124 (Gegenbeispiel).
// @FU-123: war der „Wintercup“ in der Cloud und ist inzwischen endgültig gelöscht, legt eine alte wartende Änderung ihn
// nicht neu an. @FU-124: ein Turnier, das noch nie in der Cloud war, wird bei der ersten Übertragung angelegt.
// `mustExist` sagt save(), dass das Gerät das Turnier aus der Cloud kennt (Warteschlange: Merkmal der lokalen Kopie).
// ============================================================================================

describe('SupabaseRepository.save() — endgültig gelöschtes Turnier (@FU-123, @FU-124, Befund C-WARTESCHLANGE-LEGT-GELOESCHTES-NEU-AN)', () => {
  const wintercup = (version: number | undefined): Tournament => ({ ...makeTournamentWithOneTeamAndMatch(), version });

  it('@FU-123 Zeile endgültig gelöscht, Änderung mit Version: kein INSERT, eindeutige Ablehnung „Turnier gibt es nicht mehr“', async () => {
    tournamentsUpdateSelectMock.mockResolvedValue({ data: [], error: null });
    tournamentsExistingSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    tournamentsInsertMock.mockResolvedValue({ error: null });
    const repo = new SupabaseRepository();

    const result = repo.save(wintercup(7), { mustExist: true });

    await expect(result).rejects.toBeInstanceOf(TournamentGoneError);
    await expect(result.catch((e: unknown) => definitiveRejectionReason(e))).resolves.toBe('tournamentGone');
    expect(tournamentsInsertMock).not.toHaveBeenCalled();
    expect(tournamentsUpsertMock).not.toHaveBeenCalled();
    expect(teamsUpsertMock).not.toHaveBeenCalled();
    expect(matchesUpsertMock).not.toHaveBeenCalled();
  });

  it('@FU-123 Zeile endgültig gelöscht, Änderung ohne Version (Zeile trug keine Version): kein Upsert', async () => {
    tournamentsExistingSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    const repo = new SupabaseRepository();

    await expect(repo.save(wintercup(undefined), { mustExist: true })).rejects.toBeInstanceOf(TournamentGoneError);
    expect(tournamentsUpsertMock).not.toHaveBeenCalled();
    expect(tournamentsInsertMock).not.toHaveBeenCalled();
  });

  it('@FU-123 Gegenprobe: das Turnier gibt es noch (ohne Version) – gespeichert wie bisher', async () => {
    tournamentsExistingSingleMock.mockResolvedValue({ data: { id: 't' }, error: null });
    const repo = new SupabaseRepository();

    await expect(repo.save(wintercup(undefined), { mustExist: true })).resolves.toBe(1);
    expect(tournamentsUpsertMock).toHaveBeenCalledTimes(1);
  });

  it('@FU-123 @FU-127 Gegenbeispiel: Netzfehler bei der Prüfung „gibt es das Turnier noch?“ (mit Version) ist unklar, nicht „gibt es nicht mehr“', async () => {
    tournamentsUpdateSelectMock.mockResolvedValue({ data: [], error: null });
    tournamentsExistingSingleMock.mockResolvedValue({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } });
    const repo = new SupabaseRepository();

    const error: unknown = await repo.save(wintercup(7), { mustExist: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect(definitiveRejectionReason(error)).toBeNull();
    expect(isTransientMutationError(error)).toBe(true); // wird wiederholt (@FU-127)
    expect(tournamentsInsertMock).not.toHaveBeenCalled();
  });

  it('@FU-123 @FU-009 Gegenbeispiel: abgelaufene Anmeldung (PGRST301) bei der Prüfung ohne Version hält an, nicht „gibt es nicht mehr“', async () => {
    tournamentsExistingSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null } });
    const repo = new SupabaseRepository();

    const error: unknown = await repo.save(wintercup(undefined), { mustExist: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect(definitiveRejectionReason(error)).toBeNull();
    expect(isAuthExpired(error)).toBe(true); // Warteschlange hält an (@FU-009)
    expect(tournamentsUpsertMock).not.toHaveBeenCalled();
  });

  it('@FU-124 Gegenbeispiel: noch nie in der Cloud (lokal schon zweimal gespeichert, Version 2) – erste Übertragung legt an', async () => {
    tournamentsUpdateSelectMock.mockResolvedValue({ data: [], error: null });
    tournamentsExistingSingleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    tournamentsInsertMock.mockResolvedValue({ error: null });
    const repo = new SupabaseRepository();

    await expect(repo.save(wintercup(2), { mustExist: false })).resolves.toBe(1);
    expect(tournamentsInsertMock).toHaveBeenCalledTimes(1);
  });
});
