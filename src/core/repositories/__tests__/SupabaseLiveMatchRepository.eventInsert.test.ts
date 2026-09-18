/**
 * SupabaseLiveMatchRepository — event insert failure must not be forgotten (Task 2)
 *
 * Root cause: `save()` writes new match_events in one batch insert. If Postgres
 * rejects the whole statement (e.g. CHECK violation because `type` isn't in the
 * allow-list — this used to be true for 'FOUL', see the 2026-09-18 migration),
 * the error was logged but swallowed ("Don't throw - match was updated
 * successfully"), and the loop right after it added ALL of those event ids to
 * `eventIdsCache` unconditionally. The next save() then believed those events
 * were already persisted and never sent them again — a silent, permanent loss.
 *
 * `eventIdsCache` is private, so these tests assert its effect indirectly:
 * calling save() twice with the same LiveMatch and inspecting what the second
 * call actually sends to Postgres.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveMatch } from '../../models/LiveMatch';

// ============================================================================
// MOCKS
// ============================================================================

const hoisted = vi.hoisted(() => {
  const insertMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const eqVersionMock = vi.fn(() => ({ select: selectMock }));
  const eqIdMock = vi.fn(() => ({ eq: eqVersionMock }));
  const updateMock = vi.fn(() => ({ eq: eqIdMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === 'matches') {
      return { update: updateMock };
    }
    if (table === 'match_events') {
      return { insert: insertMock };
    }
    throw new Error(`unexpected table in test mock: ${table}`);
  });

  const supabaseMock = { from: fromMock };

  return { insertMock, maybeSingleMock, selectMock, eqVersionMock, eqIdMock, updateMock, fromMock, supabaseMock };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';
import { captureFeatureError } from '../../../lib/sentry';

const { insertMock, maybeSingleMock } = hoisted;
const captureFeatureErrorMock = vi.mocked(captureFeatureError);

// ============================================================================
// FIXTURES
// ============================================================================

function makeMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm1',
    number: 1,
    phaseLabel: 'Gruppenphase',
    fieldId: 'field-1',
    scheduledKickoff: '2024-01-01T12:00:00.000Z',
    version: 1,
    homeTeam: { id: 'a', name: 'A' },
    awayTeam: { id: 'b', name: 'B' },
    homeScore: 0,
    awayScore: 0,
    status: 'RUNNING',
    elapsedSeconds: 100,
    durationSeconds: 600,
    tournamentPhase: 'groupStage',
    events: [
      {
        id: 'e1',
        matchId: 'm1',
        type: 'FOUL',
        timestampSeconds: 30,
        payload: { team: 'home' },
        scoreAfter: { home: 0, away: 0 },
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('SupabaseLiveMatchRepository — event insert failure (Task 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Match update always "succeeds" (version matches) so the tests exercise
    // only the events-insert branch, not the optimistic-lock retry path.
    maybeSingleMock.mockResolvedValue({ data: { version: 2 }, error: null });
  });

  it('RED-GUARD: insert failure does not cache the ids — a second save() resends the same events', async () => {
    insertMock.mockResolvedValue({ error: { message: 'CHECK violation', code: '23514' } });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch();

    await repo.save('t1', match);
    await repo.save('t1', match);

    expect(insertMock).toHaveBeenCalledTimes(2);
    const firstBatch = insertMock.mock.calls[0][0] as Array<{ id?: string }>;
    const secondBatch = insertMock.mock.calls[1][0] as Array<{ id?: string }>;
    expect(firstBatch.map((e) => e.id)).toEqual(['e1']);
    // This is the load-bearing assertion: if the failed insert had been cached
    // (today's bug), the second save() would send an empty array here.
    expect(secondBatch.map((e) => e.id)).toEqual(['e1']);
  });

  it('insert success caches the ids exactly once — a second save() sends no duplicates', async () => {
    insertMock.mockResolvedValue({ error: null });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch();

    await repo.save('t1', match);
    await repo.save('t1', match);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const firstBatch = insertMock.mock.calls[0][0] as Array<{ id?: string }>;
    expect(firstBatch.map((e) => e.id)).toEqual(['e1']);
  });

  it('insert failure is reported via captureFeatureError', async () => {
    const dbError = { message: 'CHECK violation', code: '23514' };
    insertMock.mockResolvedValue({ error: dbError });

    const repo = new SupabaseLiveMatchRepository();
    const match = makeMatch();

    await repo.save('t1', match);

    expect(captureFeatureErrorMock).toHaveBeenCalledWith(
      dbError,
      'repository',
      'eventsInsert',
      { matchId: 'm1', count: 1 }
    );
  });
});
