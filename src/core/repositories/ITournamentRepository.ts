import { Tournament, MatchUpdate } from '../models/types';

/**
 * Interface for Data Access
 * Follows the Repository Pattern to decouple logic from storage.
 */
export interface ITournamentRepository {
    /**
     * Loads a tournament by ID.
     * Returns null if not found.
     */
    get(id: string): Promise<Tournament | null>;
    getByShareCode(code: string): Promise<Tournament | null>;

    /**
     * Saves a full tournament object.
     * WARNING: Use only for creation or full configuration updates.
     * Avoid using for match updates to prevent concurrency issues.
     */
    save(tournament: Tournament): Promise<void>;

    /**
     * Updates a specific match.
     * This is atomic/granular to avoid overwriting other matches.
     */
    updateMatch(tournamentId: string, update: MatchUpdate): Promise<void>;

    /**
     * Bulk updates multiple matches.
     * Useful for schedule generation or mass-edits.
     */
    updateMatches(tournamentId: string, updates: MatchUpdate[], baseVersion?: number): Promise<void>;

    /**
     * Delete a tournament.
     */
    delete(id: string): Promise<void>;

    /**
     * Lists all tournaments relevant for the current user.
     * - LocalStorage: Returns all tournaments.
     * - Supabase: Returns tournaments owned by the user.
     */
    listForCurrentUser(): Promise<Tournament[]>;

    /**
     * Syncs local data to cloud.
     * Only relevant for OfflineRepository - others can no-op.
     */
    syncUp?(): Promise<void>;

    // ==========================================================================
    // VISIBILITY & SHARING
    // ==========================================================================

    /**
     * Makes a tournament publicly accessible by generating a share code.
     * Returns the generated share code and creation timestamp.
     * For local-only storage, this generates a local share code.
     */
    makeTournamentPublic(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null>;

    /**
     * Makes a tournament private by removing the share code.
     */
    makeTournamentPrivate(tournamentId: string): Promise<void>;

    /**
     * Regenerates the share code for a public tournament.
     * Returns the new share code and creation timestamp.
     */
    regenerateShareCode(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null>;
}
