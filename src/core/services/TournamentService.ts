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
    async loadTournament(id: string): Promise<Tournament | null> {
        const tournament = await this.repository.get(id);

        if (!tournament) {return null;}

        // Ensure schedule is initialized (handles empty matches)
        const matches = await this.scheduleService.initializeSchedule(id);

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
