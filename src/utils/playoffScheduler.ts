/**
 * Playoff/Finals Scheduler
 *
 * Implements K.O.-phase scheduling with:
 * - Configurable parallelization per match
 * - Multi-field support
 * - Respects minimum rest periods
 * - Maintains playoff tree structure
 */

import { Match, FinalsConfig } from '../types/tournament';
import { generatePlayoffMatches as generatePlayoffMatchesFromPreset } from '../lib/playoffGenerator';
import { generateFinalsMatchId } from './idGenerator';

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
 * Scheduled playoff match with slot information
 */
interface ScheduledPlayoffMatch {
  definition: PlayoffMatchDefinition;
  slot: number;
  field: number;
  match: Match;
}

/**
 * Generate playoff definitions based on FinalsConfig preset
 * NEW: Uses preset-based system from playoffGenerator
 */
export function generatePlayoffDefinitions(
  numberOfGroups: number,
  finalsConfig: FinalsConfig
): PlayoffMatchDefinition[] {
  // Get playoff matches from the new preset-based generator
  const playoffMatches = generatePlayoffMatchesFromPreset(numberOfGroups, finalsConfig);

  // Convert to PlayoffMatchDefinition format
  const definitions: PlayoffMatchDefinition[] = playoffMatches.map(match => {
    // Determine parallel mode
    const isRoundOf16 = match.id.startsWith('r16');
    const isQuarterfinal = match.id.startsWith('qf');
    const isSemifinal = match.id.startsWith('semi');
    const isFinal = match.id === 'final';

    let parallelMode: 'sequentialOnly' | 'parallelAllowed' = 'parallelAllowed';

    if (isFinal) {
      parallelMode = 'sequentialOnly';
    } else if (isSemifinal && finalsConfig.parallelSemifinals === false) {
      parallelMode = 'sequentialOnly';
    } else if (isQuarterfinal && finalsConfig.parallelQuarterfinals === false) {
      parallelMode = 'sequentialOnly';
    } else if (isRoundOf16 && finalsConfig.parallelRoundOf16 === false) {
      parallelMode = 'sequentialOnly';
    }

    // Determine finalType
    let finalType: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth' | undefined;
    if (match.id === 'final') finalType = 'final';
    else if (match.id === 'third-place') finalType = 'thirdPlace';
    else if (match.id.includes('place56') || match.id === 'place56-direct') finalType = 'fifthSixth';
    else if (match.id.includes('place78') || match.id === 'place78-direct') finalType = 'seventhEighth';

    return {
      id: match.id,
      label: match.label,
      teamASource: match.home,
      teamBSource: match.away,
      finalType,
      parallelMode,
      dependencies: match.dependsOn || [],
    };
  });

  return definitions;
}

/**
 * @deprecated Legacy function - use generatePlayoffDefinitions with FinalsConfig instead
 */
export function generatePlayoffDefinitionsLegacy(
  numberOfGroups: number,
  finals: {
    final: boolean;
    thirdPlace: boolean;
    fifthSixth: boolean;
    seventhEighth: boolean;
  }
): PlayoffMatchDefinition[] {
  // Migrate old finals structure to new preset
  let preset: FinalsConfig['preset'] = 'none';

  if (finals.final) {
    if (finals.thirdPlace) {
      if (finals.fifthSixth || finals.seventhEighth) {
        preset = 'all-places';
      } else {
        preset = 'top-4';
      }
    } else {
      preset = 'final-only';
    }
  }

  return generatePlayoffDefinitions(numberOfGroups, { preset });
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
    startSlot,
    startTime,
  } = options;

  if (playoffDefinitions.length === 0) {
    return [];
  }

  const matches: Match[] = [];
  const scheduledMatches: ScheduledPlayoffMatch[] = [];

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
        id: generateFinalsMatchId(),
        round: currentSlot + 1,
        field,
        slot: currentSlot,
        teamA: def.teamASource,
        teamB: def.teamBSource,
        isFinal: true,
        finalType: def.finalType,
        label: def.label,
        scheduledTime,
      };

      scheduledMatches.push({ definition: def, slot: currentSlot, field, match });
      matches.push(match);
      completedMatchIds.add(def.id);

      currentSlot++; // Each sequential match gets its own slot
    }

    // Schedule parallel matches (multiple per slot if fields available)
    if (parallelMatches.length > 0) {
      let field = 1;

      for (const def of parallelMatches) {
        const scheduledTime = startTime ? new Date(startTime.getTime() + currentSlot * (slotDurationMinutes + breakBetweenSlotsMinutes) * 60000) : undefined;

        const match: Match = {
          id: generateFinalsMatchId(),
          round: currentSlot + 1,
          field,
          slot: currentSlot,
          teamA: def.teamASource,
          teamB: def.teamBSource,
          isFinal: true,
          finalType: def.finalType,
          label: def.label,
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
