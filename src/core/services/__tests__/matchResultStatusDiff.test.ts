/**
 * matchResultStatusDiff.test.ts — A2 Fixrunde 1 (Ruling AJ, I2/C1/I1 in
 * `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md`), REWRITTEN in
 * Fixrunde 3 (N1: `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-rereview.md`) --
 * Fixrunde 1 emitted ALL 14 result/status fields whenever ANY of them changed (sourced from the
 * caller's possibly-stale local state); Fixrunde 3 emits ONLY the fields that actually differ.
 */
import { describe, it, expect } from 'vitest';
import { diffMatchResultStatusUpdates } from '../matchResultStatusDiff';
import type { Match } from '../../models/types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    round: 1,
    field: 1,
    teamA: 'Team A',
    teamB: 'Team B',
    ...overrides,
  };
}

describe('diffMatchResultStatusUpdates', () => {
  it('returns no update when nothing changed', () => {
    const match = makeMatch({ scoreA: 1, scoreB: 0 });
    const updates = diffMatchResultStatusUpdates([match], [match]);
    expect(updates).toEqual([]);
  });

  it('returns no update when only a SCHEDULE field changed (round/field/team/label)', () => {
    const oldMatch = makeMatch({ field: 1, teamA: 'Team A' });
    const newMatch = makeMatch({ field: 2, teamA: 'Team A (umbenannt)' });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);
    expect(updates).toEqual([]);
  });

  // A2 Fixrunde 3 (N1a): the core of the rereview finding -- a changed score must NOT drag along
  // unrelated, unchanged fields from the caller's local state. Runde 1's version of this exact
  // test asserted the opposite ("includes ALL result/status fields") -- that assertion is now the
  // RED case the fix closes.
  it('a changed score includes ONLY scoreA -- not matchStatus, which did not change', () => {
    const oldMatch = makeMatch({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    const newMatch = makeMatch({ scoreA: 2, scoreB: 0, matchStatus: 'running' });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ id: 'match-1', scoreA: 2 });
    expect(updates[0]).not.toHaveProperty('scoreB');
    expect(updates[0]).not.toHaveProperty('matchStatus');
  });

  it('detects a status change (finished) with tiebreaker fields -- and nothing else', () => {
    const oldMatch = makeMatch({ matchStatus: 'running' });
    const newMatch = makeMatch({
      matchStatus: 'finished',
      finishedAt: '2026-01-01T10:00:00Z',
      overtimeScoreA: 1,
      overtimeScoreB: 0,
      penaltyScoreA: 4,
      penaltyScoreB: 3,
      decidedBy: 'penalty',
    });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      id: 'match-1',
      matchStatus: 'finished',
      finishedAt: '2026-01-01T10:00:00Z',
      overtimeScoreA: 1,
      overtimeScoreB: 0,
      penaltyScoreA: 4,
      penaltyScoreB: 3,
      decidedBy: 'penalty',
    });
  });

  it('detects a skip/unskip change (skippedReason/skippedAt)', () => {
    const oldMatch = makeMatch({ matchStatus: 'scheduled' });
    const newMatch = makeMatch({
      matchStatus: 'skipped',
      skippedReason: 'Team not present',
      skippedAt: '2026-01-01T09:00:00Z',
    });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    expect(updates[0].skippedReason).toBe('Team not present');
    expect(updates[0].skippedAt).toBe('2026-01-01T09:00:00Z');
  });

  // A2 Fixrunde 3 (N1b): a cleared field must NOT become NULL for match_status/
  // timer_elapsed_seconds -- same insert defaults as mapMatchToSupabase ('scheduled' / 0).
  it('a RESET clears scoreA/finishedAt to null, but matchStatus to the schedule default \'scheduled\' -- not null', () => {
    const oldMatch = makeMatch({ scoreA: 3, scoreB: 1, matchStatus: 'finished', finishedAt: '2026-01-01T10:00:00Z' });
    const newMatch = makeMatch({ scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled', finishedAt: undefined });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    const update = updates[0];
    expect(update.scoreA).toBeNull();
    expect(update.scoreB).toBeNull();
    expect(update.finishedAt).toBeNull();
    expect(update.matchStatus).toBe('scheduled');
  });

  it('a RESET clears timerElapsedSeconds to the schedule default 0 -- not null', () => {
    const oldMatch = makeMatch({ matchStatus: 'running', timerElapsedSeconds: 600 });
    const newMatch = makeMatch({ matchStatus: 'running', timerElapsedSeconds: undefined });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    expect(updates[0].timerElapsedSeconds).toBe(0);
  });

  // A2 Fixrunde 3 (N2): a cleared field is transported as `null`, never `undefined` -- `undefined`
  // would be dropped entirely by `JSON.stringify` in the offline mutation queue.
  it('a cleared field is `null`, not `undefined` (JSON-round-trip safety, N2)', () => {
    const oldMatch = makeMatch({ skippedReason: 'Team not present', skippedAt: '2026-01-01T09:00:00Z', matchStatus: 'skipped' });
    const newMatch = makeMatch({ skippedReason: undefined, skippedAt: undefined, matchStatus: 'scheduled' });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    const update = updates[0];
    expect('skippedReason' in update).toBe(true);
    expect(update.skippedReason).toBeNull();
    expect('skippedAt' in update).toBe(true);
    expect(update.skippedAt).toBeNull();
    // JSON.stringify would silently drop these if they were `undefined` instead.
    expect(JSON.parse(JSON.stringify(update))).toMatchObject({ skippedReason: null, skippedAt: null });
  });

  it('ignores a match that only exists in newMatches (freshly created, no live state to protect)', () => {
    const newMatch = makeMatch({ id: 'brand-new', scoreA: 1 });
    const updates = diffMatchResultStatusUpdates([], [newMatch]);
    expect(updates).toEqual([]);
  });

  it('diffs multiple matches independently', () => {
    const oldMatches = [makeMatch({ id: 'm1', scoreA: 0 }), makeMatch({ id: 'm2', scoreA: 0 })];
    const newMatches = [makeMatch({ id: 'm1', scoreA: 1 }), makeMatch({ id: 'm2', scoreA: 0 })];
    const updates = diffMatchResultStatusUpdates(oldMatches, newMatches);

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('m1');
  });
});
