/**
 * teamHelpers.ts - Helper functions for TOUR-EDIT-TEAMS
 *
 * Provides utilities for:
 * - Counting matches with/without results per team
 * - Safe team deletion with result preservation
 * - Team renaming with cascading updates
 */

import { Match, Team, Tournament } from '../types/tournament';
import { matchInvolvesTeam } from '../core/models/matchSlot';

/**
 * Check if a match has a result (score entered)
 */
export function matchHasResult(match: Match): boolean {
  return (
    match.scoreA !== undefined &&
    match.scoreB !== undefined
  );
}

/**
 * „Spiel mit Ereignissen" (@W5-009): Ergebnis (auch halb), Laufzeit-Events oder Status ungleich geplant.
 * Ein geschütztes Spiel bleibt beim Entfernen eines Teams und bei der Neuplanung erhalten.
 */
export function matchHasEvents(match: Match): boolean {
  return (
    match.scoreA !== undefined ||
    match.scoreB !== undefined ||
    matchHasResult(match) ||
    (match.events?.length ?? 0) > 0 ||
    (match.matchStatus !== undefined && match.matchStatus !== 'scheduled')
  );
}

/**
 * Get all matches involving a specific team
 */
export function getTeamMatches(matches: Match[], teamId: string): Match[] {
  return matches.filter(m => matchInvolvesTeam(m, teamId));
}

/**
 * Analyze a team's match statistics
 */
export interface TeamMatchAnalysis {
  teamId: string;
  teamName: string;
  totalMatches: number;
  matchesWithResults: number;
  matchesWithoutResults: number;
  matchesWithResultsIds: string[];
  matchesWithoutResultsIds: string[];
}

export function analyzeTeamMatches(
  team: Team,
  matches: Match[]
): TeamMatchAnalysis {
  const teamMatches = getTeamMatches(matches, team.id);

  const withResults = teamMatches.filter(matchHasResult);
  const withoutResults = teamMatches.filter(m => !matchHasResult(m));

  return {
    teamId: team.id,
    teamName: team.name,
    totalMatches: teamMatches.length,
    matchesWithResults: withResults.length,
    matchesWithoutResults: withoutResults.length,
    matchesWithResultsIds: withResults.map(m => m.id),
    matchesWithoutResultsIds: withoutResults.map(m => m.id),
  };
}

/**
 * Result of a team deletion operation
 */
export interface TeamDeletionResult {
  success: boolean;
  team: Team;

  // Stats
  matchesRemoved: number;
  matchesPreserved: number;

  // Updated data
  updatedTeams: Team[];
  updatedMatches: Match[];

  // For undo capability
  removedMatchIds: string[];
}

/**
 * Delete a team with intelligent handling of matches with/without results
 *
 * Rules:
 * - Matches WITHOUT results: Remove from schedule completely
 * - Matches WITH results: Keep in schedule, mark team as removed
 */
export function deleteTeamSafely(
  tournament: Pick<Tournament, 'teams' | 'matches'>,
  teamId: string
): TeamDeletionResult {
  const team = tournament.teams.find(t => t.id === teamId);

  if (!team) {
    throw new Error(`Team with ID ${teamId} not found`);
  }

  // @W5-009: geschützt ist jedes Spiel mit Ereignissen (matchHasEvents), nicht erst eines mit vollem Ergebnis.
  const teamMatches = getTeamMatches(tournament.matches, teamId);
  const protectedIds = teamMatches.filter(matchHasEvents).map(m => m.id);
  const unprotectedIds = teamMatches.filter(m => !matchHasEvents(m)).map(m => m.id);

  // If team has protected matches, mark as removed instead of deleting
  if (protectedIds.length > 0) {
    // Mark team as removed
    const updatedTeams = tournament.teams.map(t =>
      t.id === teamId
        ? { ...t, isRemoved: true, removedAt: new Date().toISOString() }
        : t
    );

    // Remove only unprotected matches
    const updatedMatches = tournament.matches.filter(
      m => !unprotectedIds.includes(m.id)
    );

    return {
      success: true,
      team,
      matchesRemoved: unprotectedIds.length,
      matchesPreserved: protectedIds.length,
      updatedTeams,
      updatedMatches,
      removedMatchIds: unprotectedIds,
    };
  }

  // Team has NO protected matches - fully delete
  const updatedTeams = tournament.teams.filter(t => t.id !== teamId);
  const updatedMatches = tournament.matches.filter(
    m => !matchInvolvesTeam(m, teamId)
  );

  return {
    success: true,
    team,
    matchesRemoved: unprotectedIds.length,
    matchesPreserved: 0,
    updatedTeams,
    updatedMatches,
    removedMatchIds: unprotectedIds,
  };
}

/**
 * Generate warning message for team deletion
 */
export function getTeamDeletionWarning(analysis: TeamMatchAnalysis): string | null {
  if (analysis.matchesWithResults === 0 && analysis.matchesWithoutResults === 0) {
    return null; // No matches, no warning needed
  }

  if (analysis.matchesWithResults === 0) {
    // Only matches without results - simple deletion
    return `"${analysis.teamName}" hat ${analysis.matchesWithoutResults} geplante Spiele ohne Ergebnisse. Diese werden aus dem Spielplan entfernt.`;
  }

  if (analysis.matchesWithoutResults === 0) {
    // Only matches with results - team will be marked as removed
    return `"${analysis.teamName}" hat ${analysis.matchesWithResults} Spiele mit Ergebnissen. Das Team wird als "entfernt" markiert, die Ergebnisse bleiben erhalten.`;
  }

  // Mixed case
  return `"${analysis.teamName}" hat ${analysis.matchesWithResults} Spiele mit Ergebnissen und ${analysis.matchesWithoutResults} ohne Ergebnisse.\n\n` +
    `• Die ${analysis.matchesWithoutResults} Spiele ohne Ergebnisse werden entfernt.\n` +
    `• Die ${analysis.matchesWithResults} Spiele mit Ergebnissen bleiben erhalten.\n` +
    `• Das Team wird als "entfernt" markiert.`;
}

/**
 * Result of a team rename operation
 */
export interface TeamRenameResult {
  success: boolean;
  oldName: string;
  newName: string;
  affectedMatches: number;
  updatedTeams: Team[];
}

/**
 * Rename a team - updates the team in the teams array
 * Match references use team IDs, so they don't need updating
 */
export function renameTeam(
  tournament: Tournament,
  teamId: string,
  newName: string
): TeamRenameResult {
  const team = tournament.teams.find(t => t.id === teamId);

  if (!team) {
    throw new Error(`Team with ID ${teamId} not found`);
  }

  const oldName = team.name;

  // Check if name is actually changing
  if (oldName === newName) {
    return {
      success: true,
      oldName,
      newName,
      affectedMatches: 0,
      updatedTeams: tournament.teams,
    };
  }

  // Check for duplicate names
  const isDuplicate = tournament.teams.some(
    t => t.id !== teamId && t.name.toLowerCase() === newName.toLowerCase()
  );

  if (isDuplicate) {
    throw new Error(`Ein Team mit dem Namen "${newName}" existiert bereits.`);
  }

  // Update team name
  const updatedTeams = tournament.teams.map(t =>
    t.id === teamId ? { ...t, name: newName } : t
  );

  // Count affected matches (for warning display)
  const affectedMatches = getTeamMatches(tournament.matches, teamId)
    .filter(matchHasResult).length;

  return {
    success: true,
    oldName,
    newName,
    affectedMatches,
    updatedTeams,
  };
}

/**
 * Generate warning message for team rename
 */
export function getTeamRenameWarning(
  teamName: string,
  matchesWithResults: number
): string | null {
  if (matchesWithResults === 0) {
    return null;
  }

  return `"${teamName}" hat bereits ${matchesWithResults} Spiel${matchesWithResults === 1 ? '' : 'e'} mit Ergebnissen. ` +
    `Der neue Name wird in allen Spielen, Listen und PDFs angezeigt.`;
}

/**
 * Get active (non-removed) teams
 */
export function getActiveTeams(teams: Team[]): Team[] {
  return teams.filter(t => !t.isRemoved);
}

/**
 * Get removed teams
 */
export function getRemovedTeams(teams: Team[]): Team[] {
  return teams.filter(t => t.isRemoved);
}

/**
 * Check if tournament has any results
 */
export function tournamentHasResults(matches: Match[]): boolean {
  return matches.some(matchHasResult);
}

/**
 * Count total matches with results
 */
export function countMatchesWithResults(matches: Match[]): number {
  return matches.filter(matchHasResult).length;
}

/**
 * Team object with minimal properties for display components
 */
export interface TeamForDisplay {
  id: string;
  name: string;
  logo?: Team['logo'];
  colors?: Team['colors'];
}

/**
 * Find a team by ID and return display-ready team object with logo and colors
 * Falls back to a basic team object if not found
 */
export function getTeamForDisplay(
  teams: Team[] | undefined,
  teamId: string,
  fallbackName: string
): TeamForDisplay {
  const team = teams?.find(t => t.id === teamId);

  if (team) {
    return {
      id: team.id,
      name: team.name,
      logo: team.logo,
      colors: team.colors,
    };
  }

  // Fallback: Create basic team object with the provided name
  return {
    id: teamId,
    name: fallbackName,
  };
}
