/**
 * useRealtime - Hook for Realtime subscription management
 *
 * Subscribes to tournament changes and presence updates.
 * Automatically syncs data when changes are detected.
 *
 * @see docs/concepts/MULTI-USER-KONZEPT.md Phase 4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/hooks/useAuth';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import {
    RealtimeService,
    type PresenceMember,
    type RealtimePayload,
} from '../services/RealtimeService';

// =============================================================================
// TYPES
// =============================================================================

export interface LastUpdate {
    entityType: string;
    entityId: string;
    userName: string;
    action: 'create' | 'update' | 'delete';
    timestamp: Date;
}

export interface UseRealtimeReturn {
    /** List of users currently online in the tournament */
    onlineMembers: PresenceMember[];
    /** Last update received from another user */
    lastUpdate: LastUpdate | null;
    /** Whether realtime is connected */
    isConnected: boolean;
    /** Manually broadcast a change */
    broadcast: (entityType: string, entityId: string, action?: 'create' | 'update' | 'delete') => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useRealtime(tournamentId: string | undefined): UseRealtimeReturn {
    const { user } = useAuth();
    const { syncTournament } = useSyncStatus();

    const [onlineMembers, setOnlineMembers] = useState<PresenceMember[]>([]);
    const [lastUpdate, setLastUpdate] = useState<LastUpdate | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const serviceRef = useRef<RealtimeService | null>(null);

    // Handle incoming "poke" - someone else made a change
    const handlePoke = useCallback((payload: RealtimePayload) => {
        // Ignore own changes
        if (payload.user_name === user?.name) {
            return;
        }

        // Trigger sync to get latest data
        if (tournamentId) {
            void syncTournament(tournamentId);
        }

        // Update last update info
        setLastUpdate({
            entityType: payload.entity_type,
            entityId: payload.entity_id,
            userName: payload.user_name,
            action: payload.action,
            timestamp: new Date(),
        });
    }, [user, tournamentId, syncTournament]);

    // Handle presence changes
    const handlePresenceChange = useCallback((members: PresenceMember[]) => {
        setOnlineMembers(members);
    }, []);

    // Subscribe/unsubscribe based on tournamentId
    useEffect(() => {
        if (!tournamentId || !user) {
            setIsConnected(false);
            return;
        }

        const service = new RealtimeService();
        serviceRef.current = service;

        service.subscribeWithPresence(
            tournamentId,
            user.id,
            user.name || 'Anonymous',
            handlePoke,
            handlePresenceChange
        );

        setIsConnected(true);

        return () => {
            service.unsubscribe();
            serviceRef.current = null;
            setIsConnected(false);
            setOnlineMembers([]);
        };
    }, [tournamentId, user, handlePoke, handlePresenceChange]);

    // Broadcast function for external use
    const broadcast = useCallback((
        entityType: string,
        entityId: string,
        action: 'create' | 'update' | 'delete' = 'update'
    ) => {
        if (serviceRef.current && user) {
            serviceRef.current.broadcast(
                entityType,
                entityId,
                user.name || 'Anonymous',
                action
            );
        }
    }, [user]);

    return {
        onlineMembers,
        lastUpdate,
        isConnected,
        broadcast,
    };
}

export default useRealtime;
