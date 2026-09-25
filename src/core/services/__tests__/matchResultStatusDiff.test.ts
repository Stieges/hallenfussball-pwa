/**
 * matchResultStatusDiff.test.ts — A2 Fixrunde 1 (Ruling AJ, I2/C1/I1 in
 * `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md`).
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

  it('detects a changed score and includes ALL result/status fields in the update, not just the diff', () => {
    const oldMatch = makeMatch({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    const newMatch = makeMatch({ scoreA: 2, scoreB: 0, matchStatus: 'running' });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      id: 'match-1',
      scoreA: 2,
      scoreB: 0,
      matchStatus: 'running',
    });
  });

  it('detects a status change (finished) with tiebreaker fields', () => {
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
    expect(updates[0]).toMatchObject({
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

  it('a RESET (result cleared back to undefined) is still reported as a change -- with the fields present as own keys, so the caller can persist the clear', () => {
    const oldMatch = makeMatch({ scoreA: 3, scoreB: 1, matchStatus: 'finished', finishedAt: '2026-01-01T10:00:00Z' });
    const newMatch = makeMatch({ scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled', finishedAt: undefined });
    const updates = diffMatchResultStatusUpdates([oldMatch], [newMatch]);

    expect(updates).toHaveLength(1);
    const update = updates[0];
    expect('scoreA' in update).toBe(true);
    expect(update.scoreA).toBeUndefined();
    expect('finishedAt' in update).toBe(true);
    expect(update.matchStatus).toBe('scheduled');
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
