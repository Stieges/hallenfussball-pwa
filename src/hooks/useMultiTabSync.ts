/**
 * useMultiTabSync Hook
 *
 * Provides multi-tab synchronization for match management.
 * Uses BroadcastChannel API to notify other tabs when matches change.
 * Falls back to localStorage/storage events for browsers without BroadcastChannel.
 *
 * Features:
 * - Broadcasts when a match starts/finishes
 * - Allows other tabs to react to state changes
 * - Fallback for Safari < 15.4 and Firefox Private Mode
 */

import { useEffect, useRef, useCallback } from 'react';
import { BROADCAST_CHANNELS } from '../constants/storage';

// H-3 FIX: Extended message types for comprehensive multi-tab sync
export interface TabSyncMessage {
  type:
    | 'MATCH_ACTIVE'
    | 'MATCH_INACTIVE'
    | 'MATCH_STARTED'
    | 'MATCH_FINISHED'
    | 'MATCH_PAUSED'
    | 'MATCH_RESUMED'
    | 'MATCH_UPDATED';  // Generic update: goals, cards, fouls, etc.
  matchId: string;
  tabId: string;
  timestamp: number;
}

export interface UseMultiTabSyncOptions {
  tournamentId: string;
  onMessage?: (message: TabSyncMessage) => void;
}

export interface UseMultiTabSyncReturn {
  /** Announce that this tab is managing a match */
  announceActive: (matchId: string) => void;
  /** Announce that this tab stopped managing a match */
  announceInactive: (matchId: string) => void;
  /** Announce that a match was started */
  announceMatchStarted: (matchId: string) => void;
  /** Announce that a match was finished */
  announceMatchFinished: (matchId: string) => void;
  /** H-3 FIX: Announce that a match was paused */
  announceMatchPaused: (matchId: string) => void;
  /** H-3 FIX: Announce that a match was resumed */
  announceMatchResumed: (matchId: string) => void;
  /** H-3 FIX: Announce generic match update (goal, card, foul, etc.) */
  announceMatchUpdated: (matchId: string) => void;
}

// Generate unique tab ID
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// Check BroadcastChannel support once at module load
const isBroadcastSupported = typeof BroadcastChannel !== 'undefined';

export function useMultiTabSync({
  tournamentId,
  onMessage,
}: UseMultiTabSyncOptions): UseMultiTabSyncReturn {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const activeMatchIds = useRef<Set<string>>(new Set());

  // Storage key for fallback mechanism
  const fallbackKey = `tab-sync-${tournamentId}`;

  // Initialize BroadcastChannel or Storage fallback
  useEffect(() => {
    if (!tournamentId) {return;}

    // Copy ref value to variable for cleanup function (React hooks rule)
    const currentActiveMatchIds = activeMatchIds.current;

    if (isBroadcastSupported) {
      // Use BroadcastChannel
      try {
        const channel = new BroadcastChannel(`${BROADCAST_CHANNELS.MATCH_MANAGEMENT}-${tournamentId}`);
        channelRef.current = channel;

        channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
          const message = event.data;
          // Ignore messages from this tab
          if (message.tabId === TAB_ID) {return;}
          onMessage?.(message);
        };

        // Announce our active matches when channel opens
        currentActiveMatchIds.forEach((matchId) => {
          channel.postMessage({
            type: 'MATCH_ACTIVE',
            matchId,
            tabId: TAB_ID,
            timestamp: Date.now(),
          } as TabSyncMessage);
        });

        return () => {
          // Announce we're leaving
          currentActiveMatchIds.forEach((matchId) => {
            channel.postMessage({
              type: 'MATCH_INACTIVE',
              matchId,
              tabId: TAB_ID,
              timestamp: Date.now(),
            } as TabSyncMessage);
          });
          channel.close();
          channelRef.current = null;
        };
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[MultiTabSync] Failed to initialize BroadcastChannel:', error);
        }
      }
    } else {
      // Fallback: Use localStorage + storage events
      if (import.meta.env.DEV) {
        console.warn('[MultiTabSync] Using localStorage fallback (BroadcastChannel not supported)');
      }

      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === fallbackKey && event.newValue) {
          try {
            const message = JSON.parse(event.newValue) as TabSyncMessage;
            // Ignore messages from this tab
            if (message.tabId === TAB_ID) {return;}
            onMessage?.(message);
          } catch {
            // Ignore parse errors
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [tournamentId, onMessage, fallbackKey]);

  // Helper to send message via appropriate channel
  const sendMessage = useCallback((message: Omit<TabSyncMessage, 'tabId' | 'timestamp'>) => {
    const fullMessage: TabSyncMessage = {
      ...message,
      tabId: TAB_ID,
      timestamp: Date.now(),
    };

    if (isBroadcastSupported && channelRef.current) {
      channelRef.current.postMessage(fullMessage);
    } else {
      // Fallback: Write to localStorage (triggers storage event in other tabs)
      try {
        localStorage.setItem(fallbackKey, JSON.stringify(fullMessage));
        // Clean up after short delay to avoid cluttering storage
        setTimeout(() => {
          try {
            localStorage.removeItem(fallbackKey);
          } catch {
            // Ignore cleanup errors
          }
        }, 100);
      } catch {
        // Ignore storage errors (e.g., quota exceeded, private mode)
      }
    }
  }, [fallbackKey]);

  const announceActive = useCallback((matchId: string) => {
    activeMatchIds.current.add(matchId);
    sendMessage({ type: 'MATCH_ACTIVE', matchId });
  }, [sendMessage]);

  const announceInactive = useCallback((matchId: string) => {
    activeMatchIds.current.delete(matchId);
    sendMessage({ type: 'MATCH_INACTIVE', matchId });
  }, [sendMessage]);

  const announceMatchStarted = useCallback((matchId: string) => {
    sendMessage({ type: 'MATCH_STARTED', matchId });
  }, [sendMessage]);

  const announceMatchFinished = useCallback((matchId: string) => {
    activeMatchIds.current.delete(matchId);
    sendMessage({ type: 'MATCH_FINISHED', matchId });
  }, [sendMessage]);

  // H-3 FIX: Announce match paused
  const announceMatchPaused = useCallback((matchId: string) => {
    sendMessage({ type: 'MATCH_PAUSED', matchId });
  }, [sendMessage]);

  // H-3 FIX: Announce match resumed
  const announceMatchResumed = useCallback((matchId: string) => {
    sendMessage({ type: 'MATCH_RESUMED', matchId });
  }, [sendMessage]);

  // H-3 FIX: Announce generic match update (goals, cards, fouls, etc.)
  const announceMatchUpdated = useCallback((matchId: string) => {
    sendMessage({ type: 'MATCH_UPDATED', matchId });
  }, [sendMessage]);

  return {
    announceActive,
    announceInactive,
    announceMatchStarted,
    announceMatchFinished,
    announceMatchPaused,
    announceMatchResumed,
    announceMatchUpdated,
  };
}
