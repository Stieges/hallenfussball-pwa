/**
 * SupabaseRepository.updateMatches() — Fixrunde 1 (A4 Review, Risiko 4,
 * `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A4-review.md`)
 *
 * Root cause: `.update(...).eq('id').eq('tournament_id')` ran WITHOUT `.select()` and only
 * evaluated `error`. If RLS (`matches_update_v3`, `has_tournament_permission(...,
 * 'writeMatchData')`) filters the row away, PostgREST returns `error: null` with 0 affected
 * rows -- NOT a Postgres error. The mutation was therefore silently treated as successful even
 * though nothing was written, and never reached the MutationQueue's retry/dead-letter path (so
 * the user never saw it as failed either, defeating the whole point of A4/C-SYNC's failed-list).
 *
 * Fix: same pattern already used by `save()`'s per-match update loop (A2 Fixrunde 1, M3) and by
 * the teams/matches delete-count check (R5-H1) -- add `.select('id')` and treat 0 returned rows
 * as an error. Deliberately ONLY for the `matches` update, NOT for the `tournaments` timestamp
 * update in the same method: a collaborator/helper has `writeMatchData` but not necessarily any
 * write right on `tournaments`, so a 0-row check there would misclassify every helper edit as
 * failed.
 *
 * Both directions, each test RED first (against the pre-fix code, which only checked `error`):
 * a mock that updates 0 match rows must throw; a mock that updates 1 row must succeed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MatchUpdate } from '../../models/types';

// ============================================================================
// MOCKS
// ============================================================================

const hoisted = vi.hoisted(() => {
  // teams: select(id, name).eq(tournament_id) -- team-name -> id mapping, empty is fine here.
  const teamsSelectEqMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const teamsSelectMock = vi.fn(() => ({ eq: teamsSelectEqMock }));

  // matches: update(...).eq('id').eq('tournament_id').select('id') -- the new `.select()`.
  const matchesUpdateSelectMock = vi.fn();
  const matchesUpdateEqTournamentMock = vi.fn(() => ({ select: matchesUpdateSelectMock }));
  const matchesUpdateEqIdMock = vi.fn(() => ({ eq: matchesUpdateEqTournamentMock }));
  const matchesUpdateMock = vi.fn(() => ({ eq: matchesUpdateEqIdMock }));

  // tournaments: update(...).eq('id').select('id') -- unchanged, no .select()-based row check
  // added here (deliberately, see file doc).
  const tournamentsUpdateSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const tournamentsUpdateEqMock = vi.fn(() => ({ select: tournamentsUpdateSelectMock }));
  const tournamentsUpdateMock = vi.fn(() => ({ eq: tournamentsUpdateEqMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === 'teams') {
      return { select: teamsSelectMock };
    }
    if (table === 'matches') {
      return { update: matchesUpdateMock };
    }
    if (table === 'tournaments') {
      return { update: tournamentsUpdateMock };
    }
    throw new Error(`unexpected table in test mock: ${table}`);
  });

  const supabaseMock = { from: fromMock };

  return {
    teamsSelectEqMock,
    matchesUpdateSelectMock,
    matchesUpdateMock,
    matchesUpdateEqIdMock,
    tournamentsUpdateSelectMock,
    supabaseMock,
  };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

import { SupabaseRepository } from '../SupabaseRepository';

describe('SupabaseRepository.updateMatches — 0-Zeilen-Update (Risiko 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.teamsSelectEqMock.mockResolvedValue({ data: [], error: null });
    hoisted.tournamentsUpdateSelectMock.mockResolvedValue({ data: [], error: null });
  });

  const update: MatchUpdate = { id: 'match-1', matchStatus: 'running' };

  it('throws when the match update affects 0 rows (RLS filtered it away, no Postgres error)', async () => {
    hoisted.matchesUpdateSelectMock.mockResolvedValue({ data: [], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.updateMatches('tour-1', [update])).rejects.toThrow(/0 rows updated/);
  });

  it('succeeds when the match update affects exactly 1 row', async () => {
    hoisted.matchesUpdateSelectMock.mockResolvedValue({ data: [{ id: 'match-1' }], error: null });

    const repo = new SupabaseRepository();
    await expect(repo.updateMatches('tour-1', [update])).resolves.toBeUndefined();
  });

  it('still throws (unchanged) on a real Postgres error from the match update', async () => {
    hoisted.matchesUpdateSelectMock.mockResolvedValue({
      data: null,
      error: { message: 'new row for relation "matches" violates check constraint "x"' },
    });

    const repo = new SupabaseRepository();
    await expect(repo.updateMatches('tour-1', [update])).rejects.toThrow(/violates check constraint/);
  });

  it('does NOT treat a 0-row tournaments timestamp update as an error (no baseVersion given)', async () => {
    hoisted.matchesUpdateSelectMock.mockResolvedValue({ data: [{ id: 'match-1' }], error: null });
    hoisted.tournamentsUpdateSelectMock.mockResolvedValue({ data: [], error: null });

    const repo = new SupabaseRepository();
    // A helper without a `tournaments` write right also gets 0 rows there -- must NOT fail the
    // whole mutation, only the `matches` row count is checked (see file doc).
    await expect(repo.updateMatches('tour-1', [update])).resolves.toBeUndefined();
  });

  it('calls .select("id") on the matches update (new call, proves the fix is wired up)', async () => {
    hoisted.matchesUpdateSelectMock.mockResolvedValue({ data: [{ id: 'match-1' }], error: null });

    const repo = new SupabaseRepository();
    await repo.updateMatches('tour-1', [update]);

    expect(hoisted.matchesUpdateSelectMock).toHaveBeenCalledWith('id');
  });
});
