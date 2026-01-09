/**
 * useUserTournaments Hook - Turniere des aktuellen Users
 *
 * Kombiniert User-Memberships mit Turnier-Daten.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.3
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Tournament, Match } from '../../../types/tournament';
import type { TournamentMembership } from '../types/auth.types';
import { AUTH_STORAGE_KEYS } from '../types/auth.types';
import { useAuth } from './useAuth';
import type { TournamentDisplayStatus, TournamentCardData } from '../components/TournamentCard';
import { useRepository } from '../../../hooks/useRepository';

/**
 * Turnier mit Membership-Info
 */
export interface UserTournament {
  tournament: TournamentCardData;
  membership: TournamentMembership;
  teamNames: string[];
}

/**
 * Sortieroptionen für Turniere
 */
export type TournamentSortOption = 'recent' | 'name' | 'date' | 'status';

/**
 * Return-Type des Hooks
 */
export interface UseUserTournamentsReturn {
  /** Turniere mit Membership-Info */
  tournaments: UserTournament[];
  /** Lade-Status */
  isLoading: boolean;
  /** Fehler */
  error: string | null;
  /** Aktualisiert die Turnier-Liste */
  refresh: () => Promise<void>;
  /** Anzahl Turniere nach Status */
  counts: {
    total: number;
    live: number;
    upcoming: number;
    finished: number;
    draft: number;
  };
}

/**
 * Ermittelt den Anzeige-Status eines Turniers
 */
const getTournamentDisplayStatus = (tournament: Tournament): TournamentDisplayStatus => {
  // Draft status
  if (tournament.status === 'draft') {
    return 'draft';
  }

  // Manuell beendet
  if (tournament.manuallyCompleted) {
    return 'finished';
  }

  // Check if any match is running (live)
  const hasRunningMatch = tournament.matches.some(
    (match: Match) => match.matchStatus === 'running'
  );
  if (hasRunningMatch) {
    return 'live';
  }

  // Check if all matches are finished
  const allMatchesFinished =
    tournament.matches.length > 0 &&
    tournament.matches.every(
      (match: Match) => match.matchStatus === 'finished' || match.matchStatus === 'skipped'
    );
  if (allMatchesFinished) {
    return 'finished';
  }

  // Has any match started?
  const hasStartedMatch = tournament.matches.some(
    (match: Match) =>
      match.matchStatus === 'finished' || match.matchStatus === 'running'
  );
  if (hasStartedMatch) {
    // In progress but no running match = paused
    return 'upcoming';
  }

  return 'upcoming';
};

/**
 * Konvertiert Tournament zu TournamentCardData
 */
const toCardData = (tournament: Tournament): TournamentCardData => ({
  id: tournament.id,
  title: tournament.title,
  status: getTournamentDisplayStatus(tournament),
  teamCount: tournament.teams.length,
  fieldCount: tournament.numberOfFields,
  date: tournament.date,
  location:
    typeof tournament.location === 'string'
      ? tournament.location
      : tournament.location.name,
});

/**
 * Sortiert Turniere
 */
const sortTournaments = (
  tournaments: UserTournament[],
  sortBy: TournamentSortOption
): UserTournament[] => {
  const sorted = [...tournaments];

  switch (sortBy) {
    case 'recent':
      // Neueste zuerst (nach updatedAt oder createdAt)
      sorted.sort((a, b) => {
        const dateA = new Date(a.membership.updatedAt).getTime();
        const dateB = new Date(b.membership.updatedAt).getTime();
        return dateB - dateA;
      });
      break;

    case 'name':
      sorted.sort((a, b) => a.tournament.title.localeCompare(b.tournament.title));
      break;

    case 'date':
      sorted.sort((a, b) => {
        const dateA = a.tournament.date ? new Date(a.tournament.date).getTime() : 0;
        const dateB = b.tournament.date ? new Date(b.tournament.date).getTime() : 0;
        return dateB - dateA;
      });
      break;

    case 'status': {
      // Live > Upcoming > Draft > Finished
      const statusOrder: Record<TournamentDisplayStatus, number> = {
        live: 0,
        upcoming: 1,
        draft: 2,
        finished: 3,
      };
      sorted.sort(
        (a, b) => statusOrder[a.tournament.status] - statusOrder[b.tournament.status]
      );
      break;
    }
  }

  return sorted;
};

/**
 * Hook für die Turniere des aktuellen Users
 *
 * @param sortBy - Sortier-Option
 * @returns Turniere mit Membership-Info
 */
export const useUserTournaments = (
  sortBy: TournamentSortOption = 'recent'
): UseUserTournamentsReturn => {
  const { user, isLoading: authLoading } = useAuth();
  const [tournaments, setTournaments] = useState<UserTournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const repository = useRepository();

  /**
   * Lädt Turniere für den aktuellen User
   */
  const loadTournaments = useCallback(async () => {
    if (!user) {
      setTournaments([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load memberships from localStorage (Legacy / Hybrid support)
      // TODO: Move memberships to Repository too
      const membershipsRaw = localStorage.getItem(AUTH_STORAGE_KEYS.MEMBERSHIPS);
      const allMemberships: TournamentMembership[] = membershipsRaw
        ? (JSON.parse(membershipsRaw) as TournamentMembership[])
        : [];

      // Filter for current user
      const userMemberships = allMemberships.filter((m) => m.userId === user.id);

      // Load tournaments via Repository
      // This automatically handles Local vs Cloud vs Offline
      const allTournaments = await repository.listForCurrentUser();

      // Combine memberships with tournaments
      const userTournaments: UserTournament[] = [];

      // Iterate relevant tournaments from repository
      for (const t of allTournaments) {
        // Check for existing membership
        const existingMembership = userMemberships.find(m => m.tournamentId === t.id);

        if (existingMembership) {
          // Use existing membership logic
          const teamNames = existingMembership.teamIds.map(tid => t.teams.find(tm => tm.id === tid)?.name ?? '').filter(Boolean);
          userTournaments.push({ tournament: toCardData(t), membership: existingMembership, teamNames });
        } else {
          // Implicit Owner Membership (if not found in legacy memberships)
          userTournaments.push({
            tournament: toCardData(t),
            membership: {
              id: `owner-${t.id}`,
              userId: user.id,
              tournamentId: t.id,
              role: 'owner',
              teamIds: [],
              createdAt: t.createdAt,
              updatedAt: t.updatedAt
            },
            teamNames: []
          });
        }
      }

      setTournaments(userTournaments);

    } catch (err) {
      console.error('Failed to load user tournaments:', err);
      setError('Turniere konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [user, repository]);

  // Load on mount and when user changes
  useEffect(() => {
    if (!authLoading) {
      void loadTournaments();
    }
  }, [authLoading, loadTournaments]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tournaments' || e.key === AUTH_STORAGE_KEYS.MEMBERSHIPS) {
        void loadTournaments();
      }
    };

    const handleTournamentUpdate = () => {
      void loadTournaments();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tournament-updated', handleTournamentUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tournament-updated', handleTournamentUpdate);
    };
  }, [loadTournaments]);

  // Sort tournaments
  const sortedTournaments = useMemo(
    () => sortTournaments(tournaments, sortBy),
    [tournaments, sortBy]
  );

  // Count by status
  const counts = useMemo(() => {
    const result = {
      total: tournaments.length,
      live: 0,
      upcoming: 0,
      finished: 0,
      draft: 0,
    };

    for (const t of tournaments) {
      switch (t.tournament.status) {
        case 'live':
          result.live++;
          break;
        case 'upcoming':
          result.upcoming++;
          break;
        case 'finished':
          result.finished++;
          break;
        case 'draft':
          result.draft++;
          break;
      }
    }

    return result;
  }, [tournaments]);

  return {
    tournaments: sortedTournaments,
    isLoading: isLoading || authLoading,
    error,
    refresh: loadTournaments,
    counts,
  };
};

export default useUserTournaments;
