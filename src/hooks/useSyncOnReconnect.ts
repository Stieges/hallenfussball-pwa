/**
 * useSyncOnReconnect - Triggers sync when coming back online
 *
 * Automatically syncs local data to cloud when:
 * - User reconnects after being offline
 * - App starts while online
 */

import { useEffect, useRef } from 'react';
import { useRepositoryContext } from '../core/contexts/RepositoryContext';
import { useOnlineStatus } from './useOnlineStatus';

export function useSyncOnReconnect(): void {
    const repository = useRepositoryContext();
    const { isOnline, wasOffline } = useOnlineStatus();
    const hasSyncedOnMount = useRef(false);

    // Sync on reconnect
    useEffect(() => {
        if (isOnline && wasOffline && repository.syncUp) {
            repository.syncUp().catch(() => {
                // Sync failures are tolerated - data stays local
            });
        }
    }, [isOnline, wasOffline, repository]);

    // Sync on mount if online (catch up after app restart)
    useEffect(() => {
        if (isOnline && !hasSyncedOnMount.current && repository.syncUp) {
            hasSyncedOnMount.current = true;
            repository.syncUp().catch(() => {
                // Sync failures are tolerated - data stays local
            });
        }
    }, [isOnline, repository]);
}
