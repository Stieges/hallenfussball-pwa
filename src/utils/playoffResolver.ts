/**
 * Playoff Resolver
 *
 * Automatically resolves playoff match pairings based on completed group phase results.
 * Triggers when all group matches are completed and updates playoff brackets.
 */

import { Tournament } from '../types/tournament';
import { calculateStandings } from './calculations';

/**
 * Result of playoff resolution attempt
 */
export interface PlayoffResolutionResult {
  wasResolved: boolean;
  updatedMatches: number;
  message: string;
  updatedMatchIds: string[];
}

/**
 * Check if all group phase matches are completed
 */
export const areAllGroupMatchesCompleted = (tournament: Tournament): boolean => {
  const groupMatches = (tournament.matches || []).filter(
    (m) => !m.isFinal && m.group !== undefined
  );

  if (groupMatches.length === 0) {
    return false; // No group matches exist
  }

  return groupMatches.every(
    (match) => match.scoreA !== undefined && match.scoreB !== undefined
  );
};

/**
 * Check if playoff matches need resolution (have placeholder team references)
 */
export const needsPlayoffResolution = (tournament: Tournament): boolean => {
  const playoffMatches = (tournament.matches || []).filter((m) => m.isFinal);

  return playoffMatches.some(
    (match) =>
      typeof match.teamA === 'string' &&
      (match.teamA.includes('group-') ||
       match.teamA.includes('-1st') ||
       match.teamA.includes('-2nd') ||
       match.teamA.includes('TBD') ||
       typeof match.teamB === 'string' &&
       (match.teamB.includes('group-') ||
        match.teamB.includes('-1st') ||
        match.teamB.includes('-2nd') ||
        match.teamB.includes('TBD')))
  );
};

/**
 * Automatically resolve playoff match pairings based on group standings
 *
 * This function:
 * 1. Checks if all group matches are completed
 * 2. Calculates final standings for each group
 * 3. Updates playoff matches with actual team IDs instead of placeholders
 *
 * @param tournament Current tournament state
 * @returns Resolution result with updated matches
 */
export const resolvePlayoffPairings = (
  tournament: Tournament
): PlayoffResolutionResult => {
  // Check if group phase is complete
  if (!areAllGroupMatchesCompleted(tournament)) {
    return {
      wasResolved: false,
      updatedMatches: 0,
      message: 'Gruppenphase ist noch nicht abgeschlossen',
      updatedMatchIds: [],
    };
  }

  // Check if playoff resolution is needed
  if (!needsPlayoffResolution(tournament)) {
    return {
      wasResolved: false,
      updatedMatches: 0,
      message: 'Playoff-Paarungen sind bereits aufgelöst',
      updatedMatchIds: [],
    };
  }

  // Calculate standings for all groups
  const groupStandings = calculateAllGroupStandings(tournament);

  // Resolve playoff matches
  const updatedMatchIds: string[] = [];
  let updatedCount = 0;

  const updatedMatches = (tournament.matches || []).map((match) => {
    if (!match.isFinal) {
      return match; // Skip group matches
    }

    let updated = false;
    let newTeamA = match.teamA;
    let newTeamB = match.teamB;

    // Resolve teamA if it's a placeholder
    if (typeof match.teamA === 'string' && isPlaceholder(match.teamA)) {
      const resolvedTeamA = resolvePlaceholder(match.teamA, groupStandings);
      if (resolvedTeamA) {
        newTeamA = resolvedTeamA;
        updated = true;
      }
    }

    // Resolve teamB if it's a placeholder
    if (typeof match.teamB === 'string' && isPlaceholder(match.teamB)) {
      const resolvedTeamB = resolvePlaceholder(match.teamB, groupStandings);
      if (resolvedTeamB) {
        newTeamB = resolvedTeamB;
        updated = true;
      }
    }

    if (updated) {
      updatedMatchIds.push(match.id);
      updatedCount++;
      return { ...match, teamA: newTeamA, teamB: newTeamB };
    }

    return match;
  });

  // Update tournament with resolved matches
  tournament.matches = updatedMatches;

  return {
    wasResolved: updatedCount > 0,
    updatedMatches: updatedCount,
    message: updatedCount > 0
      ? `${updatedCount} Playoff-Spiele wurden erfolgreich aufgelöst`
      : 'Keine Playoff-Spiele konnten aufgelöst werden',
    updatedMatchIds,
  };
};

/**
 * Calculate standings for all groups
 */
const calculateAllGroupStandings = (tournament: Tournament) => {
  const groups = Array.from(
    new Set(tournament.teams.map((t) => t.group).filter(Boolean))
  ) as string[]; // Type assertion: filter(Boolean) ensures no undefined values

  const standings: Record<string, { teamId: string; position: number }[]> = {};

  for (const group of groups) {
    const teamsInGroup = tournament.teams.filter((t) => t.group === group);
    const groupMatches = tournament.matches || [];
    const groupStandings = calculateStandings(
      teamsInGroup,
      groupMatches,
      tournament,
      group
    );

    standings[group] = groupStandings.map((standing, index) => ({
      teamId: standing.team.id,
      position: index + 1, // 1-indexed
    }));
  }

  return standings;
};

/**
 * Check if a team reference is a placeholder
 */
const isPlaceholder = (teamRef: string): boolean => {
  return (
    teamRef === 'TBD' ||
    teamRef.includes('group-') ||
    teamRef.includes('-1st') ||
    teamRef.includes('-2nd') ||
    teamRef.includes('-3rd') ||
    teamRef.includes('bestSecond')
  );
};

/**
 * Resolve a placeholder to an actual team ID
 *
 * Supported formats:
 * - "group-a-1st" -> First place from group A
 * - "group-b-2nd" -> Second place from group B
 * - "bestSecond" -> Best second place across all groups
 */
const resolvePlaceholder = (
  placeholder: string,
  groupStandings: Record<string, { teamId: string; position: number }[]>
): string | null => {
  // Handle "TBD" - cannot be resolved yet
  if (placeholder === 'TBD') {
    return null;
  }

  // Handle "bestSecond" - find best second place
  if (placeholder === 'bestSecond') {
    return resolveBestSecondFromStandings(groupStandings);
  }

  // Parse "group-X-Yth" format
  const match = placeholder.match(/group-([a-z])-(\d+)(?:st|nd|rd|th)/i);
  if (!match) {
    return null;
  }

  const groupId = match[1].toUpperCase(); // "A", "B", etc.
  const position = parseInt(match[2], 10);

  // Try multiple key formats to handle different group naming conventions:
  // - "A" (from Step4_Teams auto-assign using generateGroupLabels)
  // - "Gruppe A" (legacy/test format)
  const possibleKeys = [
    groupId,                    // "A"
    `Gruppe ${groupId}`,        // "Gruppe A"
    groupId.toLowerCase(),      // "a"
  ];

  let standings: { teamId: string; position: number }[] | undefined;
  for (const key of possibleKeys) {
    if (groupStandings[key]) {
      standings = groupStandings[key];
      break;
    }
  }

  if (!standings || standings.length < position) {
    return null;
  }

  return standings[position - 1].teamId;
};

/**
 * Find the best second place team across all groups
 */
const resolveBestSecondFromStandings = (
  groupStandings: Record<string, { teamId: string; position: number }[]>
): string | null => {
  const secondPlaceTeams = Object.values(groupStandings)
    .map((standings) => standings.find((s) => s.position === 2))
    .filter(Boolean);

  if (secondPlaceTeams.length === 0) {
    return null;
  }

  // For now, return the first second place team
  // TODO: Implement proper comparison based on points, goal difference, etc.
  return secondPlaceTeams[0]?.teamId || null;
};

/**
 * Hook to automatically check and resolve playoffs after match completion
 * Call this function after saving a group match result
 *
 * @param tournament Current tournament state
 * @returns Resolution result if triggered, null if not needed
 */
export const autoResolvePlayoffsIfReady = (
  tournament: Tournament
): PlayoffResolutionResult | null => {
  // Only try to resolve if all group matches are done
  if (!areAllGroupMatchesCompleted(tournament)) {
    return null;
  }

  // Only try if resolution is needed
  if (!needsPlayoffResolution(tournament)) {
    return null;
  }

  // Trigger automatic resolution
  return resolvePlayoffPairings(tournament);
};
