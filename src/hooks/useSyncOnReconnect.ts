/**
 * useSyncOnReconnect - Triggers sync when coming back online
 *
 * Automatically syncs local data to cloud when:
 * - User reconnects after being offline
 * - App starts while online
 *
 * Sync strategy:
 * 1. syncUp: Push local changes to cloud (mutation queue handles this)
 * 2. listForCurrentUser: Refreshes tournament list from cloud (updates local cache)
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
        if (isOnline && wasOffline) {
            const doSync = async () => {
                try {
                    // Push local changes
                    if (repository.syncUp) {
                        await repository.syncUp();
                    }
                    // Refresh list from cloud (updates local cache)
                    await repository.listForCurrentUser();
                    // eslint-disable-next-line no-console
                    console.log('useSyncOnReconnect: Reconnect sync complete');
                } catch {
                    // Sync failures are tolerated - data stays local
                }
            };
            void doSync();
        }
    }, [isOnline, wasOffline, repository]);

    // Sync on mount if online (catch up after app restart)
    useEffect(() => {
        if (isOnline && !hasSyncedOnMount.current) {
            hasSyncedOnMount.current = true;
            const doSync = async () => {
                try {
                    // Push local changes first
                    if (repository.syncUp) {
                        await repository.syncUp();
                    }
                    // Refresh list from cloud (updates local cache)
                    await repository.listForCurrentUser();
                    // eslint-disable-next-line no-console
                    console.log('useSyncOnReconnect: Initial sync complete');
                } catch {
                    // Sync failures are tolerated - data stays local
                }
            };
            void doSync();
        }
    }, [isOnline, repository]);
}
