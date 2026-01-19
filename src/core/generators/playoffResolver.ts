/**
 * Playoff Resolver
 *
 * Automatically resolves playoff match pairings based on completed group phase results.
 * Triggers when all group matches are completed and updates playoff brackets.
 */

import { Tournament } from '../../types/tournament';
import { calculateStandings } from '../../utils/calculations';

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
  const groupMatches = tournament.matches.filter(
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
  const playoffMatches = tournament.matches.filter((m) => m.isFinal);

  return playoffMatches.some(
    (match) =>
      (typeof match.teamA === 'string' && isPlaceholder(match.teamA)) ||
      (typeof match.teamB === 'string' && isPlaceholder(match.teamB))
  );
};

/**
 * Check if resolved playoff teams still match current standings
 * Returns true if re-resolution is needed (teams have changed)
 */
export const needsPlayoffReResolution = (tournament: Tournament): boolean => {
  // Only check if all group matches are complete
  if (!areAllGroupMatchesCompleted(tournament)) {
    return false;
  }

  const playoffMatches = tournament.matches.filter((m) => m.isFinal);

  // Only check matches with resolved team IDs (not placeholders)
  const groupBasedPlayoffs = playoffMatches.filter((match) => {
    // If teamA is a real team ID (not placeholder), it was resolved
    const teamAResolved = match.teamA && !isPlaceholder(match.teamA);
    const teamBResolved = match.teamB && !isPlaceholder(match.teamB);

    return teamAResolved || teamBResolved;
  });

  if (groupBasedPlayoffs.length === 0) {
    return false;
  }

  // Calculate current standings
  const currentStandings = calculateAllGroupStandings(tournament);

  // Check each resolved match to see if teams still match standings
  for (const match of groupBasedPlayoffs) {
    // We need to check what the match SHOULD have based on the playoff bracket
    // For now, we parse the match ID to determine the expected placement
    // Match IDs like "semi1", "semi2" indicate semifinal matchups

    // Get expected teams from standings based on typical bracket:
    // semi1: Group A 2nd vs Group B 1st
    // semi2: Group A 1st vs Group B 2nd
    const expectedTeams = getExpectedTeamsForMatch(match, currentStandings, tournament);

    if (expectedTeams) {
      const currentTeamA = match.teamA;
      const currentTeamB = match.teamB;

      // If resolved teams don't match expected teams, re-resolution is needed
      if (currentTeamA !== expectedTeams.teamA || currentTeamB !== expectedTeams.teamB) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Get expected teams for a playoff match based on current standings
 *
 * Matches the bracket structure from playoffGenerator.ts:
 * - semi1: group-a-2nd vs group-b-1st
 * - semi2: group-a-1st vs group-b-2nd
 */
function getExpectedTeamsForMatch(
  match: { id: string; teamA: string; teamB: string },
  standings: Record<string, { teamId: string; position: number }[]>,
  _tournament: Tournament
): { teamA: string; teamB: string } | null {
  // Get group keys (sorted alphabetically: A, B, ...)
  const groups = Object.keys(standings).sort();
  if (groups.length < 2) { return null; }

  const groupA = groups[0]; // 'A'
  const groupB = groups[1]; // 'B'

  // Match the bracket structure from playoffGenerator.ts
  if (match.id === 'semi1' || match.id.includes('semi1')) {
    // semi1: group-a-2nd (home) vs group-b-1st (away)
    // Matching: { id: 'semi1', home: 'group-a-2nd', away: 'group-b-1st' }
    const teamA = standings[groupA][1]?.teamId; // 2nd place from Group A (index 1)
    const teamB = standings[groupB][0]?.teamId; // 1st place from Group B (index 0)
    if (teamA && teamB) { return { teamA, teamB }; }
  }

  if (match.id === 'semi2' || match.id.includes('semi2')) {
    // semi2: group-a-1st (home) vs group-b-2nd (away)
    // Matching: { id: 'semi2', home: 'group-a-1st', away: 'group-b-2nd' }
    const teamA = standings[groupA][0]?.teamId; // 1st place from Group A (index 0)
    const teamB = standings[groupB][1]?.teamId; // 2nd place from Group B (index 1)
    if (teamA && teamB) { return { teamA, teamB }; }
  }

  // Place matches for direct group positions
  if (match.id === 'place56-direct' || match.id.includes('place56')) {
    // 3rd place teams
    const teamA = standings[groupA][2]?.teamId; // 3rd place from Group A
    const teamB = standings[groupB][2]?.teamId; // 3rd place from Group B
    if (teamA && teamB) { return { teamA, teamB }; }
  }

  if (match.id === 'place78-direct' || match.id.includes('place78')) {
    // 4th place teams
    const teamA = standings[groupA][3]?.teamId; // 4th place from Group A
    const teamB = standings[groupB][3]?.teamId; // 4th place from Group B
    if (teamA && teamB) { return { teamA, teamB }; }
  }

  // Final and third-place matches depend on semifinal results,
  // so we can't re-resolve them based on group standings alone
  // These are handled by bracket placeholder resolution (semi1-winner, semi2-winner, etc.)
  return null;
}

/**
 * Check if a team reference is a placeholder (group-based or bracket-based)
 */
const isPlaceholder = (teamRef: string): boolean => {
  return (
    teamRef === 'TBD' ||
    // Group-based placeholders
    teamRef.includes('group-') ||
    teamRef.includes('-1st') ||
    teamRef.includes('-2nd') ||
    teamRef.includes('-3rd') ||
    teamRef.includes('bestSecond') ||
    // Bracket-based placeholders (winner/loser of previous rounds)
    teamRef.includes('-winner') ||
    teamRef.includes('-loser')
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

  const updatedMatches = tournament.matches.map((match) => {
    if (!match.isFinal) {
      return match; // Skip group matches
    }

    let updated = false;
    let newTeamA = match.teamA;
    let newTeamB = match.teamB;

    // Resolve teamA if it's a placeholder
    if (typeof match.teamA === 'string' && isPlaceholder(match.teamA)) {
      const resolvedTeamA = resolvePlaceholder(match.teamA, groupStandings, tournament);
      if (resolvedTeamA) {
        newTeamA = resolvedTeamA;
        updated = true;
      }
    }

    // Resolve teamB if it's a placeholder
    if (typeof match.teamB === 'string' && isPlaceholder(match.teamB)) {
      const resolvedTeamB = resolvePlaceholder(match.teamB, groupStandings, tournament);
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
    const groupStandings = calculateStandings(
      teamsInGroup,
      tournament.matches,
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
 * Resolve a placeholder to an actual team ID
 *
 * Supported formats:
 * - "group-a-1st" -> First place from group A
 * - "group-b-2nd" -> Second place from group B
 * - "bestSecond" -> Best second place across all groups
 * - "semi1-winner" -> Winner of semifinal 1
 * - "semi1-loser" -> Loser of semifinal 1
 * - "qf1-winner" -> Winner of quarterfinal 1
 */
const resolvePlaceholder = (
  placeholder: string,
  groupStandings: Record<string, { teamId: string; position: number }[]>,
  tournament?: Tournament
): string | null => {
  // Handle "TBD" - cannot be resolved yet
  if (placeholder === 'TBD') {
    return null;
  }

  // Handle "bestSecond" - find best second place
  if (placeholder === 'bestSecond') {
    return resolveBestSecondFromStandings(groupStandings);
  }

  // Handle bracket-based placeholders (winner/loser of previous rounds)
  if (placeholder.includes('-winner') || placeholder.includes('-loser')) {
    return resolveBracketPlaceholder(placeholder, tournament);
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
 * Resolve bracket-based placeholders like "semi1-winner", "qf2-loser"
 */
const resolveBracketPlaceholder = (
  placeholder: string,
  tournament?: Tournament
): string | null => {
  if (!tournament?.matches) {
    return null;
  }

  // Parse placeholder: "semi1-winner" -> matchId="semi1", type="winner"
  // Also handles: "qf1-winner", "r16-3-winner", etc.
  const bracketMatch = placeholder.match(/^(.+)-(winner|loser)$/);
  if (!bracketMatch) {
    return null;
  }

  const matchId = bracketMatch[1]; // e.g., "semi1", "qf1", "r16-3"
  const resultType = bracketMatch[2]; // "winner" or "loser"

  // Find the referenced match
  const referencedMatch = tournament.matches.find(
    (m) => m.id === matchId && m.isFinal
  );

  if (!referencedMatch) {
    return null;
  }

  // Check if the match is completed
  if (referencedMatch.scoreA === undefined || referencedMatch.scoreB === undefined) {
    return null; // Match not yet played
  }

  // Check if teams are already resolved (not placeholders)
  if (isPlaceholder(referencedMatch.teamA) || isPlaceholder(referencedMatch.teamB)) {
    return null; // Can't determine winner/loser if teams aren't resolved yet
  }

  // Determine winner/loser
  const scoreA = referencedMatch.scoreA;
  const scoreB = referencedMatch.scoreB;

  if (scoreA === scoreB) {
    // Draw - can't determine winner/loser in knockout
    // In real tournaments, there would be penalties, but for now return null
    return null;
  }

  const isTeamAWinner = scoreA > scoreB;

  if (resultType === 'winner') {
    return isTeamAWinner ? referencedMatch.teamA : referencedMatch.teamB;
  } else {
    return isTeamAWinner ? referencedMatch.teamB : referencedMatch.teamA;
  }
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
 * Re-resolve playoff pairings when standings have changed
 * This function directly updates playoff matches based on current standings
 */
export const reResolvePlayoffPairings = (
  tournament: Tournament
): PlayoffResolutionResult => {
  // Calculate current standings
  const groupStandings = calculateAllGroupStandings(tournament);

  const updatedMatchIds: string[] = [];
  let updatedCount = 0;

  const updatedMatches = tournament.matches.map((match) => {
    if (!match.isFinal) {
      return match;
    }

    // Get expected teams for this match based on current standings
    const expectedTeams = getExpectedTeamsForMatch(
      { id: match.id, teamA: match.teamA, teamB: match.teamB },
      groupStandings,
      tournament
    );

    if (!expectedTeams) {
      return match; // Can't determine expected teams for this match type
    }

    // Check if update is needed
    const needsUpdate =
      match.teamA !== expectedTeams.teamA ||
      match.teamB !== expectedTeams.teamB;

    if (needsUpdate) {
      updatedMatchIds.push(match.id);
      updatedCount++;
      return {
        ...match,
        teamA: expectedTeams.teamA,
        teamB: expectedTeams.teamB,
        // Clear scores when teams change (the match hasn't been played with new teams)
        scoreA: undefined,
        scoreB: undefined
      };
    }

    return match;
  });

  // Update tournament with re-resolved matches
  tournament.matches = updatedMatches;

  return {
    wasResolved: updatedCount > 0,
    updatedMatches: updatedCount,
    message: updatedCount > 0
      ? `${updatedCount} Playoff-Spiele wurden neu aufgelöst`
      : 'Keine Playoff-Spiele mussten neu aufgelöst werden',
    updatedMatchIds,
  };
};

/**
 * Hook to automatically check and resolve playoffs after match completion
 * Call this function after saving any match result (group or playoff)
 *
 * IMPORTANT: Playoffs are resolved ONCE when all group matches are completed.
 * After that, they are NEVER automatically re-resolved to avoid confusing users
 * with constantly changing pairings. If a correction is needed, use manual
 * re-resolution via forceReResolvePlayoffs().
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

  // Only resolve if there are still placeholders (first-time resolution)
  // Once resolved, playoffs are FINAL and won't change automatically
  if (!needsPlayoffResolution(tournament)) {
    return null;
  }

  return resolvePlayoffPairings(tournament);
};

/**
 * Force re-resolution of playoff pairings (manual override)
 *
 * Use this function when:
 * - A group match result was corrected after playoffs were resolved
 * - The user explicitly wants to update playoff pairings based on new standings
 *
 * WARNING: This will reset any scores entered for affected playoff matches!
 */
export const forceReResolvePlayoffs = (
  tournament: Tournament
): PlayoffResolutionResult => {
  if (!areAllGroupMatchesCompleted(tournament)) {
    return {
      wasResolved: false,
      updatedMatches: 0,
      message: 'Gruppenphase ist noch nicht abgeschlossen',
      updatedMatchIds: [],
    };
  }

  return reResolvePlayoffPairings(tournament);
};

/**
 * Resolves bracket placeholders after a playoff match is completed.
 * This should be called after entering a result for a knockout match.
 * It will resolve any dependent matches (e.g., after semifinal → resolve final).
 *
 * @param tournament Current tournament state
 * @returns Resolution result
 */
export const resolveBracketAfterPlayoffMatch = (
  tournament: Tournament
): PlayoffResolutionResult | null => {
  // Check if any playoff matches have unresolved bracket placeholders
  if (!needsPlayoffResolution(tournament)) {
    return null;
  }

  // Calculate group standings (needed for mixed resolution)
  const groupStandings = calculateAllGroupStandings(tournament);

  // Resolve playoff matches (will now also resolve bracket placeholders)
  const updatedMatchIds: string[] = [];
  let updatedCount = 0;

  const updatedMatches = tournament.matches.map((match) => {
    if (!match.isFinal) {
      return match;
    }

    let updated = false;
    let newTeamA = match.teamA;
    let newTeamB = match.teamB;

    // Resolve teamA if it's a bracket placeholder (winner/loser)
    if (typeof match.teamA === 'string' && isPlaceholder(match.teamA)) {
      const resolvedTeamA = resolvePlaceholder(match.teamA, groupStandings, tournament);
      if (resolvedTeamA) {
        newTeamA = resolvedTeamA;
        updated = true;
      }
    }

    // Resolve teamB if it's a bracket placeholder
    if (typeof match.teamB === 'string' && isPlaceholder(match.teamB)) {
      const resolvedTeamB = resolvePlaceholder(match.teamB, groupStandings, tournament);
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
      ? `${updatedCount} Bracket-Spiele wurden aufgelöst`
      : 'Keine Bracket-Spiele konnten aufgelöst werden',
    updatedMatchIds,
  };
};
