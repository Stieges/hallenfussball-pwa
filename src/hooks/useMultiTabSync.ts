/**
 * useMultiTabSync Hook
 *
 * Provides multi-tab conflict detection for match management.
 * Uses BroadcastChannel API to sync state between browser tabs.
 *
 * Features:
 * - Broadcasts when a match starts being managed
 * - Warns when another tab starts managing the same match
 * - Cleans up when tab closes or match is no longer managed
 */

import { useEffect, useRef, useCallback } from 'react';
import { BROADCAST_CHANNELS } from '../constants/storage';

export interface TabSyncMessage {
  type: 'MATCH_ACTIVE' | 'MATCH_INACTIVE' | 'MATCH_STARTED' | 'MATCH_FINISHED';
  matchId: string;
  tabId: string;
  timestamp: number;
}

export interface UseMultiTabSyncOptions {
  tournamentId: string;
  onConflict?: (message: TabSyncMessage) => void;
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
}

// Generate unique tab ID
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useMultiTabSync({
  tournamentId,
  onConflict,
}: UseMultiTabSyncOptions): UseMultiTabSyncReturn {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const activeMatchIds = useRef<Set<string>>(new Set());

  // Initialize BroadcastChannel
  useEffect(() => {
    try {
      // BroadcastChannel is not supported in all browsers (e.g., Safari < 15.4)
      if (typeof BroadcastChannel === 'undefined') {
        console.warn('[MultiTabSync] BroadcastChannel not supported in this browser');
        return;
      }

      const channel = new BroadcastChannel(`${BROADCAST_CHANNELS.MATCH_MANAGEMENT}-${tournamentId}`);
      channelRef.current = channel;

      channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
        const message = event.data;

        // Ignore messages from this tab
        if (message.tabId === TAB_ID) {return;}

        // Check for conflicts
        if (
          (message.type === 'MATCH_ACTIVE' || message.type === 'MATCH_STARTED') &&
          activeMatchIds.current.has(message.matchId)
        ) {
          console.warn(`[MultiTabSync] Conflict detected: Match ${message.matchId} is active in another tab`);
          onConflict?.(message);
        }
      };

      // Announce our active matches when channel opens
      // (in case another tab just opened)
      activeMatchIds.current.forEach((matchId) => {
        channel.postMessage({
          type: 'MATCH_ACTIVE',
          matchId,
          tabId: TAB_ID,
          timestamp: Date.now(),
        } as TabSyncMessage);
      });

      return () => {
        // Announce we're leaving
        activeMatchIds.current.forEach((matchId) => {
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
      console.error('[MultiTabSync] Failed to initialize BroadcastChannel:', error);
    }
  }, [tournamentId, onConflict]);

  const announceActive = useCallback((matchId: string) => {
    activeMatchIds.current.add(matchId);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'MATCH_ACTIVE',
        matchId,
        tabId: TAB_ID,
        timestamp: Date.now(),
      } as TabSyncMessage);
    }
  }, []);

  const announceInactive = useCallback((matchId: string) => {
    activeMatchIds.current.delete(matchId);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'MATCH_INACTIVE',
        matchId,
        tabId: TAB_ID,
        timestamp: Date.now(),
      } as TabSyncMessage);
    }
  }, []);

  const announceMatchStarted = useCallback((matchId: string) => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'MATCH_STARTED',
        matchId,
        tabId: TAB_ID,
        timestamp: Date.now(),
      } as TabSyncMessage);
    }
  }, []);

  const announceMatchFinished = useCallback((matchId: string) => {
    activeMatchIds.current.delete(matchId);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'MATCH_FINISHED',
        matchId,
        tabId: TAB_ID,
        timestamp: Date.now(),
      } as TabSyncMessage);
    }
  }, []);

  return {
    announceActive,
    announceInactive,
    announceMatchStarted,
    announceMatchFinished,
  };
}
