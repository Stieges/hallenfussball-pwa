/**
 * useLiveMatches Hook
 *
 * Shared hook for polling live match data from localStorage.
 * Used by MonitorTab and ScheduleTab for real-time match updates.
 *
 * Features:
 * - Polls localStorage every 2 seconds
 * - Listens to storage events for cross-tab updates
 * - Detects goal events by comparing event arrays
 * - Calculates real-time elapsed seconds from timer fields
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../constants/storage';
import type { RuntimeMatchEvent } from '../types/tournament';

// Types - MatchEvent is re-exported from tournament.ts
export type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';
export type MatchEvent = RuntimeMatchEvent;

export interface Team {
  id: string;
  name: string;
  logo?: {
    type: 'url' | 'base64' | 'initials';
    value: string;
    backgroundColor?: string;
    uploadedAt?: string;
    uploadedBy?: 'organizer' | 'trainer';
  };
  colors?: {
    primary: string;
    secondary?: string;
  };
}

export interface LiveMatch {
  id: string;
  number: number;
  phaseLabel: string;
  fieldId: string;
  field?: number;
  scheduledKickoff: string;
  durationSeconds: number;
  refereeName?: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  elapsedSeconds: number;
  events: MatchEvent[];
  timerStartTime?: string;
  timerPausedAt?: string;
  timerElapsedSeconds?: number;
  group?: string;
  // Match Cockpit Pro: Per-match setting overrides
  cockpitOverrides?: import('../types/tournament').MatchCockpitOverrides;
}

export interface GoalEventInfo {
  matchId: string;
  teamId: string;
  teamName: string;
  side: 'home' | 'away';
  timestamp: number;
  newScore: {
    home: number;
    away: number;
  };
}

export interface CardEventInfo {
  matchId: string;
  teamId: string;
  teamName: string;
  side: 'home' | 'away';
  cardType: 'YELLOW' | 'RED';
  playerNumber?: number;
  timestamp: number;
}

export interface UseLiveMatchesReturn {
  /** All live matches from localStorage */
  liveMatches: Map<string, LiveMatch>;
  /** Matches with status RUNNING */
  runningMatches: LiveMatch[];
  /** Matches with status PAUSED */
  pausedMatches: LiveMatch[];
  /** Set of running match IDs (for quick lookup) */
  runningMatchIds: Set<string>;
  /** Get a specific match by ID */
  getMatchById: (matchId: string) => LiveMatch | undefined;
  /** Last detected goal event (for animations) */
  lastGoalEvent: GoalEventInfo | null;
  /** Clear the last goal event (after animation completes) */
  clearLastGoalEvent: () => void;
  /** Last detected card event (for animations) */
  lastCardEvent: CardEventInfo | null;
  /** Clear the last card event (after animation completes) */
  clearLastCardEvent: () => void;
  /** Calculate current elapsed seconds for a match (with real-time timer) */
  calculateElapsedSeconds: (match: LiveMatch) => number;
}

const POLL_INTERVAL = 500; // 500ms for responsive goal updates

/**
 * Calculate elapsed seconds based on timer fields
 */
function calculateMatchElapsedSeconds(match: LiveMatch): number {
  if (match.status === 'NOT_STARTED') {
    return 0;
  }

  if (match.status === 'FINISHED') {
    return match.durationSeconds;
  }

  if (match.status === 'PAUSED' || !match.timerStartTime) {
    return match.timerElapsedSeconds ?? match.elapsedSeconds;
  }

  // RUNNING: Calculate from timestamp
  const startTime = new Date(match.timerStartTime).getTime();
  const now = Date.now();
  const runtimeSeconds = Math.floor((now - startTime) / 1000);
  return (match.timerElapsedSeconds ?? 0) + runtimeSeconds;
}

export function useLiveMatches(tournamentId: string): UseLiveMatchesReturn {
  const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(new Map());
  const [lastGoalEvent, setLastGoalEvent] = useState<GoalEventInfo | null>(null);
  const [lastCardEvent, setLastCardEvent] = useState<CardEventInfo | null>(null);

  // Track seen goal event IDs to avoid duplicate animations
  const seenGoalIds = useRef<Set<string>>(new Set());
  // Track seen card event IDs to avoid duplicate animations
  const seenCardIds = useRef<Set<string>>(new Set());
  // Flag to skip event detection on initial load (don't animate old events)
  const isInitialLoad = useRef(true);

  const storageKey = STORAGE_KEYS.liveMatches(tournamentId);

  /**
   * Parse live matches from localStorage
   */
  const parseLiveMatches = useCallback((): Map<string, LiveMatch> => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {return new Map();}

      const parsed = JSON.parse(stored) as Record<string, LiveMatch> | null;
      if (typeof parsed !== 'object' || parsed === null) {return new Map();}

      return new Map(Object.entries(parsed));
    } catch {
      return new Map();
    }
  }, [storageKey]);

  /**
   * Pre-populate seen event IDs with all existing events
   * Called on initial load to prevent animating old events
   */
  const markAllEventsAsSeen = useCallback((matches: Map<string, LiveMatch>) => {
    for (const [, match] of matches) {
      for (const event of match.events) {
        if (event.type === 'GOAL') {
          seenGoalIds.current.add(event.id);
        } else if (event.type === 'YELLOW_CARD' || event.type === 'RED_CARD') {
          seenCardIds.current.add(event.id);
        }
      }
    }
  }, []);

  /**
   * Detect new goal events by checking event IDs we haven't seen before
   * IMPORTANT: Only detects goals from RUNNING matches
   */
  const detectGoalEvent = useCallback((
    newMatches: Map<string, LiveMatch>
  ): GoalEventInfo | null => {
    for (const [, match] of newMatches) {
      // Only detect goals from RUNNING matches
      if (match.status !== 'RUNNING') {
        // Still mark events as seen to avoid triggering when match resumes
        for (const event of match.events) {
          if (event.type === 'GOAL') {
            seenGoalIds.current.add(event.id);
          }
        }
        continue;
      }

      const events = match.events;

      // Find goal events we haven't seen yet
      for (const event of events) {
        if (
          event.type === 'GOAL' &&
          event.payload.direction === 'INC' &&
          !seenGoalIds.current.has(event.id)
        ) {
          // Mark as seen
          seenGoalIds.current.add(event.id);

          const isHome = event.payload.teamId === match.homeTeam.id;

          return {
            matchId: match.id,
            teamId: event.payload.teamId ?? '',
            teamName: event.payload.teamName || (isHome ? match.homeTeam.name : match.awayTeam.name),
            side: isHome ? 'home' : 'away',
            timestamp: Date.now(),
            newScore: event.scoreAfter,
          };
        }
      }
    }
    return null;
  }, []);

  /**
   * Detect new card events by checking event IDs we haven't seen before
   * IMPORTANT: Only detects cards from RUNNING matches
   */
  const detectCardEvent = useCallback((
    newMatches: Map<string, LiveMatch>
  ): CardEventInfo | null => {
    for (const [, match] of newMatches) {
      // Only detect cards from RUNNING matches
      if (match.status !== 'RUNNING') {
        // Still mark events as seen to avoid triggering when match resumes
        for (const event of match.events) {
          if (event.type === 'YELLOW_CARD' || event.type === 'RED_CARD') {
            seenCardIds.current.add(event.id);
          }
        }
        continue;
      }

      const events = match.events;

      // Find card events we haven't seen yet
      for (const event of events) {
        if (
          (event.type === 'YELLOW_CARD' || event.type === 'RED_CARD') &&
          !seenCardIds.current.has(event.id)
        ) {
          // Mark as seen
          seenCardIds.current.add(event.id);

          const isHome = event.payload.teamId === match.homeTeam.id;

          return {
            matchId: match.id,
            teamId: event.payload.teamId ?? '',
            teamName: event.payload.teamName || (isHome ? match.homeTeam.name : match.awayTeam.name),
            side: isHome ? 'home' : 'away',
            cardType: event.type === 'RED_CARD' ? 'RED' : 'YELLOW',
            playerNumber: event.payload.playerNumber,
            timestamp: Date.now(),
          };
        }
      }
    }
    return null;
  }, []);

  /**
   * Update state from localStorage
   */
  const updateFromStorage = useCallback(() => {
    const newMatches = parseLiveMatches();

    // On initial load, mark all existing events as seen (don't animate old events)
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      markAllEventsAsSeen(newMatches);
    } else {
      // Only detect new events after initial load
      const goalEvent = detectGoalEvent(newMatches);
      if (goalEvent) {
        setLastGoalEvent(goalEvent);
      }
      const cardEvent = detectCardEvent(newMatches);
      if (cardEvent) {
        setLastCardEvent(cardEvent);
      }
    }

    setLiveMatches(prev => {
      // Only update if data changed
      const prevJson = JSON.stringify(Object.fromEntries(prev));
      const newJson = JSON.stringify(Object.fromEntries(newMatches));
      if (prevJson === newJson) {return prev;}
      return newMatches;
    });
  }, [parseLiveMatches, detectGoalEvent, detectCardEvent, markAllEventsAsSeen]);

  // Initial load and polling
  useEffect(() => {
    // Initial update
    updateFromStorage();

    // Poll every 2 seconds
    const interval = setInterval(updateFromStorage, POLL_INTERVAL);

    // Listen for storage events (cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        updateFromStorage();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, updateFromStorage]);

  // Derived state
  const runningMatches = useMemo(
    () => Array.from(liveMatches.values()).filter(m => m.status === 'RUNNING'),
    [liveMatches]
  );

  const pausedMatches = useMemo(
    () => Array.from(liveMatches.values()).filter(m => m.status === 'PAUSED'),
    [liveMatches]
  );

  const runningMatchIds = useMemo(
    () => new Set(runningMatches.map(m => m.id)),
    [runningMatches]
  );

  const getMatchById = useCallback(
    (matchId: string) => liveMatches.get(matchId),
    [liveMatches]
  );

  const clearLastGoalEvent = useCallback(() => {
    setLastGoalEvent(null);
  }, []);

  const clearLastCardEvent = useCallback(() => {
    setLastCardEvent(null);
  }, []);

  const calculateElapsedSeconds = useCallback(
    (match: LiveMatch) => calculateMatchElapsedSeconds(match),
    []
  );

  return {
    liveMatches,
    runningMatches,
    pausedMatches,
    runningMatchIds,
    getMatchById,
    lastGoalEvent,
    clearLastGoalEvent,
    lastCardEvent,
    clearLastCardEvent,
    calculateElapsedSeconds,
  };
}
