import { setTournamentClosed } from '../core/services/closedTournaments';
import { isTournamentClosed } from '../core/services/lifecycle';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tournament, TRASH_RETENTION_DAYS } from '../types/tournament';
import { useRepository } from '../hooks/useRepository';
import { useAuth } from '../features/auth/hooks/useAuth';
import { filterWithoutGuestEngineEntries } from '../core/match/client/guestEngineEntries';
import { migrateLocationsToStructured } from '../utils/locationHelpers';
import {
  getActiveTournaments,
  getTrashedTournaments,
  getExpiredTrashedTournaments,
  getRemainingDays,
} from '../utils/tournamentCategories';

/**
 * Custom hook for managing tournaments
 * Verwendet Repository Pattern - automatisch Offline/Online Sync
 */
export const useTournaments = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [allActiveCount, setAllActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const repository = useRepository();
  const { isAuthenticated, isGuest } = useAuth();

  // G7: ausgeblendet wird nur im Konto — im Gastmodus (nach Abmelden) bleibt
  // alles sichtbar, inklusive der Ergebnisse in der lokalen Engine-Kopie.
  const hideGuestTournaments = isAuthenticated && !isGuest;

  // Load tournaments function - extracted for reuse
  const loadTournaments = useCallback(async () => {
    try {
      // Use listForCurrentUser from repository (handles Offline/Online/Auth)
      const loaded = await repository.listForCurrentUser();

      // Migration: Convert old string locations to LocationDetails
      const migrated = migrateLocationsToStructured(loaded);

      // Check if any tournaments were migrated
      const hasChanges = migrated.some((_, idx) =>
        typeof loaded[idx]?.location === 'string'
      );

      // If migrations occurred, save them back
      if (hasChanges) {
        await Promise.all(migrated.map(t => repository.save(t)));
      }

      // G7: Turnier-Limit zählt auch ausgeblendete Turniere weiter — daher der
      // ungefilterte Zähler vor dem Ausblenden in der Anzeige.
      setAllActiveCount(getActiveTournaments(migrated).length);
      // R3-3: `useCan` und die Sperren der Oberfläche kennen den Abschluss jedes Turniers der Liste (Wizard, Startseite)
      migrated.forEach((t) => { setTournamentClosed(t.id, isTournamentClosed(t)); });
      setTournaments(
        hideGuestTournaments
          ? await filterWithoutGuestEngineEntries(migrated)
          : migrated
      );
    } catch (error) {
      console.error('Failed to load tournaments:', error);
    } finally {
      setLoading(false);
    }
  }, [repository, hideGuestTournaments]);

  // Load tournaments on mount and when repository changes
  useEffect(() => {
    void loadTournaments();
  }, [loadTournaments]);

  // Listen for localStorage changes (Legacy support for guest mode sharing tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tournaments') {
        void loadTournaments();
      }
    };

    // Also listen for custom events (same-tab updates)
    const handleTournamentUpdate = () => {
      // Need to re-fetch to get fresh state if repository relies on external state
      void loadTournaments();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tournament-updated', handleTournamentUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tournament-updated', handleTournamentUpdate);
    };
  }, [loadTournaments]);

  // Save tournament
  const saveTournament = useCallback(async (tournament: Tournament) => {
    try {
      await repository.save(tournament);
      // Reload tournaments / Update state optimistically better?
      // For now, reload to be safe and consistent with previous behavior
      await loadTournaments();
    } catch (error) {
      console.error('Failed to save tournament:', error);
      throw error;
    }
  }, [repository, loadTournaments]);

  // Delete tournament (Legacy/Permanent)
  const deleteTournament = useCallback(async (id: string) => {
    try {
      await repository.delete(id);
      await loadTournaments();
    } catch (error) {
      console.error('Failed to delete tournament:', error);
      throw error;
    }
  }, [repository, loadTournaments]);

  // Get tournament by ID
  const getTournament = (id: string): Tournament | undefined => {
    return tournaments.find(t => t.id === id);
  };

  // ============================================================================
  // SOFT DELETE / PAPIERKORB FUNCTIONS
  // ============================================================================

  /**
   * Active tournaments (not in trash)
   */
  const activeTournaments = useMemo(
    () => getActiveTournaments(tournaments),
    [tournaments]
  );

  /**
   * Trashed tournaments (soft-deleted)
   */
  const trashedTournaments = useMemo(
    () => getTrashedTournaments(tournaments),
    [tournaments]
  );

  /**
   * Soft Delete: Move tournament to trash
   * Sets deletedAt timestamp, tournament can be restored within TRASH_RETENTION_DAYS
   */
  const softDeleteTournament = useCallback(async (id: string) => {
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) { return; }
    if (isTournamentClosed(tournament)) { throw new Error('TOURNAMENT_CLOSED'); } // R3-3: der Server lehnt `deleted_at` mit 55000 ab; der Aufrufer meldet es

    const updated: Tournament = {
      ...tournament,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTournament(updated);
  }, [saveTournament, tournaments]);

  /**
   * Restore tournament from trash
   * Optionally restore as 'draft'
   */
  const restoreTournament = useCallback(async (
    id: string,
    options?: { restoreAs?: 'draft' }
  ) => {
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) { return; }
    if (isTournamentClosed(tournament)) { throw new Error('TOURNAMENT_CLOSED'); } // R3-3

    const updated: Tournament = {
      ...tournament,
      deletedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    // If restoring as draft, set status
    if (options?.restoreAs === 'draft') {
      updated.status = 'draft';
    }

    await saveTournament(updated);
  }, [saveTournament, tournaments]);

  /**
   * Permanent Delete: Remove tournament completely (cannot be undone)
   */
  const permanentDeleteTournament = useCallback(async (id: string) => {
    await deleteTournament(id);
  }, [deleteTournament]);

  /**
   * Cleanup expired trash: Permanently delete tournaments past retention period
   * Returns number of tournaments deleted
   */
  const cleanupExpiredTrash = useCallback(async (): Promise<number> => {
    const expired = getExpiredTrashedTournaments(tournaments);

    if (expired.length === 0) { return 0; }

    for (const tournament of expired) {
      await repository.delete(tournament.id);
    }

    await loadTournaments();

    return expired.length;
  }, [tournaments, repository, loadTournaments]);

  /**
   * Empty trash: Permanently delete all trashed tournaments
   */
  const emptyTrash = useCallback(async () => {
    const trashed = getTrashedTournaments(tournaments);

    for (const tournament of trashed) {
      await repository.delete(tournament.id);
    }

    await loadTournaments();
  }, [tournaments, repository, loadTournaments]);

  return {
    // Original exports
    tournaments,
    loading,
    saveTournament,
    deleteTournament,
    getTournament,

    // G7: ungefilterte aktive Anzahl (für das Turnier-Limit)
    allActiveCount,

    // Soft Delete / Papierkorb
    activeTournaments,
    trashedTournaments,
    softDeleteTournament,
    restoreTournament,
    permanentDeleteTournament,
    cleanupExpiredTrash,
    emptyTrash,

    // Utilities
    getRemainingDays,
    TRASH_RETENTION_DAYS,
  };
};
