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
import { LocalStorageLiveMatchRepository } from '../core/repositories/LocalStorageLiveMatchRepository';
import { LocalStorageRepository } from '../core/repositories/LocalStorageRepository';
import { LiveMatch, MatchStatus } from '../core/models/LiveMatch';
import { useMultiTabSync } from './useMultiTabSync';

// ============================================================================
// TYPES
// ============================================================================

export interface UseMatchExecutionProps {
    tournament: Tournament;
    onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

export interface UseMatchExecutionReturn {
    // State
    liveMatches: Map<string, LiveMatch>;

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
    hasRunningMatch: () => LiveMatch | undefined;
}

// Timer update interval (display only, not persistence)
const TIMER_UPDATE_INTERVAL_MS = 1000;

// ============================================================================
// HOOK
// ============================================================================

export function useMatchExecution({
    tournament,
    onTournamentUpdate,
}: UseMatchExecutionProps): UseMatchExecutionReturn {

    // Repositories and Service (memoized)
    const service = useMemo(() => {
        const liveMatchRepo = new LocalStorageLiveMatchRepository();
        const tournamentRepo = new LocalStorageRepository();
        return new MatchExecutionService(liveMatchRepo, tournamentRepo);
    }, []);

    // State
    const [liveMatches, setLiveMatches] = useState<Map<string, LiveMatch>>(new Map());

    // Refs
    const tournamentRef = useRef(tournament);
    tournamentRef.current = tournament;

    // Multi-tab sync
    const { announceMatchStarted, announceMatchFinished } = useMultiTabSync({
        tournamentId: tournament.id,
    });

    // Load initial state
    useEffect(() => {
        const load = async () => {
            const repo = new LocalStorageLiveMatchRepository();
            const matches = await repo.getAll(tournament.id);
            setLiveMatches(matches);
        };
        void load();
    }, [tournament.id]);

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

        const updated = await service.startMatch(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
        announceMatchStarted(matchId);
        return true;
    }, [liveMatches, service, tournament.id, announceMatchStarted]);

    const handlePause = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.pauseMatch(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleResume = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.resumeMatch(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleFinish = useCallback(async (matchId: string): Promise<void> => {
        const result = await service.finishMatch(tournament.id, matchId);

        if (result.needsTiebreaker) {
            // Update local state to show tiebreaker choice
            const match = await new LocalStorageLiveMatchRepository().get(tournament.id, matchId);
            if (match) {
                setLiveMatches(prev => new Map(prev).set(matchId, match));
            }
            return;
        }

        // Reload tournament to get updated match results
        const repo = new LocalStorageRepository();
        const updated = await repo.get(tournament.id);
        if (updated) {
            onTournamentUpdate(updated, false);
        }

        // Update local state
        const liveRepo = new LocalStorageLiveMatchRepository();
        const match = await liveRepo.get(tournament.id, matchId);
        if (match) {
            setLiveMatches(prev => new Map(prev).set(matchId, match));
        }

        announceMatchFinished(matchId);
    }, [service, tournament.id, onTournamentUpdate, announceMatchFinished]);

    const handleForceFinish = useCallback(async (matchId: string): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        // Cancel tiebreaker and finish
        await service.cancelTiebreaker(tournament.id, matchId);

        const repo = new LocalStorageRepository();
        const updated = await repo.get(tournament.id);
        if (updated) {
            onTournamentUpdate(updated, false);
        }

        const liveRepo = new LocalStorageLiveMatchRepository();
        const updatedMatch = await liveRepo.get(tournament.id, matchId);
        if (updatedMatch) {
            setLiveMatches(prev => new Map(prev).set(matchId, updatedMatch));
        }

        announceMatchFinished(matchId);
    }, [liveMatches, service, tournament.id, onTournamentUpdate, announceMatchFinished]);

    const handleGoal = useCallback(async (
        matchId: string,
        teamId: string,
        delta: 1 | -1,
        options?: { playerNumber?: number; assists?: number[]; incomplete?: boolean }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';
        const updated = await service.recordGoal(tournament.id, matchId, team, delta, options);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));

        // If match finished (golden goal), update tournament
        if (updated.status === 'FINISHED') {
            const repo = new LocalStorageRepository();
            const t = await repo.get(tournament.id);
            if (t) { onTournamentUpdate(t, false); }
            announceMatchFinished(matchId);
        }
    }, [liveMatches, service, tournament.id, onTournamentUpdate, announceMatchFinished]);

    const handleCard = useCallback(async (
        matchId: string,
        teamId: string,
        cardType: 'YELLOW' | 'RED',
        options?: { playerNumber?: number }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';
        const updated = await service.recordCard(tournament.id, matchId, team, cardType, options);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [liveMatches, service, tournament.id]);

    const handleTimePenalty = useCallback(async (
        matchId: string,
        teamId: string,
        options?: { playerNumber?: number; durationSeconds?: number }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';
        const updated = await service.recordTimePenalty(tournament.id, matchId, team, options);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [liveMatches, service, tournament.id]);

    const handleSubstitution = useCallback(async (
        matchId: string,
        teamId: string,
        options?: { playersIn?: number[]; playersOut?: number[] }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';
        const updated = await service.recordSubstitution(tournament.id, matchId, team, options);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [liveMatches, service, tournament.id]);

    const handleFoul = useCallback(async (
        matchId: string,
        teamId: string,
        options?: { playerNumber?: number }
    ): Promise<void> => {
        const match = liveMatches.get(matchId);
        if (!match) { return; }

        const team = teamId === match.homeTeam.id ? 'home' : 'away';
        const updated = await service.recordFoul(tournament.id, matchId, team, options);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [liveMatches, service, tournament.id]);

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

        const repo = new LocalStorageRepository();
        const t = await repo.get(tournament.id);
        if (t) { onTournamentUpdate(t, false); }
        announceMatchFinished(matchId);
    }, [service, tournament.id, onTournamentUpdate, announceMatchFinished]);

    const handleCancelTiebreaker = useCallback(async (matchId: string): Promise<void> => {
        await service.cancelTiebreaker(tournament.id, matchId);

        const liveRepo = new LocalStorageLiveMatchRepository();
        const match = await liveRepo.get(tournament.id, matchId);
        if (match) {
            setLiveMatches(prev => new Map(prev).set(matchId, match));
        }
    }, [service, tournament.id]);

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

        const repo = new LocalStorageRepository();
        const t = await repo.get(tournament.id);
        if (t) { onTournamentUpdate(t, false); }
    }, [service, tournament.id, onTournamentUpdate]);

    const handleUnskipMatch = useCallback(async (matchId: string): Promise<void> => {
        await service.unskipMatch(tournament.id, matchId);

        const repo = new LocalStorageRepository();
        const t = await repo.get(tournament.id);
        if (t) { onTournamentUpdate(t, false); }
    }, [service, tournament.id, onTournamentUpdate]);

    const handleUndoLastEvent = useCallback(async (matchId: string): Promise<void> => {
        const updated = await service.undoLastEvent(tournament.id, matchId);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const handleReopenMatch = useCallback(async (matchData: ScheduledMatch): Promise<void> => {
        // Re-initialize with NOT_STARTED status
        const liveRepo = new LocalStorageLiveMatchRepository();
        const match = await liveRepo.get(tournament.id, matchData.id);
        if (match) {
            const reopened: LiveMatch = {
                ...match,
                status: 'NOT_STARTED' as MatchStatus,
                elapsedSeconds: 0,
                timerStartTime: undefined,
                timerPausedAt: undefined,
                timerElapsedSeconds: undefined,
            };
            await liveRepo.save(tournament.id, reopened);
            setLiveMatches(prev => new Map(prev).set(matchData.id, reopened));
        }
    }, [tournament.id]);

    const handleUpdateEvent = useCallback(async (
        matchId: string,
        eventId: string,
        updates: { playerNumber?: number; incomplete?: boolean }
    ): Promise<void> => {
        const updated = await service.updateEvent(tournament.id, matchId, eventId, updates);
        setLiveMatches(prev => new Map(prev).set(matchId, updated));
    }, [service, tournament.id]);

    const hasRunningMatch = useCallback((): LiveMatch | undefined => {
        return Array.from(liveMatches.values()).find(m => m.status === 'RUNNING');
    }, [liveMatches]);

    return {
        liveMatches,
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
        hasRunningMatch,
    };
}
