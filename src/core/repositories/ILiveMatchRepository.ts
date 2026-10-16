import { LiveMatch } from '../models/LiveMatch';

/**
 * Interface for LiveMatch Data Access
 * 
 * Manages the transient state of matches during live execution.
 * Separate from ITournamentRepository which handles persistent data.
 *
 * Nur lesend (A-08d2a, @FU-084): Schreibwege laufen ueber den Server (`append_match_events`),
 * nicht ueber dieses Interface.
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
}
