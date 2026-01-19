/**
 * SupabaseLiveMatchRepository
 *
 * Supabase implementation of ILiveMatchRepository with Realtime subscriptions.
 * Enables cross-device synchronization of live match state.
 *
 * Uses:
 * - matches table (with live_state JSONB column)
 * - match_events table for event history
 * - Supabase Realtime for live updates
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { ILiveMatchRepository } from './ILiveMatchRepository';
import { LiveMatch } from '../models/LiveMatch';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Tables } from '../../types/supabase';
import {
  mapLiveMatchFromSupabase,
  mapLiveMatchToSupabase,
  isMatchActive,
} from './liveMatchMappers';

type MatchRow = Tables<'matches'>;
type MatchEventRow = Tables<'match_events'>;
type TeamRow = Tables<'teams'>;

// ============================================================================
// TYPES
// ============================================================================

export type LiveMatchChangeHandler = (
  matchId: string,
  match: LiveMatch | null, // null = deleted
  changeType: 'INSERT' | 'UPDATE' | 'DELETE'
) => void;

export interface SubscriptionOptions {
  onMatchChange?: LiveMatchChangeHandler;
  onError?: (error: Error) => void;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class SupabaseLiveMatchRepository implements ILiveMatchRepository {
  private subscriptions = new Map<string, RealtimeChannel>();
  private teamsCache = new Map<string, Map<string, TeamRow>>();
  private eventIdsCache = new Map<string, Set<string>>();

  // ==========================================================================
  // ILiveMatchRepository Implementation
  // ==========================================================================

  async get(tournamentId: string, matchId: string): Promise<LiveMatch | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    try {
      // Load teams if not cached
      const teamsMap = await this.ensureTeamsLoaded(tournamentId);

      // Fetch match
      const { data: matchRow, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

       
      if (matchError || !matchRow) {
        return null;
      }

      // Only return if match has live state (is active)
      if (!isMatchActive(matchRow)) {
        return null;
      }

      // Fetch events
      const { data: events } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .eq('is_deleted', false)
        .order('timestamp_seconds', { ascending: true });

      return mapLiveMatchFromSupabase(matchRow, events ?? [], teamsMap);
    } catch (error) {
      console.error('[SupabaseLiveMatchRepository] get failed:', error);
      return null;
    }
  }

  async getAll(tournamentId: string): Promise<Map<string, LiveMatch>> {
    if (!isSupabaseConfigured || !supabase) {
      return new Map();
    }

    try {
      // Load teams if not cached
      const teamsMap = await this.ensureTeamsLoaded(tournamentId);

      // Fetch active matches (have live_state or are running/paused)
      const { data: matchRows, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .in('match_status', ['running', 'paused']);

       
      if (matchError || !matchRows) {
        return new Map();
      }

      if (matchRows.length === 0) {
        return new Map();
      }

      // Fetch all events for these matches
      const matchIds = matchRows.map((m) => m.id);
      const { data: allEvents } = await supabase
        .from('match_events')
        .select('*')
        .in('match_id', matchIds)
        .eq('is_deleted', false)
        .order('timestamp_seconds', { ascending: true });

      // Group events by match
      const eventsByMatch = new Map<string, MatchEventRow[]>();
      for (const event of allEvents ?? []) {
        const existing = eventsByMatch.get(event.match_id) ?? [];
        existing.push(event);
        eventsByMatch.set(event.match_id, existing);
      }

      // Map to LiveMatch
      const result = new Map<string, LiveMatch>();
      for (const matchRow of matchRows) {
        const events = eventsByMatch.get(matchRow.id) ?? [];
        const liveMatch = mapLiveMatchFromSupabase(matchRow, events, teamsMap);
        result.set(matchRow.id, liveMatch);
      }

      // Update event ID cache
      for (const event of allEvents ?? []) {
        const cached = this.eventIdsCache.get(event.match_id) ?? new Set();
        cached.add(event.id);
        this.eventIdsCache.set(event.match_id, cached);
      }

      return result;
    } catch (error) {
      console.error('[SupabaseLiveMatchRepository] getAll failed:', error);
      return new Map();
    }
  }

  async save(_tournamentId: string, match: LiveMatch): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      // Get existing event IDs
      const existingEventIds = this.eventIdsCache.get(match.id) ?? new Set();

      // Map to Supabase format
      const { matchUpdate, newEvents } = mapLiveMatchToSupabase(match, existingEventIds);

      // Update match
      const { error: matchError } = await supabase
        .from('matches')
        .update(matchUpdate as unknown as Record<string, unknown>)
        .eq('id', match.id);

      if (matchError) {
        console.error('[SupabaseLiveMatchRepository] match update failed:', matchError);
        throw matchError;
      }

      // Insert new events
      if (newEvents.length > 0) {
        const { error: eventsError } = await supabase
          .from('match_events')
          .insert(newEvents);

        if (eventsError) {
          console.error('[SupabaseLiveMatchRepository] events insert failed:', eventsError);
          // Don't throw - match was updated successfully
        }

        // Update event ID cache
        for (const event of newEvents) {
          existingEventIds.add(event.id);
        }
        this.eventIdsCache.set(match.id, existingEventIds);
      }
    } catch (error) {
      console.error('[SupabaseLiveMatchRepository] save failed:', error);
      throw error;
    }
  }

  async saveAll(tournamentId: string, matches: Map<string, LiveMatch>): Promise<void> {
    // Save each match individually (could be optimized with batch upsert)
    const promises = Array.from(matches.values()).map((match) =>
      this.save(tournamentId, match)
    );
    await Promise.all(promises);
  }

  async delete(_tournamentId: string, matchId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      // Clear live_state (don't delete the match, just clear live state)
      const { error } = await supabase
        .from('matches')
        .update({ live_state: null } as unknown as Record<string, unknown>)
        .eq('id', matchId);

      if (error) {
        console.error('[SupabaseLiveMatchRepository] delete failed:', error);
        throw error;
      }

      // Clear event cache
      this.eventIdsCache.delete(matchId);
    } catch (error) {
      console.error('[SupabaseLiveMatchRepository] delete failed:', error);
      throw error;
    }
  }

  async clear(tournamentId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    try {
      // Clear live_state for all tournament matches
      const { error } = await supabase
        .from('matches')
        .update({ live_state: null } as unknown as Record<string, unknown>)
        .eq('tournament_id', tournamentId);

      if (error) {
        console.error('[SupabaseLiveMatchRepository] clear failed:', error);
        throw error;
      }

      // Clear caches
      this.teamsCache.delete(tournamentId);
      // Clear all event caches for this tournament (would need match IDs)
    } catch (error) {
      console.error('[SupabaseLiveMatchRepository] clear failed:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Realtime Subscriptions
  // ==========================================================================

  /**
   * Subscribe to live match changes for a tournament
   */
  subscribe(tournamentId: string, options: SubscriptionOptions): void {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    // Unsubscribe if already subscribed
    this.unsubscribe(tournamentId);

    const channel = supabase
      .channel(`live-matches-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          void (async () => {
            try {
              const matchRow = payload.new as MatchRow | undefined;
              const oldRow = payload.old as { id: string } | undefined;

              if (payload.eventType === 'DELETE' && oldRow) {
                options.onMatchChange?.(oldRow.id, null, 'DELETE');
                return;
              }

              if (!matchRow) { return; }

            // Skip if not active
            if (!isMatchActive(matchRow)) {
              // If it was active before, treat as delete
              if (payload.eventType === 'UPDATE') {
                const oldMatch = payload.old as MatchRow | undefined;
                if (oldMatch && isMatchActive(oldMatch)) {
                  options.onMatchChange?.(matchRow.id, null, 'DELETE');
                }
              }
              return;
            }

            // Load teams and events
            const teamsMap = await this.ensureTeamsLoaded(tournamentId);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { data: events } = await supabase!
              .from('match_events')
              .select('*')
              .eq('match_id', matchRow.id)
              .eq('is_deleted', false)
              .order('timestamp_seconds', { ascending: true });

            const liveMatch = mapLiveMatchFromSupabase(matchRow, events ?? [], teamsMap);

            options.onMatchChange?.(
              matchRow.id,
              liveMatch,
              payload.eventType as 'INSERT' | 'UPDATE'
            );
            } catch (error) {
              console.error('[SupabaseLiveMatchRepository] subscription handler error:', error);
              options.onError?.(error as Error);
            }
          })();
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Successfully subscribed to realtime changes
        } else if (status === 'CHANNEL_ERROR') {
          options.onError?.(new Error('Realtime subscription failed'));
        }
      });

    this.subscriptions.set(tournamentId, channel);
  }

  /**
   * Unsubscribe from live match changes
   */
  unsubscribe(tournamentId: string): void {
    const channel = this.subscriptions.get(tournamentId);
    if (channel && supabase) {
      void supabase.removeChannel(channel);
      this.subscriptions.delete(tournamentId);
    }
  }

  /**
   * Unsubscribe from all tournaments
   */
  unsubscribeAll(): void {
    for (const tournamentId of this.subscriptions.keys()) {
      this.unsubscribe(tournamentId);
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async ensureTeamsLoaded(tournamentId: string): Promise<Map<string, TeamRow>> {
    // Return cached if available
    const cached = this.teamsCache.get(tournamentId);
    if (cached) {
      return cached;
    }

    if (!supabase) {
      return new Map();
    }

    // Load teams
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('is_removed', false);

    const teamsMap = new Map<string, TeamRow>();
    for (const team of teams ?? []) {
      teamsMap.set(team.id, team);
    }

    this.teamsCache.set(tournamentId, teamsMap);
    return teamsMap;
  }

  /**
   * Invalidate teams cache (call when teams are updated)
   */
  invalidateTeamsCache(tournamentId: string): void {
    this.teamsCache.delete(tournamentId);
  }
}
