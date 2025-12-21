/**
 * useLiveMatchManagement Hook
 *
 * Manages live match state for the ManagementTab (Turnierleitung).
 * Extracted from ManagementTab for better testability and separation of concerns.
 *
 * Features:
 * - localStorage persistence for crash safety (DEF-005)
 * - Timer management with timestamp-based calculation
 * - Event tracking for goals, status changes, and result edits
 * - Handlers for all match operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Tournament } from '../types/tournament';
import { ScheduledMatch } from '../lib/scheduleGenerator';
import {
  LiveMatch,
  MatchStatus,
  MatchEvent,
} from '../components/match-cockpit/MatchCockpit';
import { autoResolvePlayoffsIfReady, resolveBracketAfterPlayoffMatch } from '../utils/playoffResolver';
import { STORAGE_KEYS } from '../constants/storage';
import { useMultiTabSync, TabSyncMessage } from './useMultiTabSync';

export interface UseLiveMatchManagementProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  /** Called when another tab is managing the same match */
  onMultiTabConflict?: (message: TabSyncMessage) => void;
}

export interface UseLiveMatchManagementReturn {
  /** Map of all live matches */
  liveMatches: Map<string, LiveMatch>;
  /** Get or create LiveMatch data for a scheduled match */
  getLiveMatchData: (matchData: ScheduledMatch) => LiveMatch;
  /** Start a match */
  handleStart: (matchId: string) => Promise<boolean>;
  /** Pause a match */
  handlePause: (matchId: string) => void;
  /** Resume a paused match */
  handleResume: (matchId: string) => void;
  /** Finish a match */
  handleFinish: (matchId: string) => void;
  /** Record a goal */
  handleGoal: (matchId: string, teamId: string, delta: 1 | -1) => void;
  /** Undo last event */
  handleUndoLastEvent: (matchId: string) => void;
  /** Manually edit result */
  handleManualEditResult: (matchId: string, newHomeScore: number, newAwayScore: number) => void;
  /** Adjust elapsed time */
  handleAdjustTime: (matchId: string, newElapsedSeconds: number) => void;
  /** Reopen a finished match */
  handleReopenMatch: (matchData: ScheduledMatch) => void;
  /** Check if any match is currently running */
  hasRunningMatch: () => LiveMatch | undefined;
}

const TIMER_INTERVAL_MS = 1000;

/**
 * Calculate the real-time elapsed seconds for a match.
 * This is more accurate than match.elapsedSeconds which is only updated every 1000ms.
 * Use this for event timestamps to ensure accuracy within ~50ms.
 */
function calculateRealTimeElapsed(match: LiveMatch): number {
  if (match.status !== 'RUNNING' || !match.timerStartTime) {
    return match.elapsedSeconds;
  }
  const startTime = new Date(match.timerStartTime).getTime();
  const runtimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  return (match.timerElapsedSeconds || 0) + runtimeSeconds;
}

export function useLiveMatchManagement({
  tournament,
  onTournamentUpdate,
  onMultiTabConflict,
}: UseLiveMatchManagementProps): UseLiveMatchManagementReturn {
  const storageKey = STORAGE_KEYS.liveMatches(tournament.id);

  // Multi-tab synchronization
  const { announceMatchStarted, announceMatchFinished } = useMultiTabSync({
    tournamentId: tournament.id,
    onConflict: onMultiTabConflict,
  });

  // Initialize from localStorage
  const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch {
      // Ignore parse errors
    }
    return new Map();
  });

  // Ref to current tournament for use in callbacks
  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;

  // Persist to localStorage on changes
  useEffect(() => {
    const obj = Object.fromEntries(liveMatches.entries());
    localStorage.setItem(storageKey, JSON.stringify(obj));
  }, [liveMatches, storageKey]);

  // DEF-005: beforeunload handler for crash safety
  useEffect(() => {
    const handleBeforeUnload = () => {
      const obj = Object.fromEntries(liveMatches.entries());
      localStorage.setItem(storageKey, JSON.stringify(obj));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [liveMatches, storageKey]);

  // Timer for running matches (DEF-005: Timestamp-based calculation)
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMatches(prev => {
        const updated = new Map(prev);
        let hasChanges = false;

        updated.forEach((match, matchId) => {
          if (match.status === 'RUNNING' && match.timerStartTime) {
            const startTime = new Date(match.timerStartTime).getTime();
            const now = Date.now();
            const runtimeSeconds = Math.floor((now - startTime) / 1000);
            const totalElapsed = (match.timerElapsedSeconds || 0) + runtimeSeconds;

            updated.set(matchId, {
              ...match,
              elapsedSeconds: totalElapsed,
            });
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }, TIMER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  /**
   * Get or create LiveMatch data for a scheduled match
   */
  const getLiveMatchData = useCallback((matchData: ScheduledMatch): LiveMatch => {
    const existing = liveMatches.get(matchData.id);
    if (existing) {
      return existing;
    }

    const newMatch: LiveMatch = {
      id: matchData.id,
      number: matchData.matchNumber,
      phaseLabel: matchData.label || (matchData.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
      fieldId: `field-${matchData.field}`,
      scheduledKickoff: matchData.time,
      durationSeconds: (tournamentRef.current.groupPhaseGameDuration || tournamentRef.current.gameDuration || 10) * 60,
      refereeName: matchData.referee ? `SR ${matchData.referee}` : undefined,
      homeTeam: { id: matchData.homeTeam, name: matchData.homeTeam },
      awayTeam: { id: matchData.awayTeam, name: matchData.awayTeam },
      homeScore: matchData.scoreA || 0,
      awayScore: matchData.scoreB || 0,
      status: 'NOT_STARTED' as MatchStatus,
      elapsedSeconds: 0,
      events: [],
    };

    // Save immediately
    setLiveMatches(prev => {
      const updated = new Map(prev);
      updated.set(matchData.id, newMatch);
      return updated;
    });

    return newMatch;
  }, [liveMatches]);

  /**
   * Check if any match is currently running
   */
  const hasRunningMatch = useCallback((): LiveMatch | undefined => {
    return Array.from(liveMatches.values()).find(m => m.status === 'RUNNING');
  }, [liveMatches]);

  /**
   * Create a status change event with accurate real-time timestamp
   */
  const createStatusEvent = (match: LiveMatch, toStatus: MatchStatus): MatchEvent => ({
    id: `${match.id}-${Date.now()}`,
    matchId: match.id,
    timestampSeconds: calculateRealTimeElapsed(match),
    type: 'STATUS_CHANGE',
    payload: { toStatus },
    scoreAfter: {
      home: match.homeScore,
      away: match.awayScore,
    },
  });

  /**
   * Start a match - returns true if started, false if cancelled
   */
  const handleStart = useCallback(async (matchId: string): Promise<boolean> => {
    const match = liveMatches.get(matchId);
    if (!match) {
      console.error('handleStart: Match not found:', matchId);
      return false;
    }

    const hasExistingResult = match.homeScore > 0 || match.awayScore > 0;

    // If there are existing results, the caller should handle confirmation
    // This allows for custom modal dialogs instead of window.confirm
    if (hasExistingResult && match.status === 'NOT_STARTED') {
      // Return false to indicate confirmation is needed
      // The actual start will be done via handleStartConfirmed
      return false;
    }

    // Normal start
    const event = createStatusEvent(match, 'RUNNING');

    setLiveMatches(prev => {
      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'RUNNING' as MatchStatus,
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: match.elapsedSeconds || 0,
        timerPausedAt: undefined,
        events: [...match.events, event],
      });
      return updated;
    });

    // Announce to other tabs
    announceMatchStarted(matchId);

    return true;
  }, [liveMatches, announceMatchStarted]);

  /**
   * Pause a match
   */
  const handlePause = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handlePause: Match not found:', matchId);
        return prev;
      }

      const event = createStatusEvent(match, 'PAUSED');

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'PAUSED' as MatchStatus,
        timerPausedAt: new Date().toISOString(),
        timerElapsedSeconds: match.elapsedSeconds,
        events: [...match.events, event],
      });
      return updated;
    });
  }, []);

  /**
   * Resume a paused match
   */
  const handleResume = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleResume: Match not found:', matchId);
        return prev;
      }

      const event = createStatusEvent(match, 'RUNNING');

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'RUNNING' as MatchStatus,
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: match.elapsedSeconds,
        timerPausedAt: undefined,
        events: [...match.events, event],
      });
      return updated;
    });
  }, []);

  /**
   * Finish a match
   */
  const handleFinish = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleFinish: Match not found:', matchId);
        return prev;
      }

      // Update tournament.matches with TL-RESULT-LOCK-01: matchStatus
      const updatedMatches = tournamentRef.current.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: match.homeScore,
            scoreB: match.awayScore,
            matchStatus: 'finished' as const,
            finishedAt: new Date().toISOString(),
          };
        }
        return m;
      });

      const updatedTournament = {
        ...tournamentRef.current,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      onTournamentUpdate(updatedTournament, false);

      // Auto-resolve playoffs if ready
      const playoffResolution = autoResolvePlayoffsIfReady(updatedTournament);
      if (playoffResolution?.wasResolved) {
        console.log('✅ Playoff-Paarungen automatisch aufgelöst:', playoffResolution);
        onTournamentUpdate(updatedTournament, false);
      }

      // Resolve bracket placeholders after playoff matches
      const bracketResolution = resolveBracketAfterPlayoffMatch(updatedTournament);
      if (bracketResolution?.wasResolved) {
        console.log('✅ Bracket-Paarungen automatisch aufgelöst:', bracketResolution);
        onTournamentUpdate(updatedTournament, false);
      }

      const event = createStatusEvent(match, 'FINISHED');

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'FINISHED' as MatchStatus,
        elapsedSeconds: match.durationSeconds,
        events: [...match.events, event],
      });

      return updated;
    });

    // Announce to other tabs
    announceMatchFinished(matchId);
  }, [onTournamentUpdate, announceMatchFinished]);

  /**
   * Record a goal
   */
  const handleGoal = useCallback((matchId: string, teamId: string, delta: 1 | -1) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleGoal: Match not found:', matchId);
        return prev;
      }

      const isHomeTeam = match.homeTeam.id === teamId || match.homeTeam.name === teamId;
      const newHomeScore = isHomeTeam ? Math.max(0, match.homeScore + delta) : match.homeScore;
      const newAwayScore = !isHomeTeam ? Math.max(0, match.awayScore + delta) : match.awayScore;

      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: calculateRealTimeElapsed(match),
        type: 'GOAL',
        payload: {
          teamId: isHomeTeam ? match.homeTeam.id : match.awayTeam.id,
          teamName: isHomeTeam ? match.homeTeam.name : match.awayTeam.name,
          direction: delta > 0 ? 'INC' : 'DEC',
        },
        scoreAfter: {
          home: newHomeScore,
          away: newAwayScore,
        },
      };

      // Update tournament.matches
      const updatedMatches = tournamentRef.current.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: newHomeScore,
            scoreB: newAwayScore,
          };
        }
        return m;
      });

      const updatedTournament = {
        ...tournamentRef.current,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      onTournamentUpdate(updatedTournament, false);

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events: [...match.events, event],
      });
      return updated;
    });
  }, [onTournamentUpdate]);

  /**
   * Undo last event
   */
  const handleUndoLastEvent = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match || match.events.length === 0) {
        console.error('handleUndoLastEvent: No events to undo');
        return prev;
      }

      const events = [...match.events];
      events.pop();

      const previousEvent = events[events.length - 1];
      const { home, away } = previousEvent.scoreAfter || { home: 0, away: 0 };

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: home,
        awayScore: away,
        events,
      });
      return updated;
    });
  }, []);

  /**
   * Manually edit result
   */
  const handleManualEditResult = useCallback((matchId: string, newHomeScore: number, newAwayScore: number) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleManualEditResult: Match not found:', matchId);
        return prev;
      }

      const event: MatchEvent = {
        id: `${matchId}-${Date.now()}`,
        matchId,
        timestampSeconds: calculateRealTimeElapsed(match),
        type: 'RESULT_EDIT',
        payload: {
          newHomeScore,
          newAwayScore,
        },
        scoreAfter: {
          home: newHomeScore,
          away: newAwayScore,
        },
      };

      // TL-RESULT-LOCK-01: Track correction history for finished matches
      const updatedMatches = tournamentRef.current.matches.map(m => {
        if (m.id === matchId) {
          const isFinished = m.matchStatus === 'finished';
          const previousScoreA = m.scoreA ?? 0;
          const previousScoreB = m.scoreB ?? 0;

          const correctionEntry = isFinished && (previousScoreA !== newHomeScore || previousScoreB !== newAwayScore) ? {
            timestamp: new Date().toISOString(),
            previousScoreA,
            previousScoreB,
            newScoreA: newHomeScore,
            newScoreB: newAwayScore,
          } : null;

          return {
            ...m,
            scoreA: newHomeScore,
            scoreB: newAwayScore,
            ...(correctionEntry ? {
              correctionHistory: [...(m.correctionHistory || []), correctionEntry],
            } : {}),
          };
        }
        return m;
      });

      const updatedTournament = {
        ...tournamentRef.current,
        matches: updatedMatches,
        updatedAt: new Date().toISOString(),
      };

      onTournamentUpdate(updatedTournament, false);

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events: [...match.events, event],
      });
      return updated;
    });
  }, [onTournamentUpdate]);

  /**
   * Adjust elapsed time
   */
  const handleAdjustTime = useCallback((matchId: string, newElapsedSeconds: number) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleAdjustTime: Match not found:', matchId);
        return prev;
      }

      const adjustedTime = Math.max(0, Math.min(newElapsedSeconds, match.durationSeconds));

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        elapsedSeconds: adjustedTime,
        timerElapsedSeconds: adjustedTime,
      });
      return updated;
    });
  }, []);

  /**
   * Reopen a finished match
   */
  const handleReopenMatch = useCallback((matchData: ScheduledMatch) => {
    const reopenedMatch: LiveMatch = {
      id: matchData.id,
      number: matchData.matchNumber,
      phaseLabel: matchData.label || (matchData.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
      fieldId: `field-${matchData.field}`,
      scheduledKickoff: matchData.time,
      durationSeconds: (tournamentRef.current.groupPhaseGameDuration || tournamentRef.current.gameDuration || 10) * 60,
      refereeName: matchData.referee ? `SR ${matchData.referee}` : undefined,
      homeTeam: { id: matchData.homeTeam, name: matchData.homeTeam },
      awayTeam: { id: matchData.awayTeam, name: matchData.awayTeam },
      homeScore: matchData.scoreA || 0,
      awayScore: matchData.scoreB || 0,
      status: 'PAUSED' as MatchStatus,
      elapsedSeconds: 0,
      events: [],
    };

    setLiveMatches(prev => {
      const updated = new Map(prev);
      updated.set(matchData.id, reopenedMatch);
      return updated;
    });
  }, []);

  return {
    liveMatches,
    getLiveMatchData,
    handleStart,
    handlePause,
    handleResume,
    handleFinish,
    handleGoal,
    handleUndoLastEvent,
    handleManualEditResult,
    handleAdjustTime,
    handleReopenMatch,
    hasRunningMatch,
  };
}
