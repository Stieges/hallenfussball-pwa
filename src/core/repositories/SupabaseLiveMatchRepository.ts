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
  isMatchActive,
} from './liveMatchMappers';
import {
  callAppendMatchEvents,
  callServerTime,
  type AppendableEvent,
  type AppendOptions,
  type AppendResult,
} from './appendMatchEventsRpc';

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

/** A-06k (@FU-025): Zustand des Realtime-Kanals (Werte von supabase-js `REALTIME_SUBSCRIBE_STATES`). */
export type RealtimeChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export interface SubscriptionOptions {
  onMatchChange?: LiveMatchChangeHandler;
  onError?: (error: Error) => void;
  /** A-06k (@FU-025): meldet jeden Kanal-Zustand; Aufrufer wechselt bei != SUBSCRIBED auf Abfrage. */
  onStatusChange?: (status: RealtimeChannelStatus) => void;
}

const REALTIME_CHANNEL_STATUSES: readonly string[] = ['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'];

function isRealtimeChannelStatus(value: string): value is RealtimeChannelStatus {
  return REALTIME_CHANNEL_STATUSES.includes(value);
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class SupabaseLiveMatchRepository implements ILiveMatchRepository {
  private subscriptions = new Map<string, RealtimeChannel>();
  private teamsCache = new Map<string, Map<string, TeamRow>>();

  // ==========================================================================
  // ILiveMatchRepository Implementation
  // ==========================================================================

  async get(tournamentId: string, matchId: string): Promise<LiveMatch | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    // Guard: Don't query with empty IDs
    if (!tournamentId || !matchId) {
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

    // Guard: Don't query with empty tournamentId
    if (!tournamentId) {
      return new Map();
    }

    try {
      // Load teams if not cached
      const teamsMap = await this.ensureTeamsLoaded(tournamentId);

      // Fetch active matches: running/paused OR initialized with live_state
      const { data: matchRows, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .or('match_status.in.(running,paused),live_state.not.is.null');

       
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

      return result;
    } catch (error) {
      console.error('[SupabaseLiveMatchRepository] getAll failed:', error);
      return new Map();
    }
  }

  // ==========================================================================
  // Server-Schreibweg (B3b) -- noch nirgends aufgerufen, Nutzung ab PR C
  // ==========================================================================

  /**
   * Hängt Ereignisse an EIN Spiel über `append_match_events` an (R12). Liefert je Ereignis ein
   * Ergebnis, den Server-Zustand und die Serverzeit -- oder `{ error: 'CLIENT_OUTDATED' }`.
   * Transport-/RPC-Fehler und unerwartete Antworten werfen `RepositoryError`.
   */
  appendMatchEvents(
    matchId: string,
    events: readonly AppendableEvent[],
    options: AppendOptions
  ): Promise<AppendResult> {
    return callAppendMatchEvents(isSupabaseConfigured ? supabase : null, matchId, events, options);
  }

  /** Serverzeit in Epoch-ms (`server_time`), Fehler als `RepositoryError`. */
  serverTime(): Promise<number> {
    return callServerTime(isSupabaseConfigured ? supabase : null);
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

            // Task A1 (Sofortschutz): ein FINISHED-Match ist NICHT "inaktiv" im Sinne dieses
            // Guards, obwohl ein beendetes Spiel live_state == null hat (der Server setzt das,
            // der Client sendet es nicht mehr) — das lässt isMatchActive() unten false zurückgeben. Ohne diese
            // Ausnahme wurde JEDE Spielende-Aktualisierung wie eine Löschung behandelt (siehe
            // Zweig unten) und wird bewusst NICHT als Löschung behandelt (Cockpit braucht beendete
            // Spiele weiterhin) — ein zweites,
            // bereits geöffnetes Cockpit (z. B. der Owner) erfuhr dadurch NIE per Realtime, dass
            // ein Helfer das Spiel beendet hat, sondern hätte manuell neu laden müssen.
            const isFinished = matchRow.match_status === 'finished';

            // Skip if not active (außer: gerade beendet, siehe oben)
            if (!isFinished && !isMatchActive(matchRow)) {
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
              payload.eventType
            );
            } catch (error) {
              console.error('[SupabaseLiveMatchRepository] subscription handler error:', error);
              options.onError?.(error as Error);
            }
          })();
        }
      )
      .subscribe((status: string) => {
        if (isRealtimeChannelStatus(status)) {
          options.onStatusChange?.(status);
        }
        if (status === 'CHANNEL_ERROR') {
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
    // Guard: Don't query with empty tournamentId
    if (!tournamentId) {
      return new Map();
    }

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
