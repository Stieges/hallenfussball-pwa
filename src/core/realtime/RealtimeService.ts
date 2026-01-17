/**
 * RealtimeService - Core Supabase Realtime Integration
 *
 * Provides visibility-aware realtime subscriptions for tournament data.
 * Automatically pauses subscriptions when tab is hidden and resumes when visible.
 *
 * Features:
 * - Postgres Changes subscriptions for database updates
 * - Automatic pause/resume based on document visibility
 * - Reconnection handling on network recovery
 * - Event-driven architecture with typed callbacks
 *
 * @see docs/concepts/MULTI-USER-KONZEPT.md
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type {
  RealtimeConnectionStatus,
  RealtimePayload,
  RealtimeState,
  TournamentSubscriptionOptions,
} from './types';

// =============================================================================
// SERVICE
// =============================================================================

export class RealtimeService {
  private channels = new Map<string, RealtimeChannel>();
  private subscriptionOptions = new Map<string, TournamentSubscriptionOptions>();
  private state: RealtimeState = {
    status: 'disconnected',
    lastConnectedAt: null,
    lastError: null,
    isPaused: false,
    subscribedTournaments: new Set(),
  };

  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  constructor() {
    this.setupVisibilityHandling();
    this.setupNetworkHandling();
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Subscribe to realtime changes for a tournament
   */
  subscribeTournament(options: TournamentSubscriptionOptions): void {
    if (!isSupabaseConfigured || !supabase) {
      if (import.meta.env.DEV) {
        console.warn('[RealtimeService] Supabase not configured');
      }
      return;
    }

    const { tournamentId } = options;

    // Unsubscribe if already subscribed
    this.unsubscribeTournament(tournamentId);

    // Store options for reconnection
    this.subscriptionOptions.set(tournamentId, options);
    this.state.subscribedTournaments.add(tournamentId);

    // Don't subscribe if paused (visibility hidden)
    if (this.state.isPaused) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[RealtimeService] Subscription queued (tab hidden):', tournamentId);
      }
      return;
    }

    this.createSubscription(tournamentId, options);
  }

  /**
   * Unsubscribe from tournament changes
   */
  unsubscribeTournament(tournamentId: string): void {
    const channel = this.channels.get(tournamentId);
    if (channel && supabase) {
      void supabase.removeChannel(channel);
      this.channels.delete(tournamentId);
    }

    this.subscriptionOptions.delete(tournamentId);
    this.state.subscribedTournaments.delete(tournamentId);

    // Update status
    if (this.channels.size === 0) {
      this.updateStatus('disconnected');
    }
  }

  /**
   * Unsubscribe from all tournaments
   */
  unsubscribeAll(): void {
    for (const tournamentId of this.channels.keys()) {
      this.unsubscribeTournament(tournamentId);
    }
  }

  /**
   * Get current connection state
   */
  getState(): Readonly<RealtimeState> {
    return { ...this.state };
  }

  /**
   * Check if subscribed to a specific tournament
   */
  isSubscribed(tournamentId: string): boolean {
    return this.channels.has(tournamentId);
  }

  /**
   * Manually pause subscriptions (e.g., for performance)
   */
  pause(): void {
    if (this.state.isPaused) { return; }

    this.state.isPaused = true;
    this.removeAllChannels();
    this.updateStatus('paused');

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[RealtimeService] Paused');
    }
  }

  /**
   * Resume subscriptions after pause
   */
  resume(): void {
    if (!this.state.isPaused) { return; }

    this.state.isPaused = false;
    this.resubscribeAll();

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[RealtimeService] Resumed');
    }
  }

  /**
   * Cleanup - call on unmount
   */
  destroy(): void {
    this.unsubscribeAll();
    this.removeVisibilityHandling();
    this.removeNetworkHandling();
  }

  // ===========================================================================
  // PRIVATE - SUBSCRIPTION MANAGEMENT
  // ===========================================================================

  private createSubscription(
    tournamentId: string,
    options: TournamentSubscriptionOptions
  ): void {
    if (!supabase) { return; }

    const channelName = `tournament-${tournamentId}`;

    const channel = supabase.channel(channelName);

    // Subscribe to matches (most important for live updates)
    if (options.onMatchChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          options.onMatchChange?.(this.normalizePayload(payload, 'matches'));
        }
      );
    }

    // Subscribe to teams
    if (options.onTeamChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          options.onTeamChange?.(this.normalizePayload(payload, 'teams'));
        }
      );
    }

    // Subscribe to match_events (via matches)
    if (options.onMatchEventChange) {
      // Note: match_events doesn't have tournament_id directly
      // We listen to all and filter in callback, or use a view
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
        },
        (payload) => {
          // Events come through - let callback filter by match
          options.onMatchEventChange?.(this.normalizePayload(payload, 'match_events'));
        }
      );
    }

    // Subscribe to tournament itself
    if (options.onTournamentChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          options.onTournamentChange?.(this.normalizePayload(payload, 'tournaments'));
        }
      );
    }

    // Handle subscription status
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        this.updateStatus('connected');
        this.state.lastConnectedAt = new Date();
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[RealtimeService] Subscribed to:', tournamentId);
        }
      } else if (status === 'CHANNEL_ERROR') {
        const error = new Error(`Subscription failed for ${tournamentId}`);
        this.state.lastError = error;
        this.updateStatus('error');
        options.onError?.(error);
      } else if (status === 'CLOSED') {
        if (!this.state.isPaused) {
          this.updateStatus('disconnected');
        }
      }

      options.onStatusChange?.(this.state.status);
    });

    this.channels.set(tournamentId, channel);
    this.updateStatus('connecting');
  }

  private normalizePayload(
    raw: { eventType: string; new: unknown; old: unknown },
    table: 'tournaments' | 'teams' | 'matches' | 'match_events'
  ): RealtimePayload {
    return {
      eventType: raw.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      table,
      schema: 'public',
      new: raw.new as Record<string, unknown> | null,
      old: raw.old as Partial<Record<string, unknown>> | null,
    };
  }

  private removeAllChannels(): void {
    if (!supabase) { return; }

    for (const channel of this.channels.values()) {
      void supabase.removeChannel(channel);
    }
    this.channels.clear();
  }

  private resubscribeAll(): void {
    for (const [tournamentId, options] of this.subscriptionOptions) {
      this.createSubscription(tournamentId, options);
    }
  }

  private updateStatus(status: RealtimeConnectionStatus): void {
    this.state.status = status;
  }

  // ===========================================================================
  // PRIVATE - VISIBILITY HANDLING
  // ===========================================================================

  private setupVisibilityHandling(): void {
    if (typeof document === 'undefined') { return; }

    this.visibilityHandler = () => {
      if (document.hidden) {
        // Tab hidden - pause subscriptions
        this.pause();
      } else {
        // Tab visible - resume subscriptions
        this.resume();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private removeVisibilityHandling(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // ===========================================================================
  // PRIVATE - NETWORK HANDLING
  // ===========================================================================

  private setupNetworkHandling(): void {
    if (typeof window === 'undefined') { return; }

    this.onlineHandler = () => {
      if (navigator.onLine && !this.state.isPaused) {
        // Back online - resubscribe
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[RealtimeService] Network restored, resubscribing...');
        }
        this.resubscribeAll();
      }
    };

    window.addEventListener('online', this.onlineHandler);
  }

  private removeNetworkHandling(): void {
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Default realtime service instance for app-wide usage
 */
export const realtimeService = new RealtimeService();

export default RealtimeService;
