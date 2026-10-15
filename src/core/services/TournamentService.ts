import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { Tournament } from '../models/types';
import { ScheduleService } from './ScheduleService';

/**
 * TournamentService
 * High-level service for full Tournament lifecycle.
 * Composes ScheduleService for match-specific logic.
 */
export class TournamentService {
    private scheduleService: ScheduleService;

    constructor(private repository: ITournamentRepository) {
        this.scheduleService = new ScheduleService(repository);
    }

    /**
     * Loads a tournament and initializes its schedule if needed.
     */
    async loadTournament(id: string, options?: { fresh?: boolean }): Promise<Tournament | null> {
        // A-08f3b: `fresh` (Push/Abfrage-Ausweichen) wartet auf den zusammengeführten Cloud-Stand.
        const tournament = await this.repository.get(id, options);

        if (!tournament) {return null;}

        // Ensure schedule is initialized (handles empty matches). A-08f-F2: vorhandene Spiele direkt
        // verwenden -- kein zweiter repository.get (halbiert die Last beim Abfrage-Ausweichen).
        const matches = tournament.matches.length > 0
            ? tournament.matches
            : await this.scheduleService.initializeSchedule(id);

        // Return tournament with potentially updated matches
        return {
            ...tournament,
            matches
        };
    }

    /**
     * Updates tournament metadata (NOT matches).
     * Use ScheduleService for match updates.
     */
    async updateTournament(tournament: Tournament): Promise<void> {
        await this.repository.save(tournament);
    }

    /**
     * Access to underlying ScheduleService for match operations.
     */
    get schedule(): ScheduleService {
        return this.scheduleService;
    }
}
