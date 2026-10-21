import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncStatus } from '../useSyncStatus';
import type { FailedMutationItem, MutationQueueStatus } from '../../core/services/MutationQueue';

// Task A4 (C-SYNC): useSyncStatus muss gescheiterte Übertragungen (dead-letter queue)
// so exponieren, dass Admin-/Cockpit-Kopf sie anzeigen und einzeln erneut versuchen oder
// verwerfen können — ohne die Queue-Mechanik selbst neu zu bauen (retryFailedMutation /
// clearFailedMutation existieren bereits in GenericMutationQueue).

type Listener = (status: MutationQueueStatus) => void;

function createFakeMutationQueue(initialFailed: FailedMutationItem[] = []) {
  let failed = [...initialFailed];
  let awaiting: string[] = []; // @FU-106: Turniere, die nach „Verwerfen“ auf den Stand des Servers warten
  const listeners: Listener[] = [];

  const notify = () => {
    const status: MutationQueueStatus = { pendingCount: 0, failedCount: failed.length };
    listeners.forEach((l) => l(status));
  };

  return {
    getStatus: (): MutationQueueStatus => ({ pendingCount: 0, failedCount: failed.length }),
    getFailedMutations: (): FailedMutationItem[] => [...failed],
    getLastFailure: (): null => null,
    scopesNeedingCloudCopy: (): string[] => awaiting,
    subscribe: (listener: Listener) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx !== -1) { listeners.splice(idx, 1); }
      };
    },
    retryFailedMutation: vi.fn((id: string) => {
      failed = failed.filter((f) => f.id !== id);
      notify();
      return true;
    }),
    clearFailedMutation: vi.fn((id: string) => {
      failed = failed.filter((f) => f.id !== id);
      awaiting = ['t1'];
      notify();
      return true;
    }),
    /** Der Stand des Servers ist übernommen (Merkung erledigt). */
    adoptServerCopy: () => { awaiting = []; notify(); },
  };
}

const mockRepository: { current: unknown } = { current: null };

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: mockRepository.current }),
}));

vi.mock('../useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true, wasOffline: false }),
}));

describe('useSyncStatus — gescheiterte Übertragungen (C-SYNC)', () => {
  const failedItem: FailedMutationItem = {
    id: 'fail-1',
    type: 'UPDATE_MATCH',
    payload: { tournamentId: 't1', update: { id: 'm1' } },
    timestamp: 1000,
    retryCount: 5,
    failedAt: 2000,
    lastError: 'RLS: keine Berechtigung',
  };

  beforeEach(() => {
    mockRepository.current = null;
  });

  it('exposes an empty failed list when the repository has no mutation queue (e.g. guest)', () => {
    mockRepository.current = {};
    const { result } = renderHook(() => useSyncStatus());
    expect(result.current.failedChanges).toBe(0);
    expect(result.current.failedMutations).toEqual([]);
  });

  it('exposes failed mutations with their reason from the mutation queue', () => {
    const fakeQueue = createFakeMutationQueue([failedItem]);
    mockRepository.current = { mutationQueue: fakeQueue };

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.failedChanges).toBe(1);
    expect(result.current.failedMutations).toHaveLength(1);
    expect(result.current.failedMutations[0].id).toBe('fail-1');
    expect(result.current.failedMutations[0].lastError).toBe('RLS: keine Berechtigung');
  });

  it('retryFailedMutation() delegates to the queue and updates the list', () => {
    const fakeQueue = createFakeMutationQueue([failedItem]);
    mockRepository.current = { mutationQueue: fakeQueue };

    const { result } = renderHook(() => useSyncStatus());

    act(() => {
      result.current.retryFailedMutation('fail-1');
    });

    expect(fakeQueue.retryFailedMutation).toHaveBeenCalledWith('fail-1');
    expect(result.current.failedMutations).toEqual([]);
    expect(result.current.failedChanges).toBe(0);
  });

  it('discardFailedMutation() delegates to the queue and updates the list', () => {
    const fakeQueue = createFakeMutationQueue([failedItem]);
    mockRepository.current = { mutationQueue: fakeQueue };

    const { result } = renderHook(() => useSyncStatus());

    act(() => {
      result.current.discardFailedMutation('fail-1');
    });

    expect(fakeQueue.clearFailedMutation).toHaveBeenCalledWith('fail-1');
    expect(result.current.failedMutations).toEqual([]);
  });

  it('@FU-109 nach dem Verwerfen meldet der Hook, welches Turnier auf den Stand des Servers wartet, bis er übernommen ist', () => {
    const fakeQueue = createFakeMutationQueue([failedItem]);
    mockRepository.current = { mutationQueue: fakeQueue };
    const { result } = renderHook(() => useSyncStatus());
    expect(result.current.awaitingServerCopyIds).toEqual([]);

    act(() => { result.current.discardFailedMutation('fail-1'); });
    expect(result.current.awaitingServerCopyIds).toEqual(['t1']);

    act(() => { fakeQueue.adoptServerCopy(); });
    expect(result.current.awaitingServerCopyIds).toEqual([]);
  });

  it('retry/discard on a repository without a mutation queue is a no-op, not a crash', () => {
    mockRepository.current = {};
    const { result } = renderHook(() => useSyncStatus());

    expect(() => {
      act(() => {
        result.current.retryFailedMutation('does-not-exist');
        result.current.discardFailedMutation('does-not-exist');
      });
    }).not.toThrow();
  });
});

// A-06j (Brief A10): queueLastFailure kommt beim initialen Lesen UND im Listener aus der Queue.
describe('useSyncStatus — queueLastFailure (A-06j)', () => {
  type FailureKind = 'transient' | 'permanent' | null;

  function createQueueWithFailure(initial: FailureKind) {
    let lastFailure: FailureKind = initial;
    const listeners: Listener[] = [];
    return {
      getStatus: (): MutationQueueStatus => ({ pendingCount: 1, failedCount: 0 }),
      getFailedMutations: (): FailedMutationItem[] => [],
      getLastFailure: (): FailureKind => lastFailure,
      scopesNeedingCloudCopy: (): string[] => [],
      subscribe: (listener: Listener) => {
        listeners.push(listener);
        return () => {
          const idx = listeners.indexOf(listener);
          if (idx !== -1) { listeners.splice(idx, 1); }
        };
      },
      retryFailedMutation: vi.fn(() => true),
      clearFailedMutation: vi.fn(() => true),
      setFailureAndNotify: (kind: FailureKind) => {
        lastFailure = kind;
        listeners.forEach((l) => l({ pendingCount: 1, failedCount: 0 }));
      },
    };
  }

  beforeEach(() => {
    mockRepository.current = null;
  });

  it('liefert queueLastFailure beim initialen Lesen aus der Queue', () => {
    mockRepository.current = { mutationQueue: createQueueWithFailure('permanent') };
    const { result } = renderHook(() => useSyncStatus());
    expect(result.current.queueLastFailure).toBe('permanent');
  });

  it('aktualisiert queueLastFailure im Listener, wenn die Queue benachrichtigt', () => {
    const fakeQueue = createQueueWithFailure(null);
    mockRepository.current = { mutationQueue: fakeQueue };
    const { result } = renderHook(() => useSyncStatus());
    expect(result.current.queueLastFailure).toBeNull();

    act(() => {
      fakeQueue.setFailureAndNotify('transient');
    });
    expect(result.current.queueLastFailure).toBe('transient');
  });
});
