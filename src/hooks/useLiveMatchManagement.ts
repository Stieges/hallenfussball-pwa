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
import { useMultiTabSync } from './useMultiTabSync';
import { safeLocalStorageSet } from '../utils/storageCleanup';

export interface UseLiveMatchManagementProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
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
  /** Finish a match (with tiebreaker check) */
  handleFinish: (matchId: string) => void;
  /** Force finish a match (skip tiebreaker check) */
  handleForceFinish: (matchId: string) => void;
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
  // Tiebreaker handlers
  /** Start overtime (Verlängerung) */
  handleStartOvertime: (matchId: string) => void;
  /** Start golden goal */
  handleStartGoldenGoal: (matchId: string) => void;
  /** Start penalty shootout */
  handleStartPenaltyShootout: (matchId: string) => void;
  /** Record penalty result and finish */
  handleRecordPenaltyResult: (matchId: string, homeScore: number, awayScore: number) => void;
  /** Cancel tiebreaker and finish as draw */
  handleCancelTiebreaker: (matchId: string) => void;
  // US-SCHEDULE-EDITOR: Skip match handlers
  /** Skip a match (e.g., team withdrew) */
  handleSkipMatch: (matchId: string, reason: string) => void;
  /** Restore a skipped match */
  handleUnskipMatch: (matchId: string) => void;
}

// MF-002: Interval für Persistenz erhöht (Display wird jetzt lokal berechnet)
const PERSIST_INTERVAL_MS = 5000;

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
  return (match.timerElapsedSeconds ?? 0) + runtimeSeconds;
}

/**
 * Helper: Check if a team reference is a placeholder (not a real team ID)
 * BUG-FIX: Used for proper team resolution in finals
 */
function isPlaceholderTeamRef(teamRef: string): boolean {
  return (
    teamRef === 'TBD' ||
    teamRef.includes('-winner') ||
    teamRef.includes('-loser') ||
    teamRef.startsWith('group-') ||
    teamRef.startsWith('semi') ||
    teamRef.startsWith('quarter') ||
    teamRef.startsWith('final')
  );
}

export function useLiveMatchManagement({
  tournament,
  onTournamentUpdate,
}: UseLiveMatchManagementProps): UseLiveMatchManagementReturn {
  const storageKey = STORAGE_KEYS.liveMatches(tournament.id);

  // Multi-tab synchronization (broadcasts to other tabs, no conflict detection)
  const { announceMatchStarted, announceMatchFinished } = useMultiTabSync({
    tournamentId: tournament.id,
  });

  // Initialize from localStorage
  const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, LiveMatch>;
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
  // BUG-CRIT-003 FIX: Use safe storage function with quota handling
  useEffect(() => {
    const obj = Object.fromEntries(liveMatches.entries());
    const data = JSON.stringify(obj);
    safeLocalStorageSet(storageKey, data);
  }, [liveMatches, storageKey]);

  // DEF-005: beforeunload handler for crash safety
  // BUG-CRIT-003 FIX: Use safe storage function
  useEffect(() => {
    const handleBeforeUnload = () => {
      const obj = Object.fromEntries(liveMatches.entries());
      const data = JSON.stringify(obj);
      safeLocalStorageSet(storageKey, data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [liveMatches, storageKey]);

  // Timer for running matches (DEF-005: Timestamp-based calculation)
  // BUG-MOD-002 FIX: Added visibility change handler to save resources when tab is hidden
  useEffect(() => {
    let interval: number | null = null;

    const updateTimers = () => {
      setLiveMatches(prev => {
        const updated = new Map(prev);
        let changesCount = 0;

        updated.forEach((match, matchId) => {
          if (match.status === 'RUNNING' && match.timerStartTime) {
            const startTime = new Date(match.timerStartTime).getTime();
            const now = Date.now();
            const runtimeSeconds = Math.floor((now - startTime) / 1000);
            const totalElapsed = (match.timerElapsedSeconds ?? 0) + runtimeSeconds;

            updated.set(matchId, {
              ...match,
              elapsedSeconds: totalElapsed,
            });
            changesCount++;
          }
        });

        return changesCount > 0 ? updated : prev;
      });
    };

    const startTimer = () => {
      if (interval === null) {
        // Immediately update on start to sync after visibility change
        updateTimers();
        interval = window.setInterval(updateTimers, PERSIST_INTERVAL_MS);
      }
    };

    const stopTimer = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    // BUG-MOD-002: Pause timer when tab is hidden to save battery/CPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    };

    // Start timer if tab is visible
    if (!document.hidden) {
      startTimer();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Get or create LiveMatch data for a scheduled match
   * BUG-FIX: Properly resolve team IDs and names for finals
   */
  const getLiveMatchData = useCallback((matchData: ScheduledMatch): LiveMatch => {
    const existing = liveMatches.get(matchData.id);
    if (existing) {
      return existing;
    }

    // Get tiebreaker config from tournament
    const tiebreakerMode = tournamentRef.current.finalsConfig?.tiebreaker;
    const tiebreakerDuration = tournamentRef.current.finalsConfig?.tiebreakerDuration ?? 5;

    // BUG-FIX: Resolve team IDs and names properly
    // Use originalTeamA/B as actual IDs, and resolve names from tournament.teams
    const homeId = matchData.originalTeamA || matchData.homeTeam;
    const awayId = matchData.originalTeamB || matchData.awayTeam;

    // Resolve team names from tournament
    let homeName = matchData.homeTeam; // Display name (could be translated placeholder)
    let awayName = matchData.awayTeam;

    if (!isPlaceholderTeamRef(homeId)) {
      const team = tournamentRef.current.teams.find(t => t.id === homeId);
      if (team) {homeName = team.name;}
    }

    if (!isPlaceholderTeamRef(awayId)) {
      const team = tournamentRef.current.teams.find(t => t.id === awayId);
      if (team) {awayName = team.name;}
    }

    const newMatch: LiveMatch = {
      id: matchData.id,
      number: matchData.matchNumber,
      phaseLabel: matchData.label || (matchData.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
      fieldId: `field-${matchData.field}`,
      scheduledKickoff: matchData.time,
      durationSeconds: tournamentRef.current.groupPhaseGameDuration * 60,
      refereeName: matchData.referee ? `SR ${matchData.referee}` : undefined,
      homeTeam: { id: homeId, name: homeName },
      awayTeam: { id: awayId, name: awayName },
      homeScore: matchData.scoreA ?? 0,
      awayScore: matchData.scoreB ?? 0,
      status: 'NOT_STARTED' as MatchStatus,
      elapsedSeconds: 0,
      events: [],
      // Tiebreaker fields
      tournamentPhase: matchData.phase,
      playPhase: 'regular',
      tiebreakerMode: tiebreakerMode,
      overtimeDurationSeconds: tiebreakerDuration * 60,
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
        timerElapsedSeconds: match.elapsedSeconds,
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
   * Check if a match is a finals match (not group stage)
   */
  const isFinalsMatch = (match: LiveMatch): boolean => {
    return match.tournamentPhase !== undefined && match.tournamentPhase !== 'groupStage';
  };

  /**
   * Check if match ended in a draw and needs tiebreaker
   */
  const needsTiebreaker = (match: LiveMatch): boolean => {
    if (!isFinalsMatch(match)) {return false;}
    if (!match.tiebreakerMode) {return false;} // No tiebreaker configured
    if (match.playPhase === 'penalty') {return false;} // Already in penalty shootout

    // Check if current phase ended in draw
    if (match.playPhase === 'regular' || match.playPhase === undefined) {
      return match.homeScore === match.awayScore;
    }
    // playPhase is 'overtime' | 'goldenGoal' at this point
    // Overtime/Golden Goal ended in draw - need penalty shootout
    const totalHomeScore = match.homeScore + (match.overtimeScoreA ?? 0);
    const totalAwayScore = match.awayScore + (match.overtimeScoreB ?? 0);
    return totalHomeScore === totalAwayScore;
  };

  /**
   * Internal function to actually finish a match
   */
  const finishMatchInternal = useCallback((matchId: string, decidedBy: 'regular' | 'overtime' | 'goldenGoal' | 'penalty' = 'regular') => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('finishMatchInternal: Match not found:', matchId);
        return prev;
      }

      // Calculate final scores including overtime
      const finalHomeScore = match.homeScore + (match.overtimeScoreA ?? 0);
      const finalAwayScore = match.awayScore + (match.overtimeScoreB ?? 0);

      // Update tournament.matches with TL-RESULT-LOCK-01: matchStatus
      const updatedMatches = tournamentRef.current.matches.map(m => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: finalHomeScore,
            scoreB: finalAwayScore,
            matchStatus: 'finished' as const,
            finishedAt: new Date().toISOString(),
            // Tiebreaker info
            overtimeScoreA: match.overtimeScoreA,
            overtimeScoreB: match.overtimeScoreB,
            penaltyScoreA: match.penaltyScoreA,
            penaltyScoreB: match.penaltyScoreB,
            decidedBy: decidedBy,
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
        onTournamentUpdate(updatedTournament, false);
      }

      // Resolve bracket placeholders after playoff matches
      const bracketResolution = resolveBracketAfterPlayoffMatch(updatedTournament);
      if (bracketResolution?.wasResolved) {
        onTournamentUpdate(updatedTournament, false);
      }

      const event = createStatusEvent(match, 'FINISHED');

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        status: 'FINISHED' as MatchStatus,
        elapsedSeconds: match.durationSeconds,
        events: [...match.events, event],
        awaitingTiebreakerChoice: false,
      });

      return updated;
    });

    // Announce to other tabs
    announceMatchFinished(matchId);
  }, [onTournamentUpdate, announceMatchFinished]);

  /**
   * Finish a match - checks for finals draw and prompts tiebreaker if needed
   */
  const handleFinish = useCallback((matchId: string) => {
    const match = liveMatches.get(matchId);
    if (!match) {
      console.error('handleFinish: Match not found:', matchId);
      return;
    }

    // Check if finals match ended in draw
    if (needsTiebreaker(match)) {
      setLiveMatches(prev => {
        const updated = new Map(prev);
        updated.set(matchId, {
          ...match,
          status: 'PAUSED' as MatchStatus,
          awaitingTiebreakerChoice: true,
          // FIX: Stop timer when entering tiebreaker state
          timerPausedAt: new Date().toISOString(),
          timerElapsedSeconds: match.elapsedSeconds,
        });
        return updated;
      });
      return;
    }

    // Determine how match was decided
    let decidedBy: 'regular' | 'overtime' | 'goldenGoal' | 'penalty' = 'regular';
    if (match.playPhase === 'overtime') {decidedBy = 'overtime';}
    if (match.playPhase === 'goldenGoal') {decidedBy = 'goldenGoal';}
    if (match.playPhase === 'penalty') {decidedBy = 'penalty';}

    finishMatchInternal(matchId, decidedBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- needsTiebreaker is a pure function, doesn't need to be in deps
  }, [liveMatches, finishMatchInternal]);

  /**
   * Force finish a match (skip tiebreaker check)
   */
  const handleForceFinish = useCallback((matchId: string) => {
    finishMatchInternal(matchId, 'regular');
  }, [finishMatchInternal]);

  /**
   * Start overtime (Verlängerung)
   */
  const handleStartOvertime = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleStartOvertime: Match not found:', matchId);
        return prev;
      }

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'RUNNING' as MatchStatus,
        playPhase: 'overtime',
        overtimeScoreA: 0,
        overtimeScoreB: 0,
        overtimeElapsedSeconds: 0,
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: 0,
        elapsedSeconds: 0,
        durationSeconds: match.overtimeDurationSeconds ?? 5 * 60,
        awaitingTiebreakerChoice: false,
      });
      return updated;
    });
  }, []);

  /**
   * Start golden goal
   */
  const handleStartGoldenGoal = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleStartGoldenGoal: Match not found:', matchId);
        return prev;
      }

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'RUNNING' as MatchStatus,
        playPhase: 'goldenGoal',
        overtimeScoreA: 0,
        overtimeScoreB: 0,
        overtimeElapsedSeconds: 0,
        timerStartTime: new Date().toISOString(),
        timerElapsedSeconds: 0,
        elapsedSeconds: 0,
        durationSeconds: match.overtimeDurationSeconds ?? 5 * 60,
        awaitingTiebreakerChoice: false,
      });
      return updated;
    });
  }, []);

  /**
   * Start penalty shootout (just changes phase, no timer)
   */
  const handleStartPenaltyShootout = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleStartPenaltyShootout: Match not found:', matchId);
        return prev;
      }

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'PAUSED' as MatchStatus, // No timer running for penalties
        playPhase: 'penalty',
        penaltyScoreA: 0,
        penaltyScoreB: 0,
        awaitingTiebreakerChoice: false,
      });
      return updated;
    });
  }, []);

  /**
   * Record penalty shootout result and finish match
   */
  const handleRecordPenaltyResult = useCallback((
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {
        console.error('handleRecordPenaltyResult: Match not found:', matchId);
        return prev;
      }

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        penaltyScoreA: homeScore,
        penaltyScoreB: awayScore,
      });
      return updated;
    });

    // Finish the match with penalty decision
    finishMatchInternal(matchId, 'penalty');
  }, [finishMatchInternal]);

  /**
   * Cancel tiebreaker choice and go back to normal finish
   */
  const handleCancelTiebreaker = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {return prev;}

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        awaitingTiebreakerChoice: false,
        status: 'FINISHED' as MatchStatus,
      });
      return updated;
    });
  }, []);

  /**
   * US-SCHEDULE-EDITOR: Skip a match (e.g., team withdrew or match cancelled)
   */
  const handleSkipMatch = useCallback((matchId: string, reason: string) => {
    // Update tournament.matches with skipped status
    const updatedMatches = tournamentRef.current.matches.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          matchStatus: 'skipped' as const,
          skippedReason: reason,
          skippedAt: new Date().toISOString(),
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

    // Also update liveMatches if it exists
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {return prev;}

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'FINISHED' as MatchStatus, // Use FINISHED since LiveMatch doesn't have SKIPPED
      });
      return updated;
    });

  }, [onTournamentUpdate]);

  /**
   * US-SCHEDULE-EDITOR: Restore a skipped match back to scheduled
   */
  const handleUnskipMatch = useCallback((matchId: string) => {
    // Update tournament.matches - restore to scheduled
    const updatedMatches = tournamentRef.current.matches.map(m => {
      if (m.id === matchId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { skippedReason, skippedAt, ...rest } = m;
        return {
          ...rest,
          matchStatus: 'scheduled' as const,
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

    // Also update liveMatches if it exists
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match) {return prev;}

      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        status: 'NOT_STARTED' as MatchStatus,
      });
      return updated;
    });

  }, [onTournamentUpdate]);

  /**
   * Record a goal
   * BUG-CRIT-001 FIX: Tournament update moved to setTimeout to prevent race condition
   * when goals are clicked rapidly in succession
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

      // BUG-CRIT-001 FIX: Update tournament.matches asynchronously AFTER liveMatches state is committed
      // This prevents race conditions when goals are clicked rapidly
      setTimeout(() => {
        const currentTournament = tournamentRef.current;
        const updatedMatches = currentTournament.matches.map(m => {
          if (m.id === matchId) {
            return {
              ...m,
              scoreA: newHomeScore,
              scoreB: newAwayScore,
            };
          }
          return m;
        });

        onTournamentUpdate({
          ...currentTournament,
          matches: updatedMatches,
          updatedAt: new Date().toISOString(),
        }, false);
      }, 0);

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
   * BUG-CRIT-002 FIX: Properly handle all event types and sync with tournament
   */
  const handleUndoLastEvent = useCallback((matchId: string) => {
    setLiveMatches(prev => {
      const match = prev.get(matchId);
      if (!match || match.events.length === 0) {
        console.error('handleUndoLastEvent: No events to undo');
        return prev;
      }

      const events = [...match.events];
      events.pop(); // Remove last event

      // BUG-CRIT-002 FIX: Determine new score based on remaining events
      let newHomeScore: number;
      let newAwayScore: number;

      if (events.length === 0) {
        // No events left -> reset score to 0:0
        newHomeScore = 0;
        newAwayScore = 0;
      } else {
        // Get score from the last remaining event
        const previousEvent = events[events.length - 1];
        newHomeScore = previousEvent.scoreAfter.home;
        newAwayScore = previousEvent.scoreAfter.away;
      }

      // BUG-CRIT-002 FIX: Also sync with tournament.matches
      setTimeout(() => {
        const currentTournament = tournamentRef.current;
        const updatedMatches = currentTournament.matches.map(m => {
          if (m.id === matchId) {
            return {
              ...m,
              scoreA: newHomeScore,
              scoreB: newAwayScore,
            };
          }
          return m;
        });

        onTournamentUpdate({
          ...currentTournament,
          matches: updatedMatches,
          updatedAt: new Date().toISOString(),
        }, false);
      }, 0);


      const updated = new Map(prev);
      updated.set(matchId, {
        ...match,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        events,
      });
      return updated;
    });
  }, [onTournamentUpdate]);

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
              correctionHistory: [...(m.correctionHistory ?? []), correctionEntry],
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
      durationSeconds: tournamentRef.current.groupPhaseGameDuration * 60,
      refereeName: matchData.referee ? `SR ${matchData.referee}` : undefined,
      homeTeam: { id: matchData.homeTeam, name: matchData.homeTeam },
      awayTeam: { id: matchData.awayTeam, name: matchData.awayTeam },
      homeScore: matchData.scoreA ?? 0,
      awayScore: matchData.scoreB ?? 0,
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
    handleForceFinish,
    handleGoal,
    handleUndoLastEvent,
    handleManualEditResult,
    handleAdjustTime,
    handleReopenMatch,
    hasRunningMatch,
    // Tiebreaker handlers
    handleStartOvertime,
    handleStartGoldenGoal,
    handleStartPenaltyShootout,
    handleRecordPenaltyResult,
    handleCancelTiebreaker,
    // US-SCHEDULE-EDITOR: Skip match handlers
    handleSkipMatch,
    handleUnskipMatch,
  };
}
