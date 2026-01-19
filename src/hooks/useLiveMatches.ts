/**
 * useLiveMatches Hook
 *
 * Shared hook for live match data with Supabase Realtime support.
 * Used by MonitorTab and ScheduleTab for real-time match updates.
 *
 * Features:
 * - Uses Supabase Realtime when authenticated (instant updates)
 * - Falls back to localStorage polling for guest users
 * - Listens to storage events for cross-tab updates (localStorage only)
 * - Detects goal events by comparing event arrays
 * - Calculates real-time elapsed seconds from timer fields
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../constants/storage';
import type { RuntimeMatchEvent } from '../types/tournament';
import { useRepositories } from '../core/contexts/RepositoryContext';
import type { LiveMatch as CoreLiveMatch } from '../core/models/LiveMatch';

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

const POLL_INTERVAL = 500; // 500ms for responsive goal updates (localStorage only)
const REALTIME_TIMER_INTERVAL = 1000; // 1s timer refresh for Realtime mode

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

/**
 * Convert CoreLiveMatch to local LiveMatch type
 */
function coreToLocalMatch(coreMatch: CoreLiveMatch): LiveMatch {
  return {
    id: coreMatch.id,
    number: coreMatch.number,
    phaseLabel: coreMatch.phaseLabel,
    fieldId: coreMatch.fieldId,
    scheduledKickoff: coreMatch.scheduledKickoff,
    durationSeconds: coreMatch.durationSeconds,
    refereeName: coreMatch.refereeName,
    homeTeam: coreMatch.homeTeam,
    awayTeam: coreMatch.awayTeam,
    homeScore: coreMatch.homeScore,
    awayScore: coreMatch.awayScore,
    status: coreMatch.status,
    elapsedSeconds: coreMatch.elapsedSeconds,
    events: coreMatch.events.map(e => ({
      id: e.id,
      matchId: e.matchId,
      timestamp: e.timestampSeconds,
      type: e.type,
      scoreAfter: e.scoreAfter,
      payload: {
        teamId: e.payload.team === 'home' ? coreMatch.homeTeam.id : coreMatch.awayTeam.id,
        teamName: e.payload.team === 'home' ? coreMatch.homeTeam.name : coreMatch.awayTeam.name,
        direction: e.payload.delta === 1 ? 'INC' : e.payload.delta === -1 ? 'DEC' : undefined,
        delta: e.payload.delta,
        playerNumber: e.payload.playerNumber,
        cardType: e.payload.cardType,
      },
    })) as unknown as MatchEvent[],
    timerStartTime: coreMatch.timerStartTime,
    timerPausedAt: coreMatch.timerPausedAt,
    timerElapsedSeconds: coreMatch.timerElapsedSeconds,
  };
}

export function useLiveMatches(tournamentId: string): UseLiveMatchesReturn {
  const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(new Map());
  const [lastGoalEvent, setLastGoalEvent] = useState<GoalEventInfo | null>(null);
  const [lastCardEvent, setLastCardEvent] = useState<CardEventInfo | null>(null);

  // Get repository context for Realtime support
  const { liveMatchRepository, isRealtimeEnabled, supabaseLiveMatchRepo } = useRepositories();

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
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty teamName should use fallback
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
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty teamName should use fallback
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

  // Helper to update matches from repository (for Realtime mode)
  const loadFromRepository = useCallback(async () => {
    const matches = await liveMatchRepository.getAll(tournamentId);
    const converted = new Map<string, LiveMatch>();
    matches.forEach((match, id) => {
      converted.set(id, coreToLocalMatch(match));
    });

    // Apply event detection logic
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      markAllEventsAsSeen(converted);
    } else {
      const goalEvent = detectGoalEvent(converted);
      if (goalEvent) {
        setLastGoalEvent(goalEvent);
      }
      const cardEvent = detectCardEvent(converted);
      if (cardEvent) {
        setLastCardEvent(cardEvent);
      }
    }

    setLiveMatches(converted);
  }, [liveMatchRepository, tournamentId, markAllEventsAsSeen, detectGoalEvent, detectCardEvent]);

  // Realtime subscription handler
  const handleRealtimeChange = useCallback((matchId: string, match: CoreLiveMatch | null) => {
    if (!match) {
      // Match deleted
      setLiveMatches(prev => {
        const next = new Map(prev);
        next.delete(matchId);
        return next;
      });
      return;
    }

    const converted = coreToLocalMatch(match);

    // Detect events
    const singleMap = new Map<string, LiveMatch>([[matchId, converted]]);
    const goalEvent = detectGoalEvent(singleMap);
    if (goalEvent) {
      setLastGoalEvent(goalEvent);
    }
    const cardEvent = detectCardEvent(singleMap);
    if (cardEvent) {
      setLastCardEvent(cardEvent);
    }

    setLiveMatches(prev => new Map(prev).set(matchId, converted));
  }, [detectGoalEvent, detectCardEvent]);

  // Initial load and subscribe/poll based on mode
  useEffect(() => {
    // Reset initial load flag when tournament changes
    isInitialLoad.current = true;

    if (isRealtimeEnabled && supabaseLiveMatchRepo) {
      // Realtime mode: Subscribe to changes
      void loadFromRepository();

      supabaseLiveMatchRepo.subscribe(tournamentId, {
        onMatchChange: handleRealtimeChange,
        onError: (error) => {
          console.error('Realtime subscription error:', error);
          // Could fall back to polling here if needed
        },
      });

      // Timer update for running matches (Realtime doesn't push timer updates)
      const timerInterval = setInterval(() => {
        setLiveMatches(prev => {
          const hasRunning = Array.from(prev.values()).some(m => m.status === 'RUNNING' && m.timerStartTime);
          if (!hasRunning) {return prev;}

          const updated = new Map(prev);
          updated.forEach((match, id) => {
            if (match.status === 'RUNNING' && match.timerStartTime) {
              const elapsed = calculateMatchElapsedSeconds(match);
              updated.set(id, { ...match, elapsedSeconds: elapsed });
            }
          });
          return updated;
        });
      }, REALTIME_TIMER_INTERVAL);

      return () => {
        supabaseLiveMatchRepo.unsubscribe(tournamentId);
        clearInterval(timerInterval);
      };
    } else {
      // localStorage mode: Poll for changes
      updateFromStorage();

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
    }
  }, [tournamentId, storageKey, updateFromStorage, isRealtimeEnabled, supabaseLiveMatchRepo, loadFromRepository, handleRealtimeChange]);

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
