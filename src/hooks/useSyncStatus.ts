/**
 * useSyncStatus - Hook for tracking synchronization status
 *
 * Provides granular sync status tracking for UI feedback:
 * - synced: All data is in sync
 * - syncing: Sync in progress
 * - pending: Changes waiting to sync
 * - offline: No internet connection
 * - error: Sync failed
 * - conflict: Conflicts detected
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useRepositoryContext } from '../core/contexts/RepositoryContext';
import { SyncStatus, SyncResult, SyncConflict, OfflineRepository } from '../core/repositories/OfflineRepository';
import type { MutationQueueStatus } from '../core/services/MutationQueue';

export interface SyncState {
    /** Current sync status */
    status: SyncStatus;
    /** True if a sync operation is in progress */
    isSyncing: boolean;
    /** Error message if status is 'error' */
    errorMessage?: string;
    /** Conflicts if status is 'conflict' */
    conflicts?: SyncConflict[];
    /** Timestamp of last successful sync */
    lastSyncedAt?: string;
    /** Number of pending changes in mutation queue */
    pendingChanges: number;
    /** Number of failed mutations in dead-letter queue */
    failedChanges: number;
}

export interface UseSyncStatusReturn extends SyncState {
    /** Manually trigger a sync for a specific tournament */
    syncTournament: (tournamentId: string) => Promise<SyncResult>;
    /** Resolve a conflict */
    resolveConflict: (tournamentId: string, resolution: 'local' | 'remote') => Promise<SyncResult>;
    /** Clear error state */
    clearError: () => void;
    /** Clear conflicts state */
    clearConflicts: () => void;
}

/**
 * Hook to track and manage synchronization status
 *
 * @example
 * ```tsx
 * const { status, isSyncing, syncTournament, conflicts } = useSyncStatus();
 *
 * if (status === 'conflict') {
 *   return <ConflictDialog conflicts={conflicts} />;
 * }
 *
 * if (status === 'offline') {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export function useSyncStatus(): UseSyncStatusReturn {
    const repository = useRepositoryContext();
    const { isOnline } = useOnlineStatus();

    const [state, setState] = useState<SyncState>({
        status: isOnline ? 'synced' : 'offline',
        isSyncing: false,
        pendingChanges: 0,
        failedChanges: 0,
    });

    const isMounted = useRef(true);

    // Subscribe to MutationQueue status updates
    useEffect(() => {
        // Check if repository is OfflineRepository with mutationQueue
        if (!('mutationQueue' in repository)) {
            return;
        }

        const offlineRepo = repository as OfflineRepository;
        const mutationQueue = offlineRepo.mutationQueue;

        // Get initial status
        const initialStatus = mutationQueue.getStatus();
        setState(prev => ({
            ...prev,
            pendingChanges: initialStatus.pendingCount,
            failedChanges: initialStatus.failedCount,
        }));

        // Subscribe to updates
        const unsubscribe = mutationQueue.subscribe((queueStatus: MutationQueueStatus) => {
            if (!isMounted.current) {return;}
            setState(prev => ({
                ...prev,
                pendingChanges: queueStatus.pendingCount,
                failedChanges: queueStatus.failedCount,
            }));
        });

        return unsubscribe;
    }, [repository]);

    // Update status when online status changes
    useEffect(() => {
        if (!isOnline) {
            setState(prev => ({
                ...prev,
                status: 'offline',
            }));
        } else if (state.status === 'offline') {
            setState(prev => ({
                ...prev,
                status: 'synced',
            }));
        }
    }, [isOnline, state.status]);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const syncTournament = useCallback(async (tournamentId: string): Promise<SyncResult> => {
        // Check if repository supports sync
        if (!('syncTournament' in repository)) {
            return { status: 'synced' };
        }

        setState(prev => ({
            ...prev,
            isSyncing: true,
            status: 'synced', // Clear any previous error
            errorMessage: undefined,
        }));

        try {
            const result = await (repository as { syncTournament: (id: string) => Promise<SyncResult> })
                .syncTournament(tournamentId);

            if (!isMounted.current) {
                return result;
            }

            setState(prev => ({
                ...prev,
                isSyncing: false,
                status: result.status,
                errorMessage: result.error,
                conflicts: result.conflicts,
                lastSyncedAt: result.status === 'synced' || result.status === 'updated'
                    ? new Date().toISOString()
                    : prev.lastSyncedAt,
            }));

            return result;
        } catch (error) {
            if (!isMounted.current) {
                return { status: 'error', error: 'Component unmounted' };
            }

            const errorMessage = error instanceof Error ? error.message : 'Sync failed';
            setState(prev => ({
                ...prev,
                isSyncing: false,
                status: 'error',
                errorMessage,
            }));

            return { status: 'error', error: errorMessage };
        }
    }, [repository]);

    const resolveConflict = useCallback(async (
        tournamentId: string,
        resolution: 'local' | 'remote'
    ): Promise<SyncResult> => {
        // Check if repository supports conflict resolution
        if (!('resolveConflict' in repository)) {
            return { status: 'error', error: 'Conflict resolution not supported' };
        }

        setState(prev => ({
            ...prev,
            isSyncing: true,
        }));

        try {
            const result = await (repository as {
                resolveConflict: (id: string, res: 'local' | 'remote') => Promise<SyncResult>
            }).resolveConflict(tournamentId, resolution);

            if (!isMounted.current) {
                return result;
            }

            setState(prev => ({
                ...prev,
                isSyncing: false,
                status: result.status,
                conflicts: result.status === 'conflict' ? result.conflicts : undefined,
                errorMessage: result.error,
                lastSyncedAt: result.status === 'synced'
                    ? new Date().toISOString()
                    : prev.lastSyncedAt,
            }));

            return result;
        } catch (error) {
            if (!isMounted.current) {
                return { status: 'error', error: 'Component unmounted' };
            }

            const errorMessage = error instanceof Error ? error.message : 'Resolution failed';
            setState(prev => ({
                ...prev,
                isSyncing: false,
                status: 'error',
                errorMessage,
            }));

            return { status: 'error', error: errorMessage };
        }
    }, [repository]);

    const clearError = useCallback(() => {
        setState(prev => ({
            ...prev,
            status: isOnline ? 'synced' : 'offline',
            errorMessage: undefined,
        }));
    }, [isOnline]);

    const clearConflicts = useCallback(() => {
        setState(prev => ({
            ...prev,
            status: isOnline ? 'synced' : 'offline',
            conflicts: undefined,
        }));
    }, [isOnline]);

    return {
        ...state,
        syncTournament,
        resolveConflict,
        clearError,
        clearConflicts,
    };
}
