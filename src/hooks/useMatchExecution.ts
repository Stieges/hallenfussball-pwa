/**
 * useMatchExecution Hook
 * 
 * Thin React wrapper around MatchExecutionService.
 * Provides reactive state management for live match execution.
 * 
 * This hook replaces useLiveMatchManagement with a cleaner,
 * service-oriented architecture.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tournament } from '../types/tournament';
import { ScheduledMatch } from '../core/generators';
import { MatchExecutionService } from '../core/services/MatchExecutionService';
import { LiveMatch, MatchStatus } from '../core/models/LiveMatch';
import { OptimisticLockError } from '../core/errors';
import { useMultiTabSync } from './useMultiTabSync';
import { useRepository } from './useRepository';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { useToast } from '../components/ui/Toast/ToastContext';

// ============================================================================
// TYPES
// ============================================================================

export interface UseMatchExecutionProps {
    tournament: Tournament;
    onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

/**
 * Loading states for async operations.
 * Used to prevent double-taps and show loading indicators.
 */
export interface LoadingStates {
    goal: boolean;
    card: boolean;
    finish: boolean;
    undo: boolean;
    start: boolean;
}

export interface UseMatchExecutionReturn {
    // State
    liveMatches: Map<string, LiveMatch>;
    /** Loading states for async operations - use to disable buttons during operations */
    loadingStates: LoadingStates;
    /** True if any operation is currently loading */
    isAnyLoading: boolean;

    // Get/Initialize
    getLiveMatchData: (matchData: ScheduledMatch) => Promise<LiveMatch>;

    // Status
    handleStart: (matchId: string) => Promise<boolean>;
    handlePause: (matchId: string) => Promise<void>;
    handleResume: (matchId: string) => Promise<void>;
    handleFinish: (matchId: string) => Promise<void>;
    handleForceFinish: (matchId: string) => Promise<void>;

    // Scoring
    handleGoal: (matchId: string, teamId: string, delta: 1 | -1, options?: {
        playerNumber?: number;
        assists?: number[];
    }) => Promise<void>;
    handleCard: (matchId: string, teamId: string, cardType: 'YELLOW' | 'RED', options?: {
        playerNumber?: number;
    }) => Promise<void>;
    handleTimePenalty: (matchId: string, teamId: string, options?: {
        playerNumber?: number;
        durationSeconds?: number;
    }) => Promise<void>;
    handleSubstitution: (matchId: string, teamId: string, options?: {
        playersIn?: number[];
        playersOut?: number[];
    }) => Promise<void>;
    handleFoul: (matchId: string, teamId: string, options?: {
        playerNumber?: number;
    }) => Promise<void>;

    // Tiebreaker
    handleStartOvertime: (matchId: string) => Promise<void>;
    handleStartGoldenGoal: (matchId: string) => Promise<void>;
    handleStartPenaltyShootout: (matchId: string) => Promise<void>;
    handleRecordPenaltyResult: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
    handleCancelTiebreaker: (matchId: string) => Promise<void>;
    handleManualEditResult: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
    handleAdjustTime: (matchId: string, newElapsedSeconds: number) => Promise<void>;

    // Skip
    handleSkipMatch: (matchId: string, reason: string) => Promise<void>;
    handleUnskipMatch: (matchId: string) => Promise<void>;

    // Other
    handleUndoLastEvent: (matchId: string) => Promise<void>;
    handleReopenMatch: (matchData: ScheduledMatch) => Promise<void>;
    handleUpdateEvent: (matchId: string, eventId: string, updates: { playerNumber?: number; incomplete?: boolean }) => Promise<void>;
    handleSyncMetadata: (matchId: string) => Promise<void>;
    hasRunningMatch: () => LiveMatch | undefined;
}

// Timer update interval (display only, not persistence)
const TIMER_UPDATE_INTERVAL_MS = 1000;

// Error handler callback type (BUG-002)
export type ConflictErrorHandler = (matchId: string, error: OptimisticLockError) => void;

// ============================================================================
// HOOK
// ============================================================================

export function useMatchExecution({
    tournament,
    onTournamentUpdate,
}: UseMatchExecutionProps): UseMatchExecutionReturn {

    // Get auth-aware tournament repository (Supabase for authenticated, localStorage for guests)
    const tournamentRepo = useRepository();

    // Get live match repository from context (Supabase or localStorage based on auth)
    const { liveMatchRepository } = useRepositories();

    // QW-003: Toast for optimistic lock conflict feedback
    const { showInfo } = useToast();

    // Repositories and Service (memoized, recreate if repository changes)
    const service = useMemo(() => {
        return new MatchExecutionService(liveMatchRepository, tournamentRepo);
    }, [liveMatchRepository, tournamentRepo]);

    // State
    const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(new Map());

    // H-1 FIX: Loading states for async operations to prevent double-taps
    const [loadingStates, setLoadingStates] = useState<LoadingStates>({
        goal: false,
        card: false,
        finish: false,
        undo: false,
        start: false,
    });

    // Helper to update a specific loading state
    const setLoading = useCallback((key: keyof LoadingStates, value: boolean) => {
        setLoadingStates(prev => ({ ...prev, [key]: value }));
    }, []);

    // Refs
    const tournamentRef = useRef(tournament);
    tournamentRef.current = tournament;

    // Multi-tab sync
    // H-3 FIX: Extended to include pause, resume, and update events
    const {
        announceMatchStarted,
        announceMatchFinished,
        announceMatchPaused,
        announceMatchResumed,
        announceMatchUpdated,
    } = useMultiTabSync({
        tournamentId: tournament.id,
    });

    // Helper to refresh match state after conflict (BUG-002)
    const refreshMatchState = useCallback(async (matchId: string): Promise<LiveMatch | null> => {
        const freshMatch = await liveMatchRepository.get(tournament.id, matchId);
        if (freshMatch) {
            setLiveMatches(prev => new Map(prev).set(matchId, freshMatch));
        }
        return freshMatch;
    }, [liveMatchRepository, tournament.id]);

    // Load initial state
    useEffect(() => {
        const load = async () => {
            const matches = await liveMatchRepository.getAll(tournament.id);

            // Sync metadata (referees) on load/update
            const updates = Array.from(matches.values()).map(async (liveMatch) => {
                const scheduled = tournament.matches.find(m => m.id === liveMatch.id);
                if (scheduled) {
                    const refereeName = scheduled.referee ? (typeof scheduled.referee === 'number' ? `SR ${scheduled.referee}` : scheduled.referee) : undefined;

                    if (refereeName !== liveMatch.refereeName) {
                        const updated = await service.syncMatchMetadata(tournament.id, liveMatch.id, { refereeName });
                        if (updated) { return updated; }
                    }
                }
                return liveMatch;
            });

            const synced = await Promise.all(updates);
            setLiveMatches(new Map(synced.map(m => [m.id, m])));
        };
        void load();
    }, [tournament.id, tournament.matches, service, liveMatchRepository]); // Re-run when tournament matches change (e.g. referee assignment)

    // Timer for display updates (not persistence)
    useEffect(() => {
        const interval = setInterval(() => {
            setLiveMatches(prev => {
                const updated = new Map(prev);
                let hasRunning = false;

                for (const match of updated.values()) {
                    if (match.status === 'RUNNING' && match.timerStartTime) {
                        hasRunning = true;
                        break;
                    }
                }

                if (!hasRunning) {
                    return prev;
                }

                updated.forEach((match, id) => {
                    if (match.status === 'RUNNING' && match.timerStartTime) {
                        const elapsed = service.calculateElapsedSeconds(match);
                        updated.set(id, { ...match, elapsedSeconds: elapsed });
                    }
                });

                return updated;
            });
        }, TIMER_UPDATE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [service]);

    // =========================================================================
    // HANDLERS
    // =========================================================================

    const getLiveMatchData = useCallback(async (matchData: ScheduledMatch): Promise<LiveMatch> => {
        const existing = liveMatches.get(matchData.id);
        if (existing) { return existing; }

        const newMatch = await service.initializeMatch(tournament.id, matchData);
        setLiveMatches(prev => new Map(prev).set(matchData.id, newMatch));
        return newMatch;
    }, [liveMatches, service, tournament.id]);

    const handleStart = useCallback(async (matchId: string): Promise<boolean> => {
        const match = liveMatches.get(matchId);
        if (!match) { return false; }

        // Check for existing results (need confirmation in UI)
        if ((match.homeScore > 0 || match.awayScore > 0) && match.status === 'NOT_STARTED') {
            return false; // UI should show confirmation dialog
        }

        // H-1 FIX: Prevent double-taps
        setLoading('start', true);
        try {
            const updated = await service.startMatch(tournament.id, matchId);
            setLiveMatches(prev => new Map(prev).set(matchId, updated));
            announceMatchStarted(matchId);
            return true;
        } finally {
            setLoading('start', false);
        }
    }, [liveMatches, service, tournament.id, announceMatchStarted, setLoading]);

    const handlePause = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.pauseMatch(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
        // H-3 FIX: Announce pause to other tabs
        announceMatchPaused(matchId);
    }, [service, tournament.id, announceMatchPaused]);

    const handleResume = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.resumeMatch(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
        // H-3 FIX: Announce resume to other tabs
        announceMatchResumed(matchId);
    }, [service, tournament.id, announceMatchResumed]);

    const handleFinish = useCallback(async (matchId: string): Promise<void> => {
        // H-1 FIX: Prevent double-taps
        setLoading('finish', true);
        try {
            const result = await service.finishMatch(tournament.id, matchId);

            if (result.needsTiebreaker) {
                // Update local state to show tiebreaker choice
                const match = await liveMatchRepository.get(tournament.id, matchId);
                if (match) {
                    setLiveMatches(prev => new Map(prev).set(matchId, match));
                }
                return;
            }

            // Reload tournament to get updated match results
            const repo = tournamentRepo;
            const updated = await repo.get(tournament.id);
            if (updated) {
                onTournamentUpdate(updated, false);
            }

            // Update local state
            const match = await liveMatchRepository.get(tournament.id, matchId);
            if (match) {
                setLiveMatches(prev => new Map(prev).set(matchId, match));
            }

            announceMatchFinished(matchId);
        } catch (error) {
            // BUG-002 + QW-003: Handle optimistic lock conflicts with toast feedback
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Finish match failed after retries, refreshing state');
                await refreshMatchState(matchId);
                // Show info toast instead of re-throwing - conflict was resolved by refresh
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        } finally {
            setLoading('finish', false);
        }
    }, [service, tournament.id, onTournamentUpdate, announceMatchFinished, tournamentRepo, liveMatchRepository, refreshMatchState, showInfo, setLoading]);

    const handleForceFinish = useCallback(async (matchId: string): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        // Cancel tiebreaker and finish
        await service.cancelTiebreaker(tournament.id, matchId);

        const repo = tournamentRepo;
        const updated = await repo.get(tournament.id);
        if (updated) {
            onTournamentUpdate(updated, false);
        }

        const updatedMatch = await liveMatchRepository.get(tournament.id, matchId);
        if (updatedMatch) {
            setLiveMatches(prev => new Map(prev).set(matchId, updatedMatch));
        }

        announceMatchFinished(matchId);
    }, [liveMatches, service, tournament.id, onTournamentUpdate, announceMatchFinished, tournamentRepo, liveMatchRepository]);

    const handleGoal = useCallback(async (
        matchId: string,
        teamId: string,
        delta: 1 | -1,
        options?: { playerNumber?: number; assists?: number[]; incomplete?: boolean }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';

        // H-1 FIX: Prevent double-taps
        setLoading('goal', true);
        try {
            const updated = await service.recordGoal(tournament.id, matchId, team, delta, options);
            setLiveMatches(prev => new Map(prev).set(matchId, updated));

            // If match finished (golden goal), update tournament
            if (updated.status === 'FINISHED') {
                const repo = tournamentRepo;
                const t = await repo.get(tournament.id);
                if (t) { onTournamentUpdate(t, false); }
                announceMatchFinished(matchId);
            } else {
                // H-3 FIX: Announce goal update to other tabs
                announceMatchUpdated(matchId);
            }
        } catch (error) {
            // BUG-002 + QW-003: Handle optimistic lock conflicts with toast feedback
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Goal recording failed after retries, refreshing state');
                await refreshMatchState(matchId);
                // Show info toast instead of re-throwing - conflict was resolved by refresh
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        } finally {
            setLoading('goal', false);
        }
    }, [liveMatches, service, tournament.id, onTournamentUpdate, announceMatchFinished, announceMatchUpdated, tournamentRepo, refreshMatchState, showInfo, setLoading]);

    const handleCard = useCallback(async (
        matchId: string,
        teamId: string,
        cardType: 'YELLOW' | 'RED',
        options?: { playerNumber?: number }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';

        // H-1 FIX: Prevent double-taps
        setLoading('card', true);
        try {
            const updated = await service.recordCard(tournament.id, matchId, team, cardType, options);
            setLiveMatches(prev => new Map(prev).set(matchId, updated));
            // H-3 FIX: Announce card event to other tabs
            announceMatchUpdated(matchId);
        } catch (error) {
            // C-4 FIX: Handle optimistic lock conflicts
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Card recording failed after retries, refreshing state');
                await refreshMatchState(matchId);
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        } finally {
            setLoading('card', false);
        }
    }, [liveMatches, service, tournament.id, refreshMatchState, showInfo, announceMatchUpdated, setLoading]);

    const handleTimePenalty = useCallback(async (
        matchId: string,
        teamId: string,
        options?: { playerNumber?: number; durationSeconds?: number }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';

        try {
            const updated = await service.recordTimePenalty(tournament.id, matchId, team, options);
            setLiveMatches(prev => new Map(prev).set(matchId, updated));
            // H-3 FIX: Announce time penalty event to other tabs
            announceMatchUpdated(matchId);
        } catch (error) {
            // C-4 FIX: Handle optimistic lock conflicts
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Time penalty recording failed after retries, refreshing state');
                await refreshMatchState(matchId);
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        }
    }, [liveMatches, service, tournament.id, refreshMatchState, showInfo, announceMatchUpdated]);

    const handleSubstitution = useCallback(async (
        matchId: string,
        teamId: string,
        options?: { playersIn?: number[]; playersOut?: number[] }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';

        try {
            const updated = await service.recordSubstitution(tournament.id, matchId, team, options);
            setLiveMatches(prev => new Map(prev).set(matchId, updated));
            // H-3 FIX: Announce substitution event to other tabs
            announceMatchUpdated(matchId);
        } catch (error) {
            // C-4 FIX: Handle optimistic lock conflicts
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Substitution recording failed after retries, refreshing state');
                await refreshMatchState(matchId);
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        }
    }, [liveMatches, service, tournament.id, refreshMatchState, showInfo, announceMatchUpdated]);

    const handleFoul = useCallback(async (
        matchId: string,
        teamId: string,
        options?: { playerNumber?: number }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';

        try {
            const updated = await service.recordFoul(tournament.id, matchId, team, options);
            setLiveMatches(prev => new Map(prev).set(matchId, updated));
            // H-3 FIX: Announce foul event to other tabs
            announceMatchUpdated(matchId);
        } catch (error) {
            // C-4 FIX: Handle optimistic lock conflicts
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Foul recording failed after retries, refreshing state');
                await refreshMatchState(matchId);
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        }
    }, [liveMatches, service, tournament.id, refreshMatchState, showInfo, announceMatchUpdated]);

    const handleStartOvertime = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.startOvertime(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleStartGoldenGoal = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.startGoldenGoal(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleStartPenaltyShootout = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.startPenaltyShootout(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleRecordPenaltyResult = useCallback(async (
        matchId: string,
        homeScore: number,
        awayScore: number
    ): Promise<void> => {
        const updated = await service.recordPenaltyResult(tournament.id, matchId, homeScore, awayScore);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));

        const repo = tournamentRepo;
        const t = await repo.get(tournament.id);
        if (t) { onTournamentUpdate(t, false); }
        announceMatchFinished(matchId);
    }, [service, tournament.id, onTournamentUpdate, announceMatchFinished, tournamentRepo]);

    const handleCancelTiebreaker = useCallback(async (matchId: string): Promise<void> => {
        try {
            await service.cancelTiebreaker(tournament.id, matchId);

            const match = await liveMatchRepository.get(tournament.id, matchId);
            if (match) {
                setLiveMatches(prev => new Map(prev).set(matchId, match));
            }
        } catch (error) {
            // C-4 FIX: Handle optimistic lock conflicts
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Cancel tiebreaker failed after retries, refreshing state');
                await refreshMatchState(matchId);
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        }
    }, [service, tournament.id, liveMatchRepository, refreshMatchState, showInfo]);

    const handleManualEditResult = useCallback(async (
        matchId: string,
        homeScore: number,
        awayScore: number
    ): Promise<void> => {
        const updated = await service.updateResultManually(tournament.id, matchId, homeScore, awayScore);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleAdjustTime = useCallback(async (matchId: string, newElapsedSeconds: number): Promise<void> => {
        const updated = await service.adjustTime(tournament.id, matchId, newElapsedSeconds);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleSkipMatch = useCallback(async (matchId: string, reason: string): Promise<void> => {
        await service.skipMatch(tournament.id, matchId, reason);

        const repo = tournamentRepo;
        const t = await repo.get(tournament.id);
        if (t) { onTournamentUpdate(t, false); }
    }, [service, tournament.id, onTournamentUpdate, tournamentRepo]);

    const handleUnskipMatch = useCallback(async (matchId: string): Promise<void> => {
        await service.unskipMatch(tournament.id, matchId);

        const repo = tournamentRepo;
        const t = await repo.get(tournament.id);
        if (t) { onTournamentUpdate(t, false); }
    }, [service, tournament.id, onTournamentUpdate, tournamentRepo]);

    const handleUndoLastEvent = useCallback(async (matchId: string): Promise<void> => {
        // H-1 FIX: Prevent double-taps
        setLoading('undo', true);
        try {
            const updated = await service.undoLastEvent(tournament.id, matchId);
            setLiveMatches(prev => new Map(prev).set(matchId, updated));
        } catch (error) {
            // C-4 FIX: Handle optimistic lock conflicts
            if (error instanceof OptimisticLockError) {
                console.warn('[useMatchExecution] Undo failed after retries, refreshing state');
                await refreshMatchState(matchId);
                showInfo('Konflikt erkannt - Daten wurden synchronisiert', { duration: 3000 });
                return;
            }
            throw error;
        } finally {
            setLoading('undo', false);
        }
    }, [service, tournament.id, refreshMatchState, showInfo, setLoading]);

    const handleReopenMatch = useCallback(async (matchData: ScheduledMatch): Promise<void> => {
        // Re-initialize with NOT_STARTED status
        const match = await liveMatchRepository.get(tournament.id, matchData.id);
        if (match) {
            const reopened: LiveMatch = {
                ...match,
                status: 'NOT_STARTED' as MatchStatus,
                elapsedSeconds: 0,
                timerStartTime: undefined,
                timerPausedAt: undefined,
                timerElapsedSeconds: undefined,
            };
            await liveMatchRepository.save(tournament.id, reopened);
            setLiveMatches(prev => new Map(prev).set(matchData.id, reopened));
        }
    }, [tournament.id, liveMatchRepository]);

    const handleUpdateEvent = useCallback(async (
        matchId: string,
        eventId: string,
        updates: { playerNumber?: number; incomplete?: boolean }
    ): Promise<void> => {
        const updated = await service.updateEvent(tournament.id, matchId, eventId, updates);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleSyncMetadata = useCallback(async (matchId: string): Promise<void> => {
        const match = tournament.matches.find(m => m.id === matchId);
        if (!match) {
            return;
        }

        const refereeName = match.referee ? (typeof match.referee === 'number' ? `SR ${match.referee}` : match.referee) : undefined;
        const updated = await service.syncMatchMetadata(tournament.id, matchId, { refereeName });

        if (updated) {
            setLiveMatches(prev => new Map(prev).set(matchId, updated));
        }
    }, [service, tournament.id, tournament.matches]);

    const hasRunningMatch = useCallback((): LiveMatch | undefined => {
        return Array.from(liveMatches.values()).find(m => m.status === 'RUNNING');
    }, [liveMatches]);

    // H-1 FIX: Compute isAnyLoading from loadingStates
    const isAnyLoading = useMemo(() =>
        Object.values(loadingStates).some(Boolean),
    [loadingStates]);

    return {
        liveMatches,
        loadingStates,
        isAnyLoading,
        getLiveMatchData,
        handleStart,
        handlePause,
        handleResume,
        handleFinish,
        handleForceFinish,
        handleGoal,
        handleCard,
        handleTimePenalty,
        handleSubstitution,
        handleFoul,
        handleStartOvertime,
        handleStartGoldenGoal,
        handleStartPenaltyShootout,
        handleRecordPenaltyResult,
        handleCancelTiebreaker,
        handleManualEditResult,
        handleAdjustTime,
        handleSkipMatch,
        handleUnskipMatch,
        handleUndoLastEvent,
        handleReopenMatch,
        handleUpdateEvent,
        handleSyncMetadata,
        hasRunningMatch,
    };
}
