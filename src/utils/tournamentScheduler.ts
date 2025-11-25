/**
 * Tournament Scheduler - Main Integration
 *
 * Combines group phase and playoff scheduling with fairness guarantees
 */

import { Tournament, Match, Team } from '../types/tournament';
import {
  generateGroupPhaseSchedule,
  GroupPhaseScheduleOptions,
  analyzeScheduleFairness,
  FairnessAnalysis,
} from './fairScheduler';
import {
  generatePlayoffSchedule,
  generatePlayoffDefinitions,
  PlayoffScheduleOptions,
} from './playoffScheduler';
import { getUniqueGroups } from './groupHelpers';

/**
 * Complete tournament schedule result
 */
export interface TournamentScheduleResult {
  groupMatches: Match[];
  playoffMatches: Match[];
  allMatches: Match[];
  fairnessAnalysis: FairnessAnalysis;
  totalSlots: number;
  estimatedDurationMinutes: number;
}

/**
 * Options for generating complete tournament schedule
 */
export interface TournamentScheduleOptions {
  tournament: Tournament;
  startTime?: Date;
  useAdvancedScheduler?: boolean; // Use new fair scheduler vs legacy
}

/**
 * Generate complete tournament schedule with group phase and playoffs
 */
export function generateTournamentSchedule(
  options: TournamentScheduleOptions
): TournamentScheduleResult {
  const { tournament, startTime, useAdvancedScheduler = true } = options;

  // If advanced scheduler is disabled, fall back to legacy
  if (!useAdvancedScheduler) {
    return generateLegacySchedule(tournament);
  }

  const groupMatches: Match[] = [];
  const playoffMatches: Match[] = [];

  // 1. Generate group phase matches
  if (tournament.groupSystem === 'roundRobin' || tournament.groupSystem === 'groupsAndFinals') {
    // Organize teams by group
    const groupsMap = new Map<string, Team[]>();

    if (tournament.groupSystem === 'roundRobin') {
      // Single group: all teams together
      groupsMap.set('all', tournament.teams);
    } else {
      // Multiple groups
      const groupLabels = getUniqueGroups(tournament.teams);
      for (const label of groupLabels) {
        const teamsInGroup = tournament.teams.filter(t => t.group === label);
        if (teamsInGroup.length > 0) {
          groupsMap.set(label, teamsInGroup);
        }
      }
    }

    const groupPhaseOptions: GroupPhaseScheduleOptions = {
      groups: groupsMap,
      numberOfFields: tournament.numberOfFields,
      slotDurationMinutes: tournament.groupPhaseGameDuration,
      breakBetweenSlotsMinutes: tournament.groupPhaseBreakDuration || 0,
      minRestSlotsPerTeam: tournament.minRestSlots || 1,
      startTime,
    };

    const generatedGroupMatches = generateGroupPhaseSchedule(groupPhaseOptions);
    groupMatches.push(...generatedGroupMatches);
  }

  // 2. Generate playoff matches
  if (tournament.groupSystem === 'groupsAndFinals' && Object.values(tournament.finals).some(Boolean)) {
    const numberOfGroups = tournament.numberOfGroups || 2;
    const playoffDefinitions = generatePlayoffDefinitions(
      numberOfGroups,
      tournament.finals,
      tournament.playoffConfig
    );

    // Calculate start slot for playoffs (after group phase)
    const lastGroupSlot = groupMatches.length > 0
      ? Math.max(...groupMatches.map(m => m.slot ?? m.round - 1))
      : -1;

    // Add break between phases
    const breakSlots = tournament.breakBetweenPhases
      ? Math.ceil(tournament.breakBetweenPhases / ((tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration || 0))))
      : 1;

    const playoffStartSlot = lastGroupSlot + 1 + breakSlots;

    // Calculate playoff start time
    let playoffStartTime: Date | undefined;
    if (startTime) {
      const slotDuration = tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration || 0);
      playoffStartTime = new Date(
        startTime.getTime() + playoffStartSlot * slotDuration * 60000
      );
    }

    const playoffOptions: PlayoffScheduleOptions = {
      playoffDefinitions,
      numberOfFields: tournament.numberOfFields,
      slotDurationMinutes: tournament.finalRoundGameDuration || tournament.groupPhaseGameDuration,
      breakBetweenSlotsMinutes: tournament.finalRoundBreakDuration || tournament.groupPhaseBreakDuration || 0,
      minRestSlotsPerTeam: tournament.minRestSlots || 1,
      startSlot: playoffStartSlot,
      startTime: playoffStartTime,
      breakBetweenPhases: tournament.breakBetweenPhases,
    };

    const generatedPlayoffMatches = generatePlayoffSchedule(playoffOptions);
    playoffMatches.push(...generatedPlayoffMatches);
  }

  // 3. Combine all matches
  const allMatches = [...groupMatches, ...playoffMatches];

  // 4. Analyze fairness
  const fairnessAnalysis = groupMatches.length > 0
    ? analyzeScheduleFairness(groupMatches)
    : {
        teamStats: [],
        global: {
          minRestAllTeams: 0,
          maxRestAllTeams: 0,
          avgRestAllTeams: 0,
          totalVariance: 0,
        },
      };

  // 5. Calculate total duration
  const maxSlot = allMatches.length > 0
    ? Math.max(...allMatches.map(m => m.slot ?? m.round - 1))
    : 0;

  const avgSlotDuration =
    (tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration || 0) +
      (tournament.finalRoundGameDuration || tournament.groupPhaseGameDuration) +
      (tournament.finalRoundBreakDuration || tournament.groupPhaseBreakDuration || 0)) / 2;

  const estimatedDurationMinutes = (maxSlot + 1) * avgSlotDuration;

  return {
    groupMatches,
    playoffMatches,
    allMatches,
    fairnessAnalysis,
    totalSlots: maxSlot + 1,
    estimatedDurationMinutes,
  };
}

/**
 * Legacy schedule generation (fallback)
 */
function generateLegacySchedule(tournament: Tournament): TournamentScheduleResult {
  // Import legacy generator
  const { generateMatches } = require('./matchGenerator');
  const matches = generateMatches(tournament);

  // Split into group and playoff
  const groupMatches = matches.filter((m: Match) => !m.isFinal);
  const playoffMatches = matches.filter((m: Match) => m.isFinal);

  return {
    groupMatches,
    playoffMatches,
    allMatches: matches,
    fairnessAnalysis: {
      teamStats: [],
      global: {
        minRestAllTeams: 0,
        maxRestAllTeams: 0,
        avgRestAllTeams: 0,
        totalVariance: 0,
      },
    },
    totalSlots: matches.length,
    estimatedDurationMinutes: matches.length * (tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration || 0)),
  };
}

/**
 * Helper: Format fairness analysis for display
 */
export function formatFairnessReport(analysis: FairnessAnalysis): string {
  const lines: string[] = [];

  lines.push('=== Fairness Analysis ===\n');
  lines.push(`Global Stats:`);
  lines.push(`  Min Rest (all teams): ${analysis.global.minRestAllTeams} slots`);
  lines.push(`  Max Rest (all teams): ${analysis.global.maxRestAllTeams} slots`);
  lines.push(`  Avg Rest (all teams): ${analysis.global.avgRestAllTeams.toFixed(2)} slots`);
  lines.push(`  Variance: ${analysis.global.totalVariance.toFixed(2)}\n`);

  lines.push(`Per-Team Stats:`);
  for (const stat of analysis.teamStats) {
    lines.push(`\n  Team ${stat.teamId}:`);
    lines.push(`    Matches in slots: [${stat.matchSlots.join(', ')}]`);
    lines.push(`    Rest periods: [${stat.restsInSlots.join(', ')}]`);
    lines.push(`    Min/Max/Avg Rest: ${stat.minRest}/${stat.maxRest}/${stat.avgRest.toFixed(2)}`);
    lines.push(`    Rest Variance: ${stat.restVariance.toFixed(2)}`);

    const fieldDist = Array.from(stat.fieldDistribution.entries())
      .map(([field, count]) => `Field ${field}: ${count}`)
      .join(', ');
    lines.push(`    Field Distribution: ${fieldDist}`);

    // Home/Away Balance
    lines.push(`    Home/Away: ${stat.homeCount}/${stat.awayCount} (Balance: ${stat.homeAwayBalance})`);
  }

  return lines.join('\n');
}
