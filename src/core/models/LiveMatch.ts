/**
 * LiveMatch Model
 * 
 * Represents the runtime state of a match during live execution.
 * This is separate from the persisted Match in tournament.matches[].
 */

import { TeamLogo, TeamColors } from '../../types/tournament';

// ============================================================================
// STATUS TYPES
// ============================================================================

export type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export type PlayPhase = 'regular' | 'overtime' | 'goldenGoal' | 'penalty';

export type TournamentPhase = 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';

export type TiebreakerMode = 'shootout' | 'overtime-then-shootout' | 'goldenGoal';

// ============================================================================
// EVENT TYPES
// ============================================================================

export type MatchEventType =
    | 'GOAL'
    | 'YELLOW_CARD'
    | 'RED_CARD'
    | 'SUBSTITUTION'
    | 'FOUL'
    | 'STATUS_CHANGE'
    | 'TIME_PENALTY'
    | 'RESULT_EDIT';

export interface MatchEvent {
    id: string;
    matchId: string;
    timestampSeconds: number;
    type: MatchEventType;
    payload: {
        team?: 'home' | 'away';
        delta?: number;
        playerNumber?: number;
        assists?: number[];
        cardType?: 'YELLOW' | 'RED';
        toStatus?: MatchStatus;
        durationSeconds?: number;
    };
    scoreAfter: {
        home: number;
        away: number;
    };
}

// ============================================================================
// TEAM INFO (Runtime)
// ============================================================================

export interface LiveTeamInfo {
    id: string;
    name: string;
    logo?: TeamLogo;
    colors?: TeamColors;
}

// ============================================================================
// LIVE MATCH
// ============================================================================

export interface LiveMatch {
    // Identity
    id: string;
    number: number;
    phaseLabel: string;
    fieldId: string;
    scheduledKickoff: string; // ISO string
    refereeName?: string;

    // Teams
    homeTeam: LiveTeamInfo;
    awayTeam: LiveTeamInfo;

    // Scores
    homeScore: number;
    awayScore: number;

    // Status
    status: MatchStatus;
    elapsedSeconds: number;
    durationSeconds: number;

    // Timer Persistence (DEF-005)
    timerStartTime?: string;      // ISO timestamp when timer was started
    timerPausedAt?: string;       // ISO timestamp when timer was paused
    timerElapsedSeconds?: number; // Elapsed seconds before current run

    // Events
    events: MatchEvent[];

    // Tournament Context
    tournamentPhase?: TournamentPhase;

    // Tiebreaker
    playPhase?: PlayPhase;
    tiebreakerMode?: TiebreakerMode;
    overtimeDurationSeconds?: number;
    overtimeElapsedSeconds?: number;
    awaitingTiebreakerChoice?: boolean;

    // Tiebreaker Scores
    overtimeScoreA?: number;
    overtimeScoreB?: number;
    penaltyScoreA?: number;
    penaltyScoreB?: number;
}

// ============================================================================
// FINISH RESULT
// ============================================================================

export interface FinishResult {
    success: boolean;
    needsTiebreaker: boolean;
    decidedBy: 'regular' | 'overtime' | 'goldenGoal' | 'penalty';
}
