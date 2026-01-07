import { LiveMatch } from '../models/LiveMatch';

/**
 * Interface for LiveMatch Data Access
 * 
 * Manages the transient state of matches during live execution.
 * Separate from ITournamentRepository which handles persistent data.
 */
export interface ILiveMatchRepository {
    /**
     * Get a single live match by ID
     */
    get(tournamentId: string, matchId: string): Promise<LiveMatch | null>;

    /**
     * Get all live matches for a tournament
     */
    getAll(tournamentId: string): Promise<Map<string, LiveMatch>>;

    /**
     * Save/update a live match
     */
    save(tournamentId: string, match: LiveMatch): Promise<void>;

    /**
     * Save multiple live matches at once
     */
    saveAll(tournamentId: string, matches: Map<string, LiveMatch>): Promise<void>;

    /**
     * Delete a single live match
     */
    delete(tournamentId: string, matchId: string): Promise<void>;

    /**
     * Clear all live matches for a tournament
     */
    clear(tournamentId: string): Promise<void>;
}
