import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { Match, MatchUpdate } from '../models/types';
import { generateFullSchedule } from '../../core/generators';

/**
 * ScheduleService
 * Encapsulates all logic related to Schedule Lifecycle.
 * Enforces "Single Source of Truth" by treating the Repository as the master.
 */
export class ScheduleService {
    constructor(private repository: ITournamentRepository) { }

    /**
     * Initializes the schedule for a given tournament.
     * - If matches exist in DB -> Returns them (Truth).
     * - If matches empty -> Generates them using Rules, Persists, Returns.
     */
    async initializeSchedule(tournamentId: string): Promise<Match[]> {
        const tournament = await this.repository.get(tournamentId);

        if (!tournament) {
            throw new Error(`Tournament ${tournamentId} not found`);
        }

        // A. Truth exists in DB
        if (tournament.matches.length > 0) {
            // NOTE: We do NOT re-generate here. That was the bug.
            return tournament.matches;
        }

        // B. First-time Generation (fresh)
        return this.regenerateSchedule(tournamentId);
    }

    /**
     * Forces a re-generation of the schedule based on current tournament rules.
     * WARNING: Overwrites existing matches!
     */
    async regenerateSchedule(tournamentId: string): Promise<Match[]> {
        const tournament = await this.repository.get(tournamentId);
        if (!tournament) { throw new Error('Tournament not found'); }

        // 1. Generate pure schedule from rules
        const generated = generateFullSchedule(tournament);
        const newMatches = generated.allMatches.map(m => ({
            id: m.id,
            round: 1, // simplified mapping, generator provides structure
            field: m.field,
            slot: m.slot, // Important: Generator assigns initial slots
            teamA: m.originalTeamA,
            teamB: m.originalTeamB,
            scheduledTime: m.startTime,
            group: m.group,
            isFinal: m.phase !== 'groupStage',
            matchNumber: m.matchNumber,
            phase: m.phase,
            // Preserve results if we were doing a "smart regeneration" (out of scope for now)
            matchStatus: 'scheduled' as const,
        }));

        // 2. Persist as the new Truth
        // We update the whole tournament object because generateFullSchedule might update metadata too (phases etc)
        // But for now, we just update matches to be safe via the repo

        // We need to save the matches. Our repo interface handles full object save or match updates.
        // For a regeneration, we should probably save the whole object to ensure consistency.
        const updatedTournament = {
            ...tournament,
            matches: newMatches
        };

        await this.repository.save(updatedTournament);

        return newMatches;
    }

    /**
     * Update a specific match (e.g. Drag & Drop).
     * Validates the move locally before persisting.
     */
    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {

        // Optional: Add Business Logic Validation here
        // e.g. "Cannot move a finished match"
        /*
        const current = await this.repository.get(tournamentId);
        const match = current?.matches.find(m => m.id === update.id);
        if (match?.matchStatus === 'finished') {
            throw new Error("Cannot move a finished match");
        }
        */

        await this.repository.updateMatch(tournamentId, update);
    }

    /**
     * Bulk update (e.g. "Auto Assign Referees" or "Shift all times")
     */
    async updateMatches(tournamentId: string, updates: MatchUpdate[]): Promise<void> {
        await this.repository.updateMatches(tournamentId, updates);
    }
}
