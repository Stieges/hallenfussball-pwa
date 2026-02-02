import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MutationQueue } from '../MutationQueue';
import type { MutationItem, FailedMutationItem } from '../MutationQueue';

// =============================================================================
// Mocks
// =============================================================================

// Mock safeStorage
const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
  },
}));

// Mock sentry
vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

// Mock idGenerator
let idCounter = 0;
vi.mock('../../../utils/idGenerator', () => ({
  generateUniqueId: vi.fn(() => `mock-id-${++idCounter}`),
}));

// Mock SupabaseRepository
function createMockRepo() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    updateMatch: vi.fn().mockResolvedValue(undefined),
    updateMatches: vi.fn().mockResolvedValue(undefined),
    updateTournamentMetadata: vi.fn().mockResolvedValue(undefined),
    // Other methods not used by MutationQueue
    get: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
  };
}

// =============================================================================
// Setup
// =============================================================================

let mockRepo: ReturnType<typeof createMockRepo>;
let onlineSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockStorage.clear();
  idCounter = 0;
  mockRepo = createMockRepo();
  // Default: navigator.onLine = true
  onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

// Helper to create a queue without auto-processing
function createQueue(opts?: { online?: boolean; preloadQueue?: MutationItem[]; preloadFailed?: FailedMutationItem[] }) {
  if (opts?.online === false) {
    onlineSpy.mockReturnValue(false);
  }
  if (opts?.preloadQueue) {
    mockStorage.set('mutation_queue_v1', JSON.stringify(opts.preloadQueue));
  }
  if (opts?.preloadFailed) {
    mockStorage.set('mutation_queue_failed_v1', JSON.stringify(opts.preloadFailed));
  }
   
  return new MutationQueue(mockRepo as any);
}

// =============================================================================
// Constructor & Loading
// =============================================================================

describe('MutationQueue constructor', () => {
  it('initializes with empty queue', () => {
    const queue = createQueue({ online: false });
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(0);
  });

  it('loads existing queue from localStorage', () => {
    const items: MutationItem[] = [
      { id: 'item-1', type: 'SAVE_TOURNAMENT', payload: { id: 't1' }, timestamp: 1000, retryCount: 0 },
    ];
    const queue = createQueue({ online: false, preloadQueue: items });
    expect(queue.getPendingCount()).toBe(1);
  });

  it('loads failed queue from localStorage', () => {
    const items: FailedMutationItem[] = [
      { id: 'f1', type: 'SAVE_TOURNAMENT', payload: { id: 't1' }, timestamp: 1000, retryCount: 5, failedAt: 2000, lastError: 'test' },
    ];
    const queue = createQueue({ online: false, preloadFailed: items });
    expect(queue.getFailedCount()).toBe(1);
  });

  it('handles corrupted localStorage gracefully', () => {
    mockStorage.set('mutation_queue_v1', 'not-valid-json');
    const queue = createQueue({ online: false });
    expect(queue.getPendingCount()).toBe(0);
  });
});

// =============================================================================
// enqueue
// =============================================================================

describe('MutationQueue enqueue', () => {
  it('adds item to queue and persists', () => {
    const queue = createQueue({ online: false });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1', title: 'Test' });

    expect(queue.getPendingCount()).toBe(1);
    // Check localStorage was updated
    const stored = JSON.parse(mockStorage.get('mutation_queue_v1') ?? '[]') as MutationItem[];
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe('SAVE_TOURNAMENT');
  });

  it('triggers process when online', async () => {
    const queue = createQueue({ online: true });
    queue.enqueue('DELETE_TOURNAMENT', 'tour-123');

    // Wait for async processing
    await vi.waitFor(() => {
      expect(mockRepo.delete).toHaveBeenCalledWith('tour-123');
    });
  });

  it('does not trigger process when offline', () => {
    const queue = createQueue({ online: false });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(1);
  });
});

// =============================================================================
// Coalescing
// =============================================================================

describe('MutationQueue coalescing', () => {
  it('coalesces SAVE_TOURNAMENT with same ID', () => {
    const queue = createQueue({ online: false });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1', title: 'Version 1' });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1', title: 'Version 2' });

    expect(queue.getPendingCount()).toBe(1);
    const stored = JSON.parse(mockStorage.get('mutation_queue_v1') ?? '[]') as MutationItem[];
    expect(stored[0].payload.title).toBe('Version 2');
  });

  it('coalesces UPDATE_TOURNAMENT_METADATA with same ID', () => {
    const queue = createQueue({ online: false });
    queue.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: 't1', metadata: { title: 'V1' } });
    queue.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: 't1', metadata: { title: 'V2' } });

    expect(queue.getPendingCount()).toBe(1);
  });

  it('does NOT coalesce DELETE_TOURNAMENT', () => {
    const queue = createQueue({ online: false });
    queue.enqueue('DELETE_TOURNAMENT', 'tour-1');
    queue.enqueue('DELETE_TOURNAMENT', 'tour-1');

    expect(queue.getPendingCount()).toBe(2);
  });

  it('does NOT coalesce UPDATE_MATCH', () => {
    const queue = createQueue({ online: false });
    queue.enqueue('UPDATE_MATCH', { tournamentId: 't1', update: { matchId: 'm1' } });
    queue.enqueue('UPDATE_MATCH', { tournamentId: 't1', update: { matchId: 'm1' } });

    expect(queue.getPendingCount()).toBe(2);
  });

  it('does not coalesce SAVE_TOURNAMENT with different IDs', () => {
    const queue = createQueue({ online: false });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1', title: 'A' });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't2', title: 'B' });

    expect(queue.getPendingCount()).toBe(2);
  });
});

// =============================================================================
// process
// =============================================================================

describe('MutationQueue process', () => {
  it('processes items sequentially via executeMutation', async () => {
    const queue = createQueue({ online: false });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });
    queue.enqueue('DELETE_TOURNAMENT', 'tour-2');

    // Go online and process
    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(mockRepo.save).toHaveBeenCalledWith({ id: 't1' });
    expect(mockRepo.delete).toHaveBeenCalledWith('tour-2');
    expect(queue.getPendingCount()).toBe(0);
  });

  it('calls correct repo method for UPDATE_MATCH', async () => {
    const queue = createQueue({ online: false });
    const payload = { tournamentId: 't1', update: { matchId: 'm1', scoreA: 1 } };
    queue.enqueue('UPDATE_MATCH', payload);

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(mockRepo.updateMatch).toHaveBeenCalledWith('t1', { matchId: 'm1', scoreA: 1 });
  });

  it('calls correct repo method for UPDATE_MATCHES', async () => {
    const queue = createQueue({ online: false });
    const payload = { tournamentId: 't1', updates: [{ matchId: 'm1' }, { matchId: 'm2' }] };
    queue.enqueue('UPDATE_MATCHES', payload);

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(mockRepo.updateMatches).toHaveBeenCalledWith('t1', [{ matchId: 'm1' }, { matchId: 'm2' }]);
  });

  it('calls correct repo method for UPDATE_TOURNAMENT_METADATA', async () => {
    const queue = createQueue({ online: false });
    const payload = { tournamentId: 't1', metadata: { title: 'New Title' } };
    queue.enqueue('UPDATE_TOURNAMENT_METADATA', payload);

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(mockRepo.updateTournamentMetadata).toHaveBeenCalledWith('t1', { title: 'New Title' });
  });

  it('skips processing when offline', async () => {
    const queue = createQueue({ online: false });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });

    await queue.process();
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(1);
  });

  it('stops processing when queue is empty', async () => {
    const queue = createQueue({ online: true });
    // No items enqueued
    await queue.process();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Error handling & Dead Letter
// =============================================================================

describe('MutationQueue error handling', () => {
  it('increments retryCount on failure and stops processing', async () => {
    const queue = createQueue({ online: false });
    queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });

    mockRepo.save.mockRejectedValueOnce(new Error('network'));
    onlineSpy.mockReturnValue(true);
    await queue.process();

    // Item stays in queue with incremented retry count
    expect(queue.getPendingCount()).toBe(1);
    const stored = JSON.parse(mockStorage.get('mutation_queue_v1') ?? '[]') as MutationItem[];
    expect(stored[0].retryCount).toBe(1);
  });

  it('moves to dead-letter after MAX_RETRIES (5)', async () => {
    const items: MutationItem[] = [
      { id: 'item-1', type: 'SAVE_TOURNAMENT', payload: { id: 't1' }, timestamp: 1000, retryCount: 4 },
    ];
    const queue = createQueue({ online: false, preloadQueue: items });

    mockRepo.save.mockRejectedValueOnce(new Error('permanent'));
    onlineSpy.mockReturnValue(true);
    await queue.process();

    // Moved from pending to failed
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(1);
    const failed = queue.getFailedMutations();
    expect(failed[0].lastError).toBe('permanent');
  });
});

// =============================================================================
// Dead Letter Queue management
// =============================================================================

describe('MutationQueue dead letter management', () => {
  const failedItem: FailedMutationItem = {
    id: 'f1',
    type: 'SAVE_TOURNAMENT',
    payload: { id: 't1' },
    timestamp: 1000,
    retryCount: 5,
    failedAt: 2000,
    lastError: 'test error',
  };

  it('getFailedMutations returns a copy', () => {
    const queue = createQueue({ online: false, preloadFailed: [failedItem] });
    const failed = queue.getFailedMutations();
    expect(failed).toHaveLength(1);
    // Mutating the returned array should not affect internal state
    failed.pop();
    expect(queue.getFailedCount()).toBe(1);
  });

  it('retryFailedMutation moves item back to queue', () => {
    const queue = createQueue({ online: false, preloadFailed: [failedItem] });
    const result = queue.retryFailedMutation('f1');

    expect(result).toBe(true);
    expect(queue.getFailedCount()).toBe(0);
    expect(queue.getPendingCount()).toBe(1);
  });

  it('retryFailedMutation returns false for unknown id', () => {
    const queue = createQueue({ online: false, preloadFailed: [failedItem] });
    expect(queue.retryFailedMutation('unknown')).toBe(false);
  });

  it('retryAllFailed moves all items back', () => {
    const items: FailedMutationItem[] = [
      { ...failedItem, id: 'f1' },
      { ...failedItem, id: 'f2' },
    ];
    const queue = createQueue({ online: false, preloadFailed: items });
    const count = queue.retryAllFailed();

    expect(count).toBe(2);
    expect(queue.getFailedCount()).toBe(0);
    expect(queue.getPendingCount()).toBe(2);
  });

  it('retryAllFailed returns 0 when nothing failed', () => {
    const queue = createQueue({ online: false });
    expect(queue.retryAllFailed()).toBe(0);
  });

  it('clearFailedMutation removes specific item', () => {
    const queue = createQueue({ online: false, preloadFailed: [failedItem] });
    const result = queue.clearFailedMutation('f1');

    expect(result).toBe(true);
    expect(queue.getFailedCount()).toBe(0);
  });

  it('clearFailedMutation returns false for unknown id', () => {
    const queue = createQueue({ online: false });
    expect(queue.clearFailedMutation('unknown')).toBe(false);
  });

  it('clearAllFailed removes everything', () => {
    const items: FailedMutationItem[] = [
      { ...failedItem, id: 'f1' },
      { ...failedItem, id: 'f2' },
      { ...failedItem, id: 'f3' },
    ];
    const queue = createQueue({ online: false, preloadFailed: items });
    const count = queue.clearAllFailed();

    expect(count).toBe(3);
    expect(queue.getFailedCount()).toBe(0);
  });
});

// =============================================================================
// Subscribe / Unsubscribe
// =============================================================================

describe('MutationQueue subscribe', () => {
  it('notifies listener on enqueue', () => {
    const queue = createQueue({ online: false });
    const listener = vi.fn();
    queue.subscribe(listener);

    queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });
    expect(listener).toHaveBeenCalledWith({ pendingCount: 1, failedCount: 0 });
  });

  it('unsubscribe stops notifications', () => {
    const queue = createQueue({ online: false });
    const listener = vi.fn();
    const unsub = queue.subscribe(listener);
    unsub();

    queue.enqueue('SAVE_TOURNAMENT', { id: 't1' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('getStatus returns current counts', () => {
    const failedItem: FailedMutationItem = {
      id: 'f1', type: 'SAVE_TOURNAMENT', payload: {}, timestamp: 0, retryCount: 5, failedAt: 0,
    };
    const pendingItem: MutationItem = {
      id: 'p1', type: 'DELETE_TOURNAMENT', payload: 'x', timestamp: 0, retryCount: 0,
    };
    const queue = createQueue({ online: false, preloadQueue: [pendingItem], preloadFailed: [failedItem] });

    const status = queue.getStatus();
    expect(status.pendingCount).toBe(1);
    expect(status.failedCount).toBe(1);
  });
});
