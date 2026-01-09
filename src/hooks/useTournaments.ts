import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tournament, TournamentStatsSnapshot, TRASH_RETENTION_DAYS } from '../types/tournament';
import { useRepository } from '../hooks/useRepository';
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
  const [loading, setLoading] = useState(true);
  const repository = useRepository();

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

      setTournaments(migrated);
    } catch (error) {
      console.error('Failed to load tournaments:', error);
    } finally {
      setLoading(false);
    }
  }, [repository]);

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

    const updated: Tournament = {
      ...tournament,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTournament(updated);
  }, [saveTournament, tournaments]);

  /**
   * Restore tournament from trash
   * Optionally restore as 'finished' or 'draft' if date is in past
   */
  const restoreTournament = useCallback(async (
    id: string,
    options?: { restoreAs?: 'finished' | 'draft' }
  ) => {
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) { return; }

    const updated: Tournament = {
      ...tournament,
      deletedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    // If restoring as draft, set status
    if (options?.restoreAs === 'draft') {
      updated.status = 'draft';
    }
    // If restoring as finished, mark as completed
    if (options?.restoreAs === 'finished') {
      updated.manuallyCompleted = true;
      updated.completedAt = new Date().toISOString();
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

  // ============================================================================
  // TOURNAMENT COMPLETION FUNCTIONS
  // ============================================================================

  /**
   * Create stats snapshot for archiving
   */
  const createStatsSnapshot = (tournament: Tournament): TournamentStatsSnapshot => {
    const matches = tournament.matches;
    const teams = tournament.teams;

    const totalMatches = matches.length;
    const completedMatches = matches.filter(
      m => typeof m.scoreA === 'number' && typeof m.scoreB === 'number'
    ).length;

    const totalGoals = matches.reduce((sum, m) => {
      return sum + (m.scoreA ?? 0) + (m.scoreB ?? 0);
    }, 0);

    return {
      teamCount: teams.length,
      totalMatches,
      completedMatches,
      totalGoals,
      createdAt: new Date().toISOString(),
    };
  };

  /**
   * Finish tournament: Mark as completed and create stats snapshot
   */
  const finishTournament = useCallback(async (id: string) => {
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) { return; }

    const updated: Tournament = {
      ...tournament,
      manuallyCompleted: true,
      completedAt: new Date().toISOString(),
      statsSnapshot: createStatsSnapshot(tournament),
      updatedAt: new Date().toISOString(),
    };

    await saveTournament(updated);
  }, [saveTournament, tournaments]);

  /**
   * Cancel tournament: Mark as cancelled with reason
   */
  const cancelTournament = useCallback(async (id: string, reason?: string) => {
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) { return; }

    const updated: Tournament = {
      ...tournament,
      dashboardStatus: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledReason: reason,
      statsSnapshot: createStatsSnapshot(tournament),
      updatedAt: new Date().toISOString(),
    };

    await saveTournament(updated);
  }, [saveTournament, tournaments]);

  return {
    // Original exports
    tournaments,
    loading,
    saveTournament,
    deleteTournament,
    getTournament,

    // Soft Delete / Papierkorb
    activeTournaments,
    trashedTournaments,
    softDeleteTournament,
    restoreTournament,
    permanentDeleteTournament,
    cleanupExpiredTrash,
    emptyTrash,

    // Tournament Completion
    finishTournament,
    cancelTournament,

    // Utilities
    getRemainingDays,
    TRASH_RETENTION_DAYS,
  };
};
