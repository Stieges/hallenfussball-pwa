/**
 * RealtimeService - Supabase Realtime Integration
 *
 * Handles live updates and presence tracking for collaborative editing.
 * Uses "poke" pattern: Realtime only signals that data changed,
 * clients then sync to get the actual data.
 *
 * @see docs/concepts/MULTI-USER-KONZEPT.md Phase 4
 */

import { supabase } from '../../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js';

// =============================================================================
// TYPES
// =============================================================================

export interface PresenceMember {
    user_id: string;
    user_name: string;
    online_at: string;
}

export interface RealtimePayload {
    entity_type: string;
    entity_id: string;
    user_name: string;
    action: 'create' | 'update' | 'delete';
}

export type OnPokeCallback = (payload: RealtimePayload) => void;
export type OnPresenceCallback = (members: PresenceMember[]) => void;

// =============================================================================
// SERVICE
// =============================================================================

export class RealtimeService {
    private channel: RealtimeChannel | null = null;
    private tournamentId: string | null = null;

    /**
     * Subscribe to tournament changes (poke pattern)
     */
    subscribe(
        tournamentId: string,
        onPoke: OnPokeCallback
    ): void {
        if (!supabase) {
            console.warn('RealtimeService: Supabase client not available');
            return;
        }
        this.tournamentId = tournamentId;
        this.channel = supabase
            .channel(`tournament:${tournamentId}`)
            .on('broadcast', { event: 'change' }, ({ payload }) => {
                onPoke(payload as RealtimePayload);
            })
            .subscribe();
    }

    /**
     * Subscribe with presence tracking
     */
    subscribeWithPresence(
        tournamentId: string,
        userId: string,
        userName: string,
        onPoke: OnPokeCallback,
        onPresenceChange: OnPresenceCallback
    ): void {
        if (!supabase) {
            console.warn('RealtimeService: Supabase client not available');
            return;
        }
        this.tournamentId = tournamentId;
        this.channel = supabase
            .channel(`tournament:${tournamentId}`)
            .on('broadcast', { event: 'change' }, ({ payload }) => {
                onPoke(payload as RealtimePayload);
            })
            .on('presence', { event: 'sync' }, () => {
                if (!this.channel) {
                    return;
                }
                const state = this.channel.presenceState();
                const members = Object.values(state)
                    .flat() as unknown as PresenceMember[];
                onPresenceChange(members);
            })
            .subscribe((status) => {
                if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED && this.channel) {
                    void this.channel.track({
                        user_id: userId,
                        user_name: userName,
                        online_at: new Date().toISOString(),
                    });
                }
            });
    }

    /**
     * Unsubscribe from channel
     */
    unsubscribe(): void {
        if (this.channel && supabase) {
            void supabase.removeChannel(this.channel);
            this.channel = null;
            this.tournamentId = null;
        }
    }

    /**
     * Broadcast a change to other subscribers
     */
    broadcast(
        entityType: string,
        entityId: string,
        userName: string,
        action: 'create' | 'update' | 'delete' = 'update'
    ): void {
        if (!this.channel || !this.tournamentId) {
            return;
        }

        void this.channel.send({
            type: 'broadcast',
            event: 'change',
            payload: {
                entity_type: entityType,
                entity_id: entityId,
                user_name: userName,
                action,
            } satisfies RealtimePayload,
        });
    }

    /**
     * Check if currently subscribed
     */
    isSubscribed(): boolean {
        return this.channel !== null;
    }

    /**
     * Get current tournament ID
     */
    getTournamentId(): string | null {
        return this.tournamentId;
    }
}

// Singleton instance for app-wide usage
export const realtimeService = new RealtimeService();

export default RealtimeService;
