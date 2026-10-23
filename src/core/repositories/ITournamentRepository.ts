import { Tournament, MatchUpdate } from '../models/types';
import type { StandingDecision } from '../../types/tournament';

/**
 * Interface for Data Access
 * Follows the Repository Pattern to decouple logic from storage.
 */
export interface ITournamentRepository {
    /**
     * Loads a tournament by ID.
     * Returns null if not found.
     */
    /** A-08f3b: `fresh` = auf den Cloud-Stand warten (nur `OfflineRepository`, sonst ohne Wirkung). */
    get(id: string, options?: { fresh?: boolean }): Promise<Tournament | null>;
    getByShareCode(code: string): Promise<Tournament | null>;

    /**
     * Saves a full tournament object.
     * WARNING: Use only for creation or full configuration updates.
     * Avoid using for match updates to prevent concurrency issues.
     * Ergebnis ohne Bedeutung für Aufrufer; `SupabaseRepository` liefert die erreichte Server-Version (C-VERSION-NACH-ERSTANLAGE).
     */
    save(tournament: Tournament): Promise<unknown>;

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
     * Paket TB (Plan v2 § 3.2, R-TB-5): schreibt NUR `standingDecisions` im Turnier-`config`, mit Versionsprüfung
     * (`expectedVersion` = gelesene Version). Konflikt → `OptimisticLockError`; ohne Netz (Cloud) → `NetworkError`
     * mit `isOffline`. Kein Voll-Speichern. Optional wie `syncUp` (alle drei Repositories haben sie).
     */
    updateStandingDecisions?(tournamentId: string, decisions: StandingDecision[], expectedVersion: number): Promise<void>;

    /**
     * Fixrunde TB-6: schreibt NUR die Einstellung `placementsToPlayOut` (Plätze, die bei Gleichstand ausgespielt werden müssen),
     * mit Versionsprüfung wie `updateStandingDecisions`; `standingDecisions` und alles andere bleiben unberührt. Konflikt →
     * `OptimisticLockError`; ohne Netz (Cloud) → `NetworkError` mit `isOffline`.
     */
    updatePlacementsToPlayOut?(tournamentId: string, places: number[], expectedVersion: number): Promise<void>;

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
