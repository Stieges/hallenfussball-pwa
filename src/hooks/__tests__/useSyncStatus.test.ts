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
  const listeners: Listener[] = [];

  const notify = () => {
    const status: MutationQueueStatus = { pendingCount: 0, failedCount: failed.length };
    listeners.forEach((l) => l(status));
  };

  return {
    getStatus: (): MutationQueueStatus => ({ pendingCount: 0, failedCount: failed.length }),
    getFailedMutations: (): FailedMutationItem[] => [...failed],
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
      notify();
      return true;
    }),
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
