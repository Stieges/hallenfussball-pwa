/**
 * useMultiTabSync Hook
 *
 * Provides multi-tab synchronization for match management.
 * Uses BroadcastChannel API to notify other tabs when matches change.
 *
 * Features:
 * - Broadcasts when a match starts/finishes
 * - Allows other tabs to react to state changes
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
}

// Generate unique tab ID
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useMultiTabSync({
  tournamentId,
  onMessage,
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

        // Notify listener if provided
        onMessage?.(message);
      };

      // Announce our active matches when channel opens
      // Copy ref value to variable for cleanup function (React hooks rule)
      const currentActiveMatchIds = activeMatchIds.current;
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
      console.error('[MultiTabSync] Failed to initialize BroadcastChannel:', error);
    }
  }, [tournamentId, onMessage]);

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
