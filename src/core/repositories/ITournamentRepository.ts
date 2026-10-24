import { Tournament, MatchUpdate } from '../models/types';
import type { BracketLogEntry } from '../../types/tournament';
import type {
  CompleteGroupRequest, CompleteGroupResult, RecordDecisionRequest, RecordDecisionResult, ReopenGroupResult,
} from './groupCompletionCloud';

/** Optionen fuer `makeTournamentPublic`. */
export interface MakePublicOptions {
    requireCloud?: boolean;
}

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
     * GA4 A-13b-C (R-GA4v2-1, `record_standing_decision`): trägt eine Gleichstands-Entscheidung ein oder nimmt sie zurück –
     * `config.standingDecisions` und Verlauf (Person, Zeit, Grund einer Reihenfolge) in EINER Transaktion am Server, mit
     * Versionsprüfung (`expectedVersion` = gelesene Version; `STALE` bei Konflikt). Ersetzt den REST-Schreibweg. Ohne Netz
     * (Cloud) → `NetworkError` mit `isOffline`; Verklemmung/Wartezeit → `RetryLaterError`. Online-only bis A-15c.
     */
    recordStandingDecision?(tournamentId: string, request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult>;

    /**
     * GA4 A-13b-C (`complete_group`): „Gruppe abschließen“. Rangfolge, Entscheidungen und Stand kommen vom Gerät
     * (`GroupCompletionService.prepareGroupCompletion`), der Server prüft sie und besetzt die Folgespiele. Ohne Netz →
     * `NetworkError` mit `isOffline` (Warteschlange erst A-15c); Verklemmung/Wartezeit → `RetryLaterError`.
     */
    completeGroup?(tournamentId: string, request: CompleteGroupRequest): Promise<CompleteGroupResult>;

    /** GA4 A-13b-C (`reopen_group`, @TM-099): Gruppe wieder öffnen, Grund Pflicht. Fehler wie `completeGroup`. */
    reopenGroup?(tournamentId: string, groupId: string, reason: string): Promise<ReopenGroupResult>;

    /**
     * GA4 A-13b-C (`bracket_log_read`): Verlauf der Besetzung und der Entscheidungen. Nur die Turnierleitung bekommt Zeilen
     * (sonst leer); `undefined`, wenn er nicht gelesen werden konnte. Im Turnier steht er als `decisionLog`.
     */
    readBracketLog?(tournamentId: string): Promise<BracketLogEntry[] | undefined>;

    /**
     * Fixrunde TB-6: schreibt NUR die Einstellung `placementsToPlayOut` (Plätze, die bei Gleichstand ausgespielt werden müssen),
     * mit Versionsprüfung wie `recordStandingDecision`; `standingDecisions` und alles andere bleiben unberührt. Konflikt →
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
     *
     * `requireCloud` (@W1-020, C-FESTLEGEN-TEILT-NICHT): Der Code muss vom Server kommen. Das Repository wartet, bis das
     * Turnier in der Cloud angekommen ist, und weicht bei einem Fehler NICHT auf einen lokalen Code aus, sondern wirft.
     * Nur `OfflineRepository` wertet das aus; die anderen Implementierungen ignorieren es.
     */
    makeTournamentPublic(tournamentId: string, options?: MakePublicOptions): Promise<{ shareCode: string; createdAt: string } | null>;

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
