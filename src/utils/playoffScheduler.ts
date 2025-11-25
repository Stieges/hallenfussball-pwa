/**
 * Playoff/Finals Scheduler
 *
 * Implements K.O.-phase scheduling with:
 * - Configurable parallelization per match
 * - Multi-field support
 * - Respects minimum rest periods
 * - Maintains playoff tree structure
 */

import { Match, PlayoffConfig, Team } from '../types/tournament';

/**
 * Playoff match definition before scheduling
 */
export interface PlayoffMatchDefinition {
  id: string;
  label: string;
  teamASource: string; // e.g., "group-a-1st", "semi1-winner"
  teamBSource: string;
  finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';
  parallelMode: 'sequentialOnly' | 'parallelAllowed';
  dependencies: string[]; // IDs of matches that must be completed first
}

/**
 * Options for playoff scheduling
 */
export interface PlayoffScheduleOptions {
  playoffDefinitions: PlayoffMatchDefinition[];
  numberOfFields: number;
  slotDurationMinutes: number;
  breakBetweenSlotsMinutes: number;
  minRestSlotsPerTeam: number;
  startSlot: number; // First available slot after group phase
  startTime?: Date;
  groupPhaseEndTime?: Date;
  breakBetweenPhases?: number; // Minutes
}

/**
 * Team participation tracker for playoffs
 */
interface TeamPlayoffState {
  teamId: string;
  lastSlot: number;
  matchIds: string[];
}

/**
 * Scheduled playoff match with slot information
 */
interface ScheduledPlayoffMatch {
  definition: PlayoffMatchDefinition;
  slot: number;
  field: number;
  match: Match;
}

/**
 * Generate default playoff definitions based on enabled finals
 */
export function generatePlayoffDefinitions(
  numberOfGroups: number,
  finals: {
    final: boolean;
    thirdPlace: boolean;
    fifthSixth: boolean;
    seventhEighth: boolean;
  },
  playoffConfig?: PlayoffConfig
): PlayoffMatchDefinition[] {
  const definitions: PlayoffMatchDefinition[] = [];

  // For 2 groups: semifinals first (cross-pairing), then finals
  if (numberOfGroups === 2) {
    // Generate SEMIFINALS first (MeinTurnierplan style)
    const semi1Config = playoffConfig?.matches.find(m => m.id === 'semi1');
    const semi2Config = playoffConfig?.matches.find(m => m.id === 'semi2');

    definitions.push({
      id: 'semi1',
      label: '2. Halbfinale',
      teamASource: 'group-a-1st',
      teamBSource: 'group-b-2nd',
      parallelMode: semi1Config?.parallelMode || 'parallelAllowed',
      dependencies: [],
    });

    definitions.push({
      id: 'semi2',
      label: '1. Halbfinale',
      teamASource: 'group-a-2nd',
      teamBSource: 'group-b-1st',
      parallelMode: semi2Config?.parallelMode || 'parallelAllowed',
      dependencies: [],
    });

    // Placement games (independent of semifinals)
    if (finals.seventhEighth) {
      const config = playoffConfig?.matches.find(m => m.id === 'seventhEighth');
      definitions.push({
        id: 'seventhEighth',
        label: 'Spiel um Platz 7',
        teamASource: 'group-a-4th',
        teamBSource: 'group-b-4th',
        finalType: 'seventhEighth',
        parallelMode: config?.parallelMode || 'parallelAllowed',
        dependencies: [],
      });
    }

    if (finals.fifthSixth) {
      const config = playoffConfig?.matches.find(m => m.id === 'fifthSixth');
      definitions.push({
        id: 'fifthSixth',
        label: 'Spiel um Platz 5',
        teamASource: 'group-a-3rd',
        teamBSource: 'group-b-3rd',
        finalType: 'fifthSixth',
        parallelMode: config?.parallelMode || 'parallelAllowed',
        dependencies: [],
      });
    }

    // Finals (depend on semifinals)
    if (finals.thirdPlace) {
      const config = playoffConfig?.matches.find(m => m.id === 'thirdPlace');
      definitions.push({
        id: 'thirdPlace',
        label: 'Spiel um Platz 3',
        teamASource: 'semi1-loser',
        teamBSource: 'semi2-loser',
        finalType: 'thirdPlace',
        parallelMode: config?.parallelMode || 'parallelAllowed',
        dependencies: ['semi1', 'semi2'],
      });
    }

    if (finals.final) {
      const config = playoffConfig?.matches.find(m => m.id === 'final');
      definitions.push({
        id: 'final',
        label: 'Finale',
        teamASource: 'semi1-winner',
        teamBSource: 'semi2-winner',
        finalType: 'final',
        parallelMode: config?.parallelMode || 'sequentialOnly',
        dependencies: ['semi1', 'semi2'],
      });
    }
  }

  // For 4 groups: semifinals then finals
  else if (numberOfGroups === 4) {
    // Semifinals
    const semi1Config = playoffConfig?.matches.find(m => m.id === 'semi1');
    const semi2Config = playoffConfig?.matches.find(m => m.id === 'semi2');

    definitions.push({
      id: 'semi1',
      label: 'Halbfinale 1',
      teamASource: 'group-a-1st',
      teamBSource: 'group-b-1st',
      parallelMode: semi1Config?.parallelMode || 'parallelAllowed',
      dependencies: [],
    });

    definitions.push({
      id: 'semi2',
      label: 'Halbfinale 2',
      teamASource: 'group-c-1st',
      teamBSource: 'group-d-1st',
      parallelMode: semi2Config?.parallelMode || 'parallelAllowed',
      dependencies: [],
    });

    // Final
    if (finals.final) {
      const finalConfig = playoffConfig?.matches.find(m => m.id === 'final');
      definitions.push({
        id: 'final',
        label: 'Finale',
        teamASource: 'semi1-winner',
        teamBSource: 'semi2-winner',
        finalType: 'final',
        parallelMode: finalConfig?.parallelMode || 'sequentialOnly',
        dependencies: ['semi1', 'semi2'],
      });
    }

    // Third place
    if (finals.thirdPlace) {
      const thirdConfig = playoffConfig?.matches.find(m => m.id === 'thirdPlace');
      definitions.push({
        id: 'thirdPlace',
        label: 'Spiel um Platz 3',
        teamASource: 'semi1-loser',
        teamBSource: 'semi2-loser',
        finalType: 'thirdPlace',
        parallelMode: thirdConfig?.parallelMode || 'parallelAllowed',
        dependencies: ['semi1', 'semi2'],
      });
    }
  }

  return definitions;
}

/**
 * Generate playoff schedule
 */
export function generatePlayoffSchedule(options: PlayoffScheduleOptions): Match[] {
  const {
    playoffDefinitions,
    numberOfFields,
    slotDurationMinutes,
    breakBetweenSlotsMinutes,
    minRestSlotsPerTeam,
    startSlot,
    startTime,
  } = options;

  if (playoffDefinitions.length === 0) {
    return [];
  }

  const matches: Match[] = [];
  const scheduledMatches: ScheduledPlayoffMatch[] = [];
  const teamStates = new Map<string, TeamPlayoffState>();

  // Track which matches have been scheduled
  const completedMatchIds = new Set<string>();

  // Sort definitions by dependencies (topological sort)
  const sortedDefinitions = topologicalSort(playoffDefinitions);

  let currentSlot = startSlot;

  // Schedule each wave of matches
  while (scheduledMatches.length < sortedDefinitions.length) {
    // Find matches that can be scheduled now (dependencies met)
    const readyMatches = sortedDefinitions.filter(def => {
      if (completedMatchIds.has(def.id)) return false;
      return def.dependencies.every(depId => completedMatchIds.has(depId));
    });

    if (readyMatches.length === 0) break; // No more matches to schedule

    // Group by parallelization capability
    const sequentialMatches: PlayoffMatchDefinition[] = [];
    const parallelMatches: PlayoffMatchDefinition[] = [];

    for (const def of readyMatches) {
      if (def.parallelMode === 'sequentialOnly' || numberOfFields === 1) {
        sequentialMatches.push(def);
      } else {
        parallelMatches.push(def);
      }
    }

    // Schedule sequential matches first (one per slot)
    for (const def of sequentialMatches) {
      const field = 1; // Always use field 1 for sequential matches
      const scheduledTime = startTime ? new Date(startTime.getTime() + currentSlot * (slotDurationMinutes + breakBetweenSlotsMinutes) * 60000) : undefined;

      const match: Match = {
        id: def.id,
        round: currentSlot + 1,
        field,
        slot: currentSlot,
        teamA: def.teamASource,
        teamB: def.teamBSource,
        isFinal: true,
        finalType: def.finalType,
        scheduledTime,
      };

      scheduledMatches.push({ definition: def, slot: currentSlot, field, match });
      matches.push(match);
      completedMatchIds.add(def.id);

      currentSlot++; // Each sequential match gets its own slot
    }

    // Schedule parallel matches (multiple per slot if fields available)
    if (parallelMatches.length > 0) {
      const slotStart = currentSlot;
      let field = 1;

      for (const def of parallelMatches) {
        const scheduledTime = startTime ? new Date(startTime.getTime() + currentSlot * (slotDurationMinutes + breakBetweenSlotsMinutes) * 60000) : undefined;

        const match: Match = {
          id: def.id,
          round: currentSlot + 1,
          field,
          slot: currentSlot,
          teamA: def.teamASource,
          teamB: def.teamBSource,
          isFinal: true,
          finalType: def.finalType,
          scheduledTime,
        };

        scheduledMatches.push({ definition: def, slot: currentSlot, field, match });
        matches.push(match);
        completedMatchIds.add(def.id);

        field++;
        if (field > numberOfFields) {
          field = 1;
          currentSlot++;
        }
      }

      // Move to next slot if we used any fields in current slot
      if (field > 1) {
        currentSlot++;
      }
    }
  }

  return matches;
}

/**
 * Topological sort for playoff match dependencies
 */
function topologicalSort(definitions: PlayoffMatchDefinition[]): PlayoffMatchDefinition[] {
  const sorted: PlayoffMatchDefinition[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(def: PlayoffMatchDefinition) {
    if (temp.has(def.id)) {
      throw new Error('Circular dependency detected in playoff matches');
    }
    if (visited.has(def.id)) return;

    temp.add(def.id);

    // Visit dependencies first
    for (const depId of def.dependencies) {
      const depDef = definitions.find(d => d.id === depId);
      if (depDef) {
        visit(depDef);
      }
    }

    temp.delete(def.id);
    visited.add(def.id);
    sorted.push(def);
  }

  for (const def of definitions) {
    if (!visited.has(def.id)) {
      visit(def);
    }
  }

  return sorted;
}
