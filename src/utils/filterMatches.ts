/**
 * Match Filtering Utilities
 *
 * Functions to filter matches based on ScheduleFilters.
 * Used in schedule view to show filtered match lists.
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md Section 6.3
 */

import { Match, Team } from '../types/tournament';
import { ScheduleFilters } from '../types/scheduleFilters';

/**
 * Filter matches based on ScheduleFilters
 *
 * All active filters are combined with AND logic.
 *
 * @param matches - Array of matches to filter
 * @param filters - Current filter settings
 * @param teams - Array of teams for name lookup (team search)
 * @returns Filtered array of matches
 */
export function filterMatches(
  matches: Match[],
  filters: ScheduleFilters,
  teams: Team[]
): Match[] {
  return matches.filter((match) => {
    // Phase filter
    // Robustness: Check phase OR isFinal
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if phase check passes OR isFinal is set
    const isFinalPhase = (match.phase && match.phase !== 'groupStage') || match.isFinal;

    if (filters.phase === 'groupStage' && isFinalPhase) {
      return false;
    }
    if (filters.phase === 'finals' && !isFinalPhase) {
      return false;
    }

    // Group filter
    if (filters.group && filters.group !== 'all') {
      // If match is final (not groupStage) and has no group, it should NOT be filtered out by group filter
      // UNLESS the user is specifically looking for group matches (which they would do via Phase filter)
      // Robustness: Check phase OR isFinal (legacy/raw data compatibility)
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if phase check passes OR isFinal is set
      const isFinalPhase = (match.phase && match.phase !== 'groupStage') || match.isFinal;

      if (!isFinalPhase && match.group !== filters.group) {
        return false;
      }
      // If it IS a final, and it somehow HAS a group (rare), filter it.
      if (isFinalPhase && match.group && match.group !== filters.group) {
        return false;
      }
    }

    // Field filter
    if (filters.field && match.field !== filters.field) {
      return false;
    }

    // Status filter (multi-select)
    if (filters.status.length > 0) {
      const matchStatus = match.matchStatus ?? 'scheduled';
      if (!filters.status.includes(matchStatus)) {
        return false;
      }
    }

    // Team search
    if (filters.teamSearch) {
      const searchLower = filters.teamSearch.toLowerCase().trim();
      if (searchLower.length >= 2) {
        const teamA = teams.find((t) => t.id === match.teamA);
        const teamB = teams.find((t) => t.id === match.teamB);
        /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if either team matches */
        const matchesTeam =
          teamA?.name.toLowerCase().includes(searchLower) ||
          teamB?.name.toLowerCase().includes(searchLower);
        /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
        if (!matchesTeam) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Count active filters (excluding phase which is shown inline)
 *
 * Used for badge count on mobile filter button.
 *
 * @param filters - Current filter settings
 * @returns Number of active filters (0-4)
 */
export function countActiveFilters(filters: ScheduleFilters): number {
  let count = 0;
  // Phase is not counted (shown inline on mobile)
  if (filters.group) {
    count++;
  }
  if (filters.field) {
    count++;
  }
  if (filters.status.length > 0) {
    count++;
  }
  if (filters.teamSearch.trim().length >= 2) {
    count++;
  }
  return count;
}

/**
 * Check if any filter is active (including phase)
 *
 * Used to show/hide "Reset all" button.
 *
 * @param filters - Current filter settings
 * @returns true if any filter is active
 */
export function hasActiveFilters(filters: ScheduleFilters): boolean {
  return (
    filters.phase !== 'all' ||
    filters.group !== null ||
    filters.field !== null ||
    filters.status.length > 0 ||
    filters.teamSearch.trim().length >= 2
  );
}

/**
 * Search teams by name
 *
 * Used for autocomplete in team search input.
 *
 * @param query - Search query (min 2 chars)
 * @param teams - Array of teams to search
 * @returns Filtered array of matching teams
 */
export function searchTeams(query: string, teams: Team[]): Team[] {
  const normalized = query.toLowerCase().trim();
  if (normalized.length < 2) {
    return [];
  }

  return teams.filter((team) =>
    team.name.toLowerCase().includes(normalized)
  );
}
