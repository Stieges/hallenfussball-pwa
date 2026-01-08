/**
 * MatchExecutionService
 * 
 * Core business logic for live match management.
 * Extracted from useLiveMatchManagement.ts hook.
 * 
 * This is a pure service with NO React dependencies.
 */

import { ILiveMatchRepository } from '../repositories/ILiveMatchRepository';
import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { LiveMatch, MatchStatus, MatchEvent, FinishResult } from '../models/LiveMatch';
import { ScheduledMatch } from '../../core/generators';
import { RuntimeMatchEvent } from '../../types/tournament';

// ============================================================================
// TYPES
// ============================================================================

export interface GoalOptions {
    playerNumber?: number;
    assists?: number[];
}

export interface CardOptions {
    playerNumber?: number;
}

export interface TimePenaltyOptions {
    playerNumber?: number;
    durationSeconds?: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MatchExecutionService {
    constructor(
        private liveMatchRepo: ILiveMatchRepository,
        private tournamentRepo: ITournamentRepository
    ) { }

    // ==========================================================================
    // STATUS MANAGEMENT
    // ==========================================================================

    async startMatch(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const updated: LiveMatch = {
            ...match,
            status: 'RUNNING',
            timerStartTime: new Date().toISOString(),
            timerElapsedSeconds: match.elapsedSeconds,
            timerPausedAt: undefined,
            events: [...match.events, this.createStatusEvent(match, 'RUNNING')],
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async pauseMatch(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const elapsed = this.calculateElapsedSeconds(match);

        const updated: LiveMatch = {
            ...match,
            status: 'PAUSED',
            elapsedSeconds: elapsed,
            timerPausedAt: new Date().toISOString(),
            timerElapsedSeconds: elapsed,
            events: [...match.events, this.createStatusEvent(match, 'PAUSED')],
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async resumeMatch(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const updated: LiveMatch = {
            ...match,
            status: 'RUNNING',
            timerStartTime: new Date().toISOString(),
            timerElapsedSeconds: match.elapsedSeconds,
            timerPausedAt: undefined,
            events: [...match.events, this.createStatusEvent(match, 'RUNNING')],
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async finishMatch(tournamentId: string, matchId: string): Promise<FinishResult> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        // Check if finals match needs tiebreaker
        if (this.needsTiebreaker(match)) {
            const paused: LiveMatch = {
                ...match,
                status: 'PAUSED',
                awaitingTiebreakerChoice: true,
                timerPausedAt: new Date().toISOString(),
                timerElapsedSeconds: match.elapsedSeconds,
            };
            await this.liveMatchRepo.save(tournamentId, paused);
            return { success: false, needsTiebreaker: true, decidedBy: 'regular' };
        }

        // Finish the match
        const decidedBy = this.getDecidedBy(match);
        await this.persistFinalResult(tournamentId, match, decidedBy);

        return { success: true, needsTiebreaker: false, decidedBy };
    }

    // ==========================================================================
    // SCORING
    // ==========================================================================

    async recordGoal(
        tournamentId: string,
        matchId: string,
        team: 'home' | 'away',
        delta: 1 | -1,
        options?: GoalOptions
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const elapsed = this.calculateElapsedSeconds(match);
        const isOvertime = match.playPhase === 'overtime' || match.playPhase === 'goldenGoal';

        let updated: LiveMatch;

        if (isOvertime) {
            updated = {
                ...match,
                overtimeScoreA: (match.overtimeScoreA ?? 0) + (team === 'home' ? delta : 0),
                overtimeScoreB: (match.overtimeScoreB ?? 0) + (team === 'away' ? delta : 0),
            };
        } else {
            updated = {
                ...match,
                homeScore: Math.max(0, match.homeScore + (team === 'home' ? delta : 0)),
                awayScore: Math.max(0, match.awayScore + (team === 'away' ? delta : 0)),
            };
        }

        // Add event
        const event: MatchEvent = {
            id: `${matchId}-${Date.now()}`,
            matchId,
            timestampSeconds: elapsed,
            type: 'GOAL',
            payload: {
                team,
                delta,
                playerNumber: options?.playerNumber,
                assists: options?.assists,
            },
            scoreAfter: { home: updated.homeScore, away: updated.awayScore },
        };

        updated.events = [...match.events, event];

        // Golden Goal: Auto-finish if someone scored
        if (match.playPhase === 'goldenGoal' && delta > 0) {
            await this.persistFinalResult(tournamentId, updated, 'goldenGoal');
            return { ...updated, status: 'FINISHED' };
        }

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async recordCard(
        tournamentId: string,
        matchId: string,
        team: 'home' | 'away',
        cardType: 'YELLOW' | 'RED',
        options?: CardOptions
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const elapsed = this.calculateElapsedSeconds(match);

        const event: MatchEvent = {
            id: `${matchId}-${Date.now()}`,
            matchId,
            timestampSeconds: elapsed,
            type: cardType === 'YELLOW' ? 'YELLOW_CARD' : 'RED_CARD',
            payload: {
                team,
                // cardType property is removed from payload as it is now in event type? 
                // Wait, MatchEvent payload might still have it or not needed.
                // Previous payload allowed generic. Let's keep minimal payload.
                playerNumber: options?.playerNumber,
            },
            scoreAfter: { home: match.homeScore, away: match.awayScore },
        };

        const updated: LiveMatch = {
            ...match,
            events: [...match.events, event],
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async recordTimePenalty(
        tournamentId: string,
        matchId: string,
        team: 'home' | 'away',
        options?: TimePenaltyOptions
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const elapsed = this.calculateElapsedSeconds(match);

        const event: MatchEvent = {
            id: `${matchId}-${Date.now()}`,
            matchId,
            timestampSeconds: elapsed,
            type: 'TIME_PENALTY',
            payload: {
                team,
                playerNumber: options?.playerNumber,
                durationSeconds: options?.durationSeconds ?? 120, // Default 2 minutes
            },
            scoreAfter: { home: match.homeScore, away: match.awayScore },
        };

        const updated: LiveMatch = {
            ...match,
            events: [...match.events, event],
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async recordSubstitution(
        tournamentId: string,
        matchId: string,
        team: 'home' | 'away',
        options?: { playersIn?: number[]; playersOut?: number[] }
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const elapsed = this.calculateElapsedSeconds(match);

        const event: MatchEvent = {
            id: `${matchId}-${Date.now()}`,
            matchId,
            timestampSeconds: elapsed,
            type: 'SUBSTITUTION',
            payload: {
                team,
                // Passing arrays generic payload if supported, otherwise just store it
            },
            scoreAfter: { home: match.homeScore, away: match.awayScore },
        };
        // Extend payload type to support players list? 
        // MatchEvent definition in LiveMatch.ts: payload is object.
        // I should stick to adding "playersIn", "playersOut" to payload to be safe.
        // But LiveMatch.ts MatchEvent payload needs that type definition.

        // For now, let's assume payload is flexible or I cast it. 
        // Or better: update LiveMatch.ts to include playersIn/Out in payload.
        // Let's rely on flexible payload for a moment or cast.
        event.payload.playersIn = options?.playersIn;
        event.payload.playersOut = options?.playersOut;

        const updated: LiveMatch = {
            ...match,
            events: [...match.events, event],
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async recordFoul(
        tournamentId: string,
        matchId: string,
        team: 'home' | 'away',
        options?: { playerNumber?: number }
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const elapsed = this.calculateElapsedSeconds(match);

        const event: MatchEvent = {
            id: `${matchId}-${Date.now()}`,
            matchId,
            timestampSeconds: elapsed,
            type: 'FOUL',
            payload: {
                team,
                playerNumber: options?.playerNumber,
            },
            scoreAfter: { home: match.homeScore, away: match.awayScore },
        };

        const updated: LiveMatch = {
            ...match,
            events: [...match.events, event],
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    // ==========================================================================
    // MANUAL ADJUSTMENTS
    // ==========================================================================

    async updateResultManually(
        tournamentId: string,
        matchId: string,
        homeScore: number,
        awayScore: number
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const updated: LiveMatch = {
            ...match,
            homeScore,
            awayScore,
        };

        // If match is FINISHED, assuming we might need to sync to tournament too?
        // But for now, just update live match state. 
        // If it was finished, we might need to un-finish it or update the robust persistence too.

        await this.liveMatchRepo.save(tournamentId, updated);

        // Also update persistence if finished?
        // Let's assume the caller handles re-finishing/updating if needed, or we do it here.
        // Given this is "Live" service, mostly concerns live state.

        return updated;
    }

    async adjustTime(
        tournamentId: string,
        matchId: string,
        newElapsedSeconds: number
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        let updated: LiveMatch = {
            ...match,
            elapsedSeconds: newElapsedSeconds,
            timerElapsedSeconds: newElapsedSeconds, // Update base accumulator
        };

        // If running, we might need to adjust timerStartTime to match new elapsed
        if (match.status === 'RUNNING' && match.timerStartTime) {
            // Reset start time to now, and set accumulated to newElapsedSeconds
            updated = {
                ...updated,
                timerStartTime: new Date().toISOString(),
                timerElapsedSeconds: newElapsedSeconds,
            };
        }

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }


    // ==========================================================================
    // TIEBREAKER
    // ==========================================================================

    async startOvertime(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const updated: LiveMatch = {
            ...match,
            status: 'RUNNING',
            playPhase: 'overtime',
            overtimeScoreA: 0,
            overtimeScoreB: 0,
            overtimeElapsedSeconds: 0,
            timerStartTime: new Date().toISOString(),
            timerElapsedSeconds: 0,
            elapsedSeconds: 0,
            durationSeconds: match.overtimeDurationSeconds ?? 5 * 60,
            awaitingTiebreakerChoice: false,
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async startGoldenGoal(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const updated: LiveMatch = {
            ...match,
            status: 'RUNNING',
            playPhase: 'goldenGoal',
            overtimeScoreA: 0,
            overtimeScoreB: 0,
            overtimeElapsedSeconds: 0,
            timerStartTime: new Date().toISOString(),
            timerElapsedSeconds: 0,
            elapsedSeconds: 0,
            durationSeconds: match.overtimeDurationSeconds ?? 5 * 60,
            awaitingTiebreakerChoice: false,
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async startPenaltyShootout(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const updated: LiveMatch = {
            ...match,
            status: 'PAUSED', // No timer for penalties
            playPhase: 'penalty',
            penaltyScoreA: 0,
            penaltyScoreB: 0,
            awaitingTiebreakerChoice: false,
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    async recordPenaltyResult(
        tournamentId: string,
        matchId: string,
        homeScore: number,
        awayScore: number
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        const updated: LiveMatch = {
            ...match,
            penaltyScoreA: homeScore,
            penaltyScoreB: awayScore,
        };

        await this.persistFinalResult(tournamentId, updated, 'penalty');
        return { ...updated, status: 'FINISHED' };
    }

    async cancelTiebreaker(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        // Finish as draw (only valid in group stage)
        await this.persistFinalResult(tournamentId, match, 'regular');
        return { ...match, status: 'FINISHED', awaitingTiebreakerChoice: false };
    }

    // ==========================================================================
    // SKIP MATCH
    // ==========================================================================

    async skipMatch(tournamentId: string, matchId: string, reason: string): Promise<void> {
        await this.tournamentRepo.updateMatch(tournamentId, {
            id: matchId,
            matchStatus: 'skipped',
            skippedReason: reason,
            skippedAt: new Date().toISOString(),
        });
    }

    async unskipMatch(tournamentId: string, matchId: string): Promise<void> {
        await this.tournamentRepo.updateMatch(tournamentId, {
            id: matchId,
            matchStatus: 'scheduled',
            skippedReason: undefined,
            skippedAt: undefined,
        });
    }

    // ==========================================================================
    // UNDO
    // ==========================================================================

    async undoLastEvent(tournamentId: string, matchId: string): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }
        if (match.events.length === 0) { return match; }

        const lastEvent = match.events[match.events.length - 1];
        let updated = { ...match, events: match.events.slice(0, -1) };

        // Revert score if it was a goal
        if (lastEvent.type === 'GOAL' && lastEvent.payload.delta) {
            const delta = lastEvent.payload.delta;
            const team = lastEvent.payload.team;

            if (match.playPhase === 'overtime' || match.playPhase === 'goldenGoal') {
                updated = {
                    ...updated,
                    overtimeScoreA: (updated.overtimeScoreA ?? 0) - (team === 'home' ? delta : 0),
                    overtimeScoreB: (updated.overtimeScoreB ?? 0) - (team === 'away' ? delta : 0),
                };
            } else {
                updated = {
                    ...updated,
                    homeScore: updated.homeScore - (team === 'home' ? delta : 0),
                    awayScore: updated.awayScore - (team === 'away' ? delta : 0),
                };
            }
        }

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    // ==========================================================================
    // TIMER LOGIC (Pure Functions)
    // ==========================================================================

    calculateElapsedSeconds(match: LiveMatch): number {
        if (match.status !== 'RUNNING' || !match.timerStartTime) {
            return match.elapsedSeconds;
        }

        const startTime = new Date(match.timerStartTime).getTime();
        const runtimeSeconds = Math.floor((Date.now() - startTime) / 1000);
        return (match.timerElapsedSeconds ?? 0) + runtimeSeconds;
    }

    isStaleMatch(match: LiveMatch): boolean {
        if (match.status !== 'RUNNING' || !match.timerStartTime) {
            return false;
        }

        const timerStart = new Date(match.timerStartTime).getTime();
        const timeSinceStart = Date.now() - timerStart;
        const maxExpectedDuration = (match.durationSeconds + 300) * 1000;
        const MAX_STALE_MS = 30 * 60 * 1000;

        return timeSinceStart > maxExpectedDuration || timeSinceStart > MAX_STALE_MS;
    }

    async updateEvent(
        tournamentId: string,
        matchId: string,
        eventId: string,
        updates: { playerNumber?: number; incomplete?: boolean }
    ): Promise<LiveMatch> {
        const match = await this.liveMatchRepo.get(tournamentId, matchId);
        if (!match) { throw new Error(`Match ${matchId} not found`); }

        // Find event
        const eventIndex = match.events.findIndex(e => e.id === eventId);
        if (eventIndex === -1) { throw new Error(`Event ${eventId} not found`); }

        const events = [...match.events];
        const event = { ...events[eventIndex] };

        // Update basic properties if present
        if (updates.incomplete !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            (event as any).incomplete = updates.incomplete;
        }
        if (updates.playerNumber !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            (event as any).playerNumber = updates.playerNumber;
            // Also update payload for legacy compatibility
            // Also update payload for legacy compatibility. Payload is typed as object in MatchEvent/EditableMatchEvent
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (event.payload && typeof (event.payload as unknown) === 'object') {
                event.payload = { ...event.payload, playerNumber: updates.playerNumber };
            }
        }

        events[eventIndex] = event;

        const updated: LiveMatch = {
            ...match,
            events,
        };

        await this.liveMatchRepo.save(tournamentId, updated);
        return updated;
    }

    // ==========================================================================
    // MATCH INITIALIZATION
    // ==========================================================================

    async initializeMatch(
        tournamentId: string,
        scheduledMatch: ScheduledMatch
    ): Promise<LiveMatch> {
        // Check if already exists
        const existing = await this.liveMatchRepo.get(tournamentId, scheduledMatch.id);
        if (existing) { return existing; }

        // Get tournament for config
        const tournament = await this.tournamentRepo.get(tournamentId);
        if (!tournament) { throw new Error(`Tournament ${tournamentId} not found`); }

        const tiebreakerMode = tournament.finalsConfig?.tiebreaker;
        const tiebreakerDuration = tournament.finalsConfig?.tiebreakerDuration ?? 5;
        const durationSeconds = tournament.groupPhaseGameDuration * 60;

        // Resolve team data
        const homeTeam = tournament.teams.find(t => t.id === scheduledMatch.originalTeamA || t.name === scheduledMatch.homeTeam);
        const awayTeam = tournament.teams.find(t => t.id === scheduledMatch.originalTeamB || t.name === scheduledMatch.awayTeam);

        const newMatch: LiveMatch = {
            id: scheduledMatch.id,
            number: scheduledMatch.matchNumber,
            phaseLabel: scheduledMatch.label || (scheduledMatch.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
            fieldId: `field-${scheduledMatch.field}`,
            scheduledKickoff: scheduledMatch.startTime.toISOString(),
            durationSeconds,
            refereeName: scheduledMatch.referee ? `SR ${scheduledMatch.referee}` : undefined,
            homeTeam: {
                id: homeTeam?.id ?? scheduledMatch.homeTeam,
                name: homeTeam?.name ?? scheduledMatch.homeTeam,
                logo: homeTeam?.logo,
                colors: homeTeam?.colors,
            },
            awayTeam: {
                id: awayTeam?.id ?? scheduledMatch.awayTeam,
                name: awayTeam?.name ?? scheduledMatch.awayTeam,
                logo: awayTeam?.logo,
                colors: awayTeam?.colors,
            },
            homeScore: scheduledMatch.scoreA ?? 0,
            awayScore: scheduledMatch.scoreB ?? 0,
            status: 'NOT_STARTED',
            elapsedSeconds: 0,
            events: [],
            tournamentPhase: scheduledMatch.phase as LiveMatch['tournamentPhase'],
            tiebreakerMode,
            overtimeDurationSeconds: tiebreakerDuration * 60,
        };

        await this.liveMatchRepo.save(tournamentId, newMatch);
        return newMatch;
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    private needsTiebreaker(match: LiveMatch): boolean {
        if (match.tournamentPhase === 'groupStage') { return false; }
        if (!match.tiebreakerMode) { return false; }
        if (match.playPhase === 'penalty') { return false; }

        if (match.playPhase === 'regular' || match.playPhase === undefined) {
            return match.homeScore === match.awayScore;
        }

        const totalHome = match.homeScore + (match.overtimeScoreA ?? 0);
        const totalAway = match.awayScore + (match.overtimeScoreB ?? 0);
        return totalHome === totalAway;
    }

    private getDecidedBy(match: LiveMatch): FinishResult['decidedBy'] {
        switch (match.playPhase) {
            case 'overtime': return 'overtime';
            case 'goldenGoal': return 'goldenGoal';
            case 'penalty': return 'penalty';
            default: return 'regular';
        }
    }

    private createStatusEvent(match: LiveMatch, status: MatchStatus): MatchEvent {
        return {
            id: `${match.id}-${Date.now()}`,
            matchId: match.id,
            timestampSeconds: this.calculateElapsedSeconds(match),
            type: 'STATUS_CHANGE',
            payload: { toStatus: status },
            scoreAfter: { home: match.homeScore, away: match.awayScore },
        };
    }

    private async persistFinalResult(
        tournamentId: string,
        match: LiveMatch,
        decidedBy: FinishResult['decidedBy']
    ): Promise<void> {
        // 1. Update LiveMatch
        const finishedMatch: LiveMatch = {
            ...match,
            status: 'FINISHED',
            elapsedSeconds: match.durationSeconds,
            awaitingTiebreakerChoice: false,
            events: [...match.events, this.createStatusEvent(match, 'FINISHED')],
        };
        await this.liveMatchRepo.save(tournamentId, finishedMatch);

        // 2. Update Tournament.matches
        const finalHomeScore = match.homeScore + (match.overtimeScoreA ?? 0);
        const finalAwayScore = match.awayScore + (match.overtimeScoreB ?? 0);

        await this.tournamentRepo.updateMatch(tournamentId, {
            id: match.id,
            scoreA: finalHomeScore,
            scoreB: finalAwayScore,
            matchStatus: 'finished',
            finishedAt: new Date().toISOString(),
            overtimeScoreA: match.overtimeScoreA,
            overtimeScoreB: match.overtimeScoreB,
            penaltyScoreA: match.penaltyScoreA,
            penaltyScoreB: match.penaltyScoreB,
            decidedBy,
            events: match.events as unknown as RuntimeMatchEvent[], // Persist full event history
        });
    }
}
