/**
 * Schedule Helper Functions
 *
 * Utility functions for schedule-related operations:
 * - Match status detection
 * - Team name resolution
 */

import { Tournament, Team, Match } from '../../../types/tournament';
import { STORAGE_KEYS } from '../../../constants/storage';
import { LiveMatch } from '../../../components/match-cockpit/MatchCockpit';

// Type for stored live matches in localStorage
type StoredLiveMatches = Record<string, LiveMatch>;

/**
 * Check if a match is finished based on scores and live status
 *
 * @param matchId - The match ID to check
 * @param matches - All tournament matches
 * @param tournamentId - Tournament ID for localStorage lookup
 * @returns true if the match is finished
 */
export function isMatchFinished(
  matchId: string,
  matches: Match[],
  tournamentId: string
): boolean {
  // 1. Check if scores exist
  const match = matches.find(m => m.id === matchId);
  if (match?.scoreA === undefined || match.scoreB === undefined) {
    return false;
  }

  // 2. Check liveMatches status if available
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.liveMatches(tournamentId));
    if (stored) {
      const liveMatches = JSON.parse(stored) as StoredLiveMatches;
      if (liveMatches[matchId].status === 'FINISHED') {
        return true;
      }
    }
  } catch {
    // Ignore parse errors
  }

  // 3. Fallback: implicit detection (has scores = finished)
  return true;
}

/**
 * Resolve team ID to team name
 *
 * @param teamId - The team ID to resolve
 * @param teams - All tournament teams
 * @returns Team name or the original ID if not found
 */
export function getTeamName(teamId: string, teams: Team[]): string {
  const team = teams.find(t => t.id === teamId);
  return team?.name || teamId; // || is intentional: empty name should also fallback
}

/**
 * Check if a match is currently running (LIVE)
 *
 * @param matchId - The match ID to check
 * @param tournamentId - Tournament ID for localStorage lookup
 * @returns true if the match is currently running
 */
export function isMatchRunning(matchId: string, tournamentId: string): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.liveMatches(tournamentId));
    if (stored) {
      const liveMatches = JSON.parse(stored) as StoredLiveMatches;
      return liveMatches[matchId].status === 'RUNNING';
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

/**
 * Get all finished match IDs for a tournament
 *
 * @param tournament - The tournament
 * @returns Set of finished match IDs
 */
export function getFinishedMatchIds(tournament: Tournament): Set<string> {
  return new Set(
    tournament.matches
      .filter(m => isMatchFinished(m.id, tournament.matches, tournament.id))
      .map(m => m.id)
  );
}
