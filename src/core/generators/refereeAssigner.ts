/**
 * Referee Assignment System
 *
 * Handles automatic and manual assignment of referees to matches
 * Supports two modes:
 * - Organizer provides referees (SR1, SR2, SR3...)
 * - Teams provide referees (team referees after their own match)
 */

import { Match, RefereeConfig, Team } from '../../types/tournament';

// Generic match interface that works with both Match and ScheduledMatch
interface MatchLike {
  id: string;
  field: number;
  slot?: number;
  referee?: number;
  teamA?: string; // Match.teamA
  teamB?: string; // Match.teamB
  homeTeam?: string; // ScheduledMatch.homeTeam
  awayTeam?: string; // ScheduledMatch.awayTeam
}

interface MatchWithMetadata extends MatchLike {
  matchIndex: number;
  timeSlot: number; // Sortierbare Zeiteinheit für Aufeinanderfolge-Checks
}

/**
 * Assigns referees to all matches based on the tournament configuration
 * Works with both Match and ScheduledMatch types
 */
export function assignReferees<T extends MatchLike>(
  matches: T[],
  teams: Team[],
  config: RefereeConfig
): T[] {
  if (config.mode === 'none') {
    return matches;
  }

  // Apply manual assignments first
  const matchesWithManual = applyManualAssignments(matches, config);

  if (config.mode === 'organizer') {
    return assignOrganizerReferees(matchesWithManual, config);
  }
  // config.mode === 'teams' at this point (only remaining option)
  return assignTeamReferees(matchesWithManual, teams);
}

/**
 * Apply manual referee assignments
 */
function applyManualAssignments<T extends MatchLike>(matches: T[], config: RefereeConfig): T[] {
  const manualAssignments = config.manualAssignments;
  if (!manualAssignments) {
    return matches;
  }

  return matches.map(match => {
    if (match.id in manualAssignments) {
      return { ...match, referee: manualAssignments[match.id] };
    }
    return match;
  });
}

/**
 * Organizer Mode: Fair distribution of referees
 *
 * Algorithm:
 * 1. Group matches by time slots (to detect consecutive matches)
 * 2. Assign referees round-robin style
 * 3. Respect maxConsecutiveMatches constraint
 * 4. Balance total matches per referee
 */
function assignOrganizerReferees<T extends MatchLike>(matches: T[], config: RefereeConfig): T[] {
  const numberOfReferees = config.numberOfReferees ?? 2;
  const maxConsecutive = config.maxConsecutiveMatches ?? 1;

  // Skip matches that already have manual assignments
  const matchesToAssign = matches.filter(m => m.referee === undefined);

  // Create metadata for matches (with index and time slot)
  const matchesWithMeta: MatchWithMetadata[] = matchesToAssign.map((match, index) => ({
    ...match,
    matchIndex: index,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Slot 0 is valid first slot, use index as fallback only for undefined
    timeSlot: match.slot || index, // Use slot for time-based ordering
  }));

  // Sort by time slot
  matchesWithMeta.sort((a, b) => a.timeSlot - b.timeSlot);

  // Track referee assignments
  const refereeWorkload: number[] = new Array<number>(numberOfReferees).fill(0);
  const refereeLastSlots: number[] = new Array<number>(numberOfReferees).fill(-100); // Last time slot each referee worked
  const assignments = new Map<string, number>();

  // Assign referees
  for (const match of matchesWithMeta) {
    let assignedRef: number | undefined;

    // Find the best referee for this match
    for (let attempt = 0; attempt < numberOfReferees * 2; attempt++) {
      // Try referees in order of least workload
      const sortedRefs = Array.from({ length: numberOfReferees }, (_, i) => i + 1)
        .sort((a, b) => {
          // Primary: least workload
          if (refereeWorkload[a - 1] !== refereeWorkload[b - 1]) {
            return refereeWorkload[a - 1] - refereeWorkload[b - 1];
          }
          // Secondary: longest rest
          return refereeLastSlots[a - 1] - refereeLastSlots[b - 1];
        });

      for (const refNum of sortedRefs) {
        const refIndex = refNum - 1;
        const lastSlot = refereeLastSlots[refIndex];
        const slotDifference = match.timeSlot - lastSlot;

        // Check if this referee can work (respecting maxConsecutive constraint)
        // If maxConsecutive = 1, referee needs at least 1 slot break
        // If maxConsecutive = 2, referee can work 2 consecutive slots before needing break
        if (slotDifference >= maxConsecutive) {
          assignedRef = refNum;
          refereeWorkload[refIndex]++;
          refereeLastSlots[refIndex] = match.timeSlot;
          break;
        }
      }

      if (assignedRef !== undefined) {
        break;
      }

      // If no referee is available (all violated maxConsecutive), relax constraint
      // Note: assignedRef is always undefined here due to the break above
      if (attempt === numberOfReferees - 1) {
        // Fallback: assign referee with longest rest
        const refNum = sortedRefs[0];
        assignedRef = refNum;
        refereeWorkload[refNum - 1]++;
        refereeLastSlots[refNum - 1] = match.timeSlot;
        break;
      }
    }

    if (assignedRef) {
      assignments.set(match.id, assignedRef);
    }
  }

  // Apply assignments
  const result = matches.map(match => {
    if (match.referee !== undefined) {
      return match; // Keep manual assignments
    }
    const assignedRef = assignments.get(match.id);
    if (assignedRef !== undefined) {
      return { ...match, referee: assignedRef };
    }
    return match;
  });

  return result;
}

/**
 * Teams Mode: Teams referee after their own match
 *
 * Algorithm:
 * 1. After team plays, they referee the next match on the same field
 * 2. Map team names to team numbers (1, 2, 3...)
 * 3. Assign team number as referee number
 */
function assignTeamReferees<T extends MatchLike>(matches: T[], teams: Team[]): T[] {
  // Helper to get team name from match (handles both Match.teamA and ScheduledMatch.homeTeam)
  const getTeamName = (match: MatchLike, position: 'home' | 'away'): string | undefined => {
    if (position === 'home') {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty name should use fallback property
      return match.homeTeam || match.teamA;
    } else {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty name should use fallback property
      return match.awayTeam || match.teamB;
    }
  };

  // Create team name -> team number mapping
  const teamToNumber = new Map<string, number>();
  teams.forEach((team, index) => {
    teamToNumber.set(team.name, index + 1);
  });

  // Group matches by field
  const matchesByField = new Map<number, T[]>();
  matches.forEach(match => {
    const fieldMatches = matchesByField.get(match.field) ?? [];
    fieldMatches.push(match);
    matchesByField.set(match.field, fieldMatches);
  });

  // Assign referees field by field
  const result: T[] = [];

  matchesByField.forEach((fieldMatches) => {
    // Sort by time slot
    const sortedMatches = [...fieldMatches].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));

    for (let i = 0; i < sortedMatches.length; i++) {
      const match = sortedMatches[i];

      // Skip if manually assigned
      if (match.referee !== undefined) {
        result.push(match);
        continue;
      }

      // Look at previous match on same field
      if (i > 0) {
        const previousMatch = sortedMatches[i - 1];

        // Use home team from previous match as referee
        const refereeTeamName = getTeamName(previousMatch, 'home');
        const refereeNumber = refereeTeamName ? teamToNumber.get(refereeTeamName) : undefined;

        if (refereeNumber) {
          result.push({ ...match, referee: refereeNumber });
        } else {
          result.push(match);
        }
      } else {
        // First match on field has no referee
        result.push(match);
      }
    }
  });

  return result;
}

/**
 * Get referee display name
 * For organizer mode: "SR1", "SR2", etc.
 * For teams mode: "Team 3", "Team 5", etc.
 * With names configured: actual name
 */
export function getRefereeDisplayName(
  refereeNumber: number | undefined,
  config: RefereeConfig | undefined,
  teams?: Team[]
): string {
  if (refereeNumber === undefined) {
    return '-';
  }

  // Check for custom name (organizer mode)
  if (config?.refereeNames?.[refereeNumber]) {
    return config.refereeNames[refereeNumber];
  }

  // Teams mode: show team name if available
  if (config?.mode === 'teams' && teams) {
    const team = teams[refereeNumber - 1];
    // team may be undefined if refereeNumber > teams.length, but TS doesn't know
    // (noUncheckedIndexedAccess is disabled)
    return team.name;
  }

  // Default: show number only
  return refereeNumber.toString();
}

/**
 * Check if a referee assignment is valid for finals
 */
export function isValidFinalsReferee(
  match: Match,
  refereeNumber: number,
  config: RefereeConfig,
  teams: Team[]
): boolean {
  if (!config.finalsRefereeMode || config.finalsRefereeMode === 'none') {
    return false;
  }

  // Get team name for this referee number
  const refereeTeam = teams[refereeNumber - 1];

  // Check if team is participating in this match
  // Note: TS thinks refereeTeam is always defined (noUncheckedIndexedAccess disabled)
  if (match.teamA === refereeTeam.name || match.teamB === refereeTeam.name) {
    return false; // Can't referee own match
  }

  // TODO: Implement neutralTeams check (needs tournament state/standings)
  // For now, allow non-participating teams

  return true;
}
