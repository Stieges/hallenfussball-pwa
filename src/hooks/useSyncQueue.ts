/**
 * useSyncQueue - Hook for offline sync queue status and control
 *
 * Part of Phase 1.4: Provides React integration for the SyncService.
 *
 * Features:
 * - Tracks pending mutation count
 * - Tracks sync processing state
 * - Tracks last sync timestamp
 * - Provides manual sync trigger
 * - Tracks failed mutations
 * - Exposes conflict events
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncService, SyncStatus, SyncConflict, SyncQueueResult } from '../core/sync';
import { useOnlineStatus } from './useOnlineStatus';

export interface SyncQueueState {
  /** Number of pending mutations in the queue */
  queueSize: number;
  /** True if sync is currently processing */
  isProcessing: boolean;
  /** Timestamp of last successful sync */
  lastSyncAt: Date | null;
  /** True if device is online */
  isOnline: boolean;
  /** Number of failed mutations */
  failedCount: number;
  /** Active conflicts that need resolution */
  conflicts: SyncConflict[];
}

export interface UseSyncQueueReturn extends SyncQueueState {
  /** Manually trigger queue processing */
  processNow: () => Promise<SyncQueueResult>;
  /** Clear all conflicts (after handling) */
  clearConflicts: () => void;
  /** Retry a specific failed mutation */
  retryMutation: (mutationId: string) => Promise<void>;
  /** Clear all pending mutations (use with caution!) */
  clearQueue: () => Promise<void>;
}

/**
 * Hook to track and control the offline sync queue
 *
 * @example
 * ```tsx
 * const {
 *   queueSize,
 *   isProcessing,
 *   lastSyncAt,
 *   isOnline,
 *   processNow,
 *   conflicts,
 * } = useSyncQueue();
 *
 * if (queueSize > 0) {
 *   return <span>{queueSize} pending changes</span>;
 * }
 * ```
 */
export function useSyncQueue(): UseSyncQueueReturn {
  const { isOnline } = useOnlineStatus();
  const isMounted = useRef(true);

  const [state, setState] = useState<SyncQueueState>({
    queueSize: 0,
    isProcessing: false,
    lastSyncAt: null,
    isOnline,
    failedCount: 0,
    conflicts: [],
  });

  // Subscribe to SyncService events
  useEffect(() => {
    isMounted.current = true;

    // Initial status fetch
    void syncService.getStatus().then((status) => {
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          queueSize: status.pendingCount,
          isProcessing: status.isProcessing,
          lastSyncAt: status.lastSyncAt,
          isOnline: status.isOnline,
        }));
      }
    });

    // Fetch failed count
    void syncService.getFailedMutations().then((failed) => {
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          failedCount: failed.length,
        }));
      }
    });

    // Event handlers
    const handleStatusChange = (status: SyncStatus) => {
      if (!isMounted.current) {
        return;
      }
      setState((prev) => ({
        ...prev,
        queueSize: status.pendingCount,
        isProcessing: status.isProcessing,
        lastSyncAt: status.lastSyncAt,
        isOnline: status.isOnline,
      }));
    };

    const handleConflict = (conflict: SyncConflict) => {
      if (!isMounted.current) {
        return;
      }
      setState((prev) => ({
        ...prev,
        conflicts: [...prev.conflicts, conflict],
      }));
    };

    const handleSyncComplete = (result: SyncQueueResult) => {
      if (!isMounted.current) {
        return;
      }
      setState((prev) => ({
        ...prev,
        conflicts: [...prev.conflicts, ...result.conflicts],
      }));

      // Refresh failed count
      void syncService.getFailedMutations().then((failed) => {
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            failedCount: failed.length,
          }));
        }
      });
    };

    // Subscribe to events
    syncService.on('statusChange', handleStatusChange);
    syncService.on('conflict', handleConflict);
    syncService.on('syncComplete', handleSyncComplete);

    // Cleanup
    return () => {
      isMounted.current = false;
      syncService.off('statusChange', handleStatusChange);
      syncService.off('conflict', handleConflict);
      syncService.off('syncComplete', handleSyncComplete);
    };
  }, []);

  // Update isOnline from hook when it changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isOnline,
    }));
  }, [isOnline]);

  const processNow = useCallback(async (): Promise<SyncQueueResult> => {
    return syncService.processQueue();
  }, []);

  const clearConflicts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      conflicts: [],
    }));
  }, []);

  const retryMutation = useCallback(async (mutationId: string): Promise<void> => {
    await syncService.retryMutation(mutationId);
  }, []);

  const clearQueue = useCallback(async (): Promise<void> => {
    await syncService.clearQueue();
  }, []);

  return {
    ...state,
    processNow,
    clearConflicts,
    retryMutation,
    clearQueue,
  };
}

export default useSyncQueue;
