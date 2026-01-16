/**
 * useSyncConflicts - P0-4 Task 4.2
 *
 * React hook for handling sync conflicts at the application level.
 * Listens for 'conflict' events from SyncService and provides
 * resolution functions for UI components.
 *
 * Usage:
 * ```typescript
 * const { pendingConflict, resolveConflict, dismissConflict } = useSyncConflicts();
 *
 * if (pendingConflict) {
 *   // Show ConflictResolutionDialog
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import { SyncConflict, ConflictResolutionStrategy } from '../../../core/sync/types';
import { syncService } from '../../../core/sync/SyncService';

export interface UseSyncConflictsReturn {
  /** Current pending conflict (null if none) */
  pendingConflict: SyncConflict | null;

  /** Resolve the conflict with chosen strategy */
  resolveConflict: (strategy: ConflictResolutionStrategy) => Promise<void>;

  /** Dismiss conflict without resolving (user cancelled) */
  dismissConflict: () => void;
}

/**
 * Hook for managing sync conflicts
 *
 * Automatically subscribes to SyncService 'conflict' events
 * and provides functions to resolve or dismiss conflicts.
 */
export function useSyncConflicts(): UseSyncConflictsReturn {
  const [pendingConflict, setPendingConflict] = useState<SyncConflict | null>(null);

  useEffect(() => {
    /**
     * Handle conflict event from SyncService
     * Sets pendingConflict state which triggers UI dialog
     */
    const handleConflict = (conflict: SyncConflict) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[useSyncConflicts] Conflict detected:', conflict);
      }
      setPendingConflict(conflict);
    };

    // Subscribe to conflict events
    syncService.on('conflict', handleConflict);

    // Cleanup: Unsubscribe on unmount
    return () => {
      syncService.off('conflict', handleConflict);
    };
  }, []);

  /**
   * Resolve the pending conflict using specified strategy
   * Calls SyncService.resolveConflict and clears pending state
   */
  const resolveConflict = async (strategy: ConflictResolutionStrategy) => {
    if (!pendingConflict) {
      console.warn('[useSyncConflicts] resolveConflict called but no conflict pending');
      return;
    }

    try {
      await syncService.resolveConflict(pendingConflict, strategy);
      setPendingConflict(null); // Clear after successful resolution

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log(`[useSyncConflicts] Conflict resolved with strategy: ${strategy}`);
      }
    } catch (error) {
      console.error('[useSyncConflicts] Failed to resolve conflict:', error);
      // Don't clear pendingConflict on error - let user retry
      throw error;
    }
  };

  /**
   * Dismiss conflict without resolving
   * Used when user closes dialog without making a choice
   * Note: Conflict will re-appear on next sync attempt
   */
  const dismissConflict = () => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[useSyncConflicts] Conflict dismissed');
    }
    setPendingConflict(null);
  };

  return {
    pendingConflict,
    resolveConflict,
    dismissConflict,
  };
}
