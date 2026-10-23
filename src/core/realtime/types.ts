/**
 * Realtime Types
 *
 * Type definitions for Supabase Realtime integration.
 */

// =============================================================================
// Event Types
// =============================================================================

export type RealtimeChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

/** Server-Tabellen zu „Gruppe abschließen“ (GA4 A-13b-C): Abschlüsse, Folgen-Hinweise, Klärungen. */
export type RealtimeServerTable = 'group_completions' | 'bracket_notices' | 'clarifications';

export type RealtimeTable = 'tournaments' | 'teams' | 'matches' | 'match_events' | RealtimeServerTable;

export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: RealtimeChangeType;
  table: RealtimeTable;
  schema: string;
  new: T | null;
  old: Partial<T> | null;
}

// =============================================================================
// Subscription Types
// =============================================================================

export type RealtimeCallback<T = Record<string, unknown>> = (
  payload: RealtimePayload<T>
) => void;

export interface RealtimeSubscription {
  id: string;
  table: RealtimeTable;
  filter?: string;
  callback: RealtimeCallback;
}

export interface TournamentSubscriptionOptions {
  /** Tournament ID to subscribe to */
  tournamentId: string;
  /** Called when team data changes */
  onTeamChange?: RealtimeCallback;
  /** Called when match data changes */
  onMatchChange?: RealtimeCallback;
  /** Called when match events change */
  onMatchEventChange?: RealtimeCallback;
  /** Called when a group completion, a follow-up notice or a clarification changes (GA4 A-13b-C) */
  onBracketChange?: RealtimeCallback;
  /** Called on subscription error */
  onError?: (error: Error) => void;
  /** Called when connection status changes */
  onStatusChange?: (status: RealtimeConnectionStatus) => void;
}

// =============================================================================
// Connection Status
// =============================================================================

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'paused' // Visibility-based pause
  | 'error';

export interface RealtimeState {
  status: RealtimeConnectionStatus;
  lastConnectedAt: Date | null;
  lastError: Error | null;
  isPaused: boolean;
  subscribedTournaments: Set<string>;
}

// =============================================================================
// Service Events
// =============================================================================

export type RealtimeServiceEvent =
  | 'connect'
  | 'disconnect'
  | 'pause'
  | 'resume'
  | 'error'
  | 'change';

export interface RealtimeServiceEventMap {
  connect: undefined;
  disconnect: undefined;
  pause: undefined;
  resume: undefined;
  error: Error;
  change: RealtimePayload;
}
