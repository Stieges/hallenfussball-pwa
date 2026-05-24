import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { MutationQueue, MAX_RETRIES } from '../MutationQueue';
import type { MutationItem } from '../MutationQueue';

// =============================================================================
// Mocks (mirrored from MutationQueue.test.ts)
// =============================================================================

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
  },
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

let idCounter = 0;
vi.mock('../../../utils/idGenerator', () => ({
  generateUniqueId: vi.fn(() => `mock-id-${++idCounter}`),
}));

function createMockRepo() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    updateMatch: vi.fn().mockResolvedValue(undefined),
    updateMatches: vi.fn().mockResolvedValue(undefined),
    updateTournamentMetadata: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  };
}

let mockRepo: ReturnType<typeof createMockRepo>;
let onlineSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockStorage.clear();
  idCounter = 0;
  mockRepo = createMockRepo();
  onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

function createQueue(opts?: { online?: boolean; preloadQueue?: MutationItem[] }) {
  if (opts?.online === false) {
    onlineSpy.mockReturnValue(false);
  }
  if (opts?.preloadQueue) {
    mockStorage.set('mutation_queue_v1', JSON.stringify(opts.preloadQueue));
  }

  return new MutationQueue(mockRepo as any);
}

// =============================================================================
// Property: MAX_RETRIES invariant
// =============================================================================

describe('MutationQueue — MAX_RETRIES invariant (property)', () => {
  it('item lands in dead-letter after exactly MAX_RETRIES failures, never earlier or later', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: MAX_RETRIES + 3 }),
        async (consecutiveFailures) => {
          mockStorage.clear();
          idCounter = 0;
          mockRepo = createMockRepo();
          onlineSpy.mockReturnValue(false);

          const queue = createQueue({ online: false });
          queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });

          for (let i = 0; i < consecutiveFailures; i++) {
            mockRepo.save.mockRejectedValueOnce(new Error(`failure-${i}`));
            onlineSpy.mockReturnValue(true);
            await queue.process();
          }

          if (consecutiveFailures >= MAX_RETRIES) {
            expect(queue.getPendingCount()).toBe(0);
            expect(queue.getFailedCount()).toBe(1);
          } else {
            expect(queue.getPendingCount()).toBe(1);
            expect(queue.getFailedCount()).toBe(0);
            const stored = JSON.parse(
              mockStorage.get('mutation_queue_v1') ?? '[]',
            ) as MutationItem[];
            expect(stored[0].retryCount).toBe(consecutiveFailures);
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it('item recovers from transient failures within retry budget', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: MAX_RETRIES - 1 }),
        async (failuresBeforeSuccess) => {
          mockStorage.clear();
          idCounter = 0;
          mockRepo = createMockRepo();
          onlineSpy.mockReturnValue(false);

          const queue = createQueue({ online: false });
          queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });

          for (let i = 0; i < failuresBeforeSuccess; i++) {
            mockRepo.save.mockRejectedValueOnce(new Error('transient'));
            onlineSpy.mockReturnValue(true);
            await queue.process();
          }
          onlineSpy.mockReturnValue(true);
          await queue.process();

          expect(queue.getPendingCount()).toBe(0);
          expect(queue.getFailedCount()).toBe(0);
          expect(mockRepo.save).toHaveBeenCalledTimes(failuresBeforeSuccess + 1);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// =============================================================================
// Property: FIFO order + no item loss (overflow stress)
// =============================================================================

describe('MutationQueue — FIFO + no-loss invariant (property)', () => {
  it('processes all enqueued non-coalescing items in FIFO order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ tournamentId: fc.string({ minLength: 1, maxLength: 10 }) }),
          { minLength: 1, maxLength: 200 },
        ),
        async (payloads) => {
          mockStorage.clear();
          idCounter = 0;
          mockRepo = createMockRepo();
          onlineSpy.mockReturnValue(true);

          const queue = createQueue({ online: false });
          for (const payload of payloads) {
            queue.enqueue('UPDATE_MATCH', {
              tournamentId: payload.tournamentId,
              update: { id: `m-${payload.tournamentId}` },
            });
          }

          expect(queue.getPendingCount()).toBe(payloads.length);

          onlineSpy.mockReturnValue(true);
          await queue.process();

          expect(queue.getPendingCount()).toBe(0);
          expect(queue.getFailedCount()).toBe(0);
          expect(mockRepo.updateMatch).toHaveBeenCalledTimes(payloads.length);

          for (let i = 0; i < payloads.length; i++) {
            const callArgs = mockRepo.updateMatch.mock.calls[i] as [string, unknown];
            expect(callArgs[0]).toBe(payloads[i].tournamentId);
          }
        },
      ),
      { numRuns: 15 },
    );
  });

  it('survives bulk enqueue of >1000 items without losing any', { timeout: 30_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 2000 }),
        async (count) => {
          mockStorage.clear();
          idCounter = 0;
          mockRepo = createMockRepo();
          onlineSpy.mockReturnValue(false);

          const queue = createQueue({ online: false });
          for (let i = 0; i < count; i++) {
            queue.enqueue('UPDATE_MATCH', {
              tournamentId: `t-${i}`,
              update: { id: `m-${i}` },
            });
          }

          expect(queue.getPendingCount()).toBe(count);

          const stored = JSON.parse(
            mockStorage.get('mutation_queue_v1') ?? '[]',
          ) as MutationItem[];
          expect(stored).toHaveLength(count);
          for (let i = 0; i < count; i++) {
            expect((stored[i].payload as { tournamentId: string }).tournamentId).toBe(`t-${i}`);
          }
        },
      ),
      { numRuns: 3 },
    );
  });
});

// =============================================================================
// Property: Coalescing idempotency for SAVE_TOURNAMENT
// =============================================================================

describe('MutationQueue — Coalescing idempotency (property)', () => {
  it('repeated SAVE_TOURNAMENT for same id collapses to a single pending mutation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 50 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        async (saveCount, tournamentId) => {
          mockStorage.clear();
          idCounter = 0;
          mockRepo = createMockRepo();
          onlineSpy.mockReturnValue(false);

          const queue = createQueue({ online: false });
          for (let i = 0; i < saveCount; i++) {
            queue.enqueue('SAVE_TOURNAMENT', {
              id: tournamentId,
              name: `revision-${i}`,
            });
          }

          expect(queue.getPendingCount()).toBe(1);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('SAVE_TOURNAMENT for distinct ids does not coalesce', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
          minLength: 2,
          maxLength: 20,
        }),
        async (ids) => {
          mockStorage.clear();
          idCounter = 0;
          mockRepo = createMockRepo();
          onlineSpy.mockReturnValue(false);

          const queue = createQueue({ online: false });
          for (const id of ids) {
            queue.enqueue('SAVE_TOURNAMENT', { id, name: 'x' });
          }

          expect(queue.getPendingCount()).toBe(ids.length);
        },
      ),
      { numRuns: 15 },
    );
  });
});
