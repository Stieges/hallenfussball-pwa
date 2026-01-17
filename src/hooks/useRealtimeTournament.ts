/**
 * useRealtimeTournament - Hook for subscribing to tournament realtime updates
 *
 * Provides automatic subscription management for Supabase Realtime:
 * - Subscribes when tournamentId is provided and enabled
 * - Unsubscribes on unmount or tournamentId change
 * - Visibility-aware (pauses when tab hidden via RealtimeService)
 * - Calls onUpdate callback when changes arrive
 *
 * @example
 * ```tsx
 * const { status, isConnected } = useRealtimeTournament(tournamentId, {
 *   onUpdate: () => refetch(),
 * });
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { realtimeService, type RealtimeConnectionStatus, type RealtimePayload } from '../core/realtime';
import { isSupabaseConfigured } from '../lib/supabase';

export interface UseRealtimeTournamentOptions {
  /** Enable/disable the subscription (default: true) */
  enabled?: boolean;

  /** Callback when any tournament data changes */
  onUpdate?: (payload: RealtimePayload) => void;

  /** Callback for tournament table changes specifically */
  onTournamentChange?: (payload: RealtimePayload) => void;

  /** Callback for team changes */
  onTeamChange?: (payload: RealtimePayload) => void;

  /** Callback for match changes */
  onMatchChange?: (payload: RealtimePayload) => void;

  /** Callback for match event changes */
  onMatchEventChange?: (payload: RealtimePayload) => void;

  /** Callback when connection status changes */
  onStatusChange?: (status: RealtimeConnectionStatus) => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseRealtimeTournamentReturn {
  /** Current connection status */
  status: RealtimeConnectionStatus;

  /** True if connected to realtime */
  isConnected: boolean;

  /** True if subscription is paused (tab hidden) */
  isPaused: boolean;

  /** True if there was a connection error */
  hasError: boolean;

  /** Last error that occurred */
  lastError: Error | null;

  /** Manually pause the subscription */
  pause: () => void;

  /** Manually resume the subscription */
  resume: () => void;
}

/**
 * Hook for subscribing to tournament realtime updates
 *
 * @param tournamentId - The tournament ID to subscribe to
 * @param options - Configuration options
 */
export function useRealtimeTournament(
  tournamentId: string | undefined,
  options: UseRealtimeTournamentOptions = {}
): UseRealtimeTournamentReturn {
  const {
    enabled = true,
    onUpdate,
    onTournamentChange,
    onTeamChange,
    onMatchChange,
    onMatchEventChange,
    onStatusChange,
    onError,
  } = options;

  const [status, setStatus] = useState<RealtimeConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<Error | null>(null);

  // Use refs for callbacks to avoid re-subscriptions on callback changes
  const callbacksRef = useRef({
    onUpdate,
    onTournamentChange,
    onTeamChange,
    onMatchChange,
    onMatchEventChange,
    onStatusChange,
    onError,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onUpdate,
      onTournamentChange,
      onTeamChange,
      onMatchChange,
      onMatchEventChange,
      onStatusChange,
      onError,
    };
  }, [onUpdate, onTournamentChange, onTeamChange, onMatchChange, onMatchEventChange, onStatusChange, onError]);

  // Subscribe/unsubscribe effect
  useEffect(() => {
    // Don't subscribe if:
    // - No tournament ID
    // - Subscription is disabled
    // - Supabase is not configured
    if (!tournamentId || !enabled || !isSupabaseConfigured) {
      setStatus('disconnected');
      return;
    }

    // Create wrapper callbacks that call both specific and generic handlers
    const handleTournamentChange = (payload: RealtimePayload) => {
      callbacksRef.current.onTournamentChange?.(payload);
      callbacksRef.current.onUpdate?.(payload);
    };

    const handleTeamChange = (payload: RealtimePayload) => {
      callbacksRef.current.onTeamChange?.(payload);
      callbacksRef.current.onUpdate?.(payload);
    };

    const handleMatchChange = (payload: RealtimePayload) => {
      callbacksRef.current.onMatchChange?.(payload);
      callbacksRef.current.onUpdate?.(payload);
    };

    const handleMatchEventChange = (payload: RealtimePayload) => {
      callbacksRef.current.onMatchEventChange?.(payload);
      callbacksRef.current.onUpdate?.(payload);
    };

    const handleError = (error: Error) => {
      setLastError(error);
      callbacksRef.current.onError?.(error);
    };

    const handleStatusChange = (newStatus: RealtimeConnectionStatus) => {
      setStatus(newStatus);
      if (newStatus !== 'error') {
        setLastError(null);
      }
      callbacksRef.current.onStatusChange?.(newStatus);
    };

    // Subscribe to tournament
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[useRealtimeTournament] Subscribing to:', tournamentId);
    }

    realtimeService.subscribeTournament({
      tournamentId,
      onTournamentChange: handleTournamentChange,
      onTeamChange: handleTeamChange,
      onMatchChange: handleMatchChange,
      onMatchEventChange: handleMatchEventChange,
      onError: handleError,
      onStatusChange: handleStatusChange,
    });

    // Cleanup: unsubscribe when tournamentId changes or component unmounts
    return () => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[useRealtimeTournament] Unsubscribing from:', tournamentId);
      }
      realtimeService.unsubscribeTournament(tournamentId);
    };
  }, [tournamentId, enabled]);

  // Pause/resume methods
  const pause = useCallback(() => {
    realtimeService.pause();
  }, []);

  const resume = useCallback(() => {
    realtimeService.resume();
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    isPaused: status === 'paused',
    hasError: status === 'error',
    lastError,
    pause,
    resume,
  };
}

export default useRealtimeTournament;
