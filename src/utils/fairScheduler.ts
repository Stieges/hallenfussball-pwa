/**
 * Fair Tournament Scheduler
 *
 * Implements fair match scheduling with:
 * - Multi-field support
 * - Equal rest periods between matches
 * - Even distribution of matches over time
 * - Fair field distribution
 */

import { Team, Match } from '../types/tournament';

/**
 * Represents a time slot in the schedule
 */
export interface TimeSlot {
  index: number;
  startTime?: Date;
  matches: Map<number, Match>; // fieldIndex -> Match
}

/**
 * Team scheduling state for fairness tracking
 */
interface TeamScheduleState {
  teamId: string;
  matchSlots: number[]; // Slots where team plays
  fieldCounts: Map<number, number>; // fieldIndex -> count
  lastSlot: number;
  homeCount: number; // Number of times team plays as home
  awayCount: number; // Number of times team plays as away
}

/**
 * Options for group phase scheduling
 */
export interface GroupPhaseScheduleOptions {
  groups: Map<string, Team[]>; // groupId -> teams
  numberOfFields: number;
  slotDurationMinutes: number;
  breakBetweenSlotsMinutes: number;
  minRestSlotsPerTeam: number; // e.g., 1 = no back-to-back matches
  startTime?: Date;
}

/**
 * Fairness analysis result
 */
export interface FairnessAnalysis {
  teamStats: TeamFairnessStats[];
  global: GlobalFairnessStats;
}

export interface TeamFairnessStats {
  teamId: string;
  matchSlots: number[];
  restsInSlots: number[]; // Rest periods between consecutive matches
  minRest: number;
  maxRest: number;
  avgRest: number;
  restVariance: number;
  fieldDistribution: Map<number, number>; // fieldIndex -> count
  homeCount: number; // Number of home matches
  awayCount: number; // Number of away matches
  homeAwayBalance: number; // |homeCount - awayCount|
}

export interface GlobalFairnessStats {
  minRestAllTeams: number;
  maxRestAllTeams: number;
  avgRestAllTeams: number;
  totalVariance: number;
}

/**
 * Pairing without home/away assignment yet
 */
interface TeamPairing {
  teamA: Team;
  teamB: Team;
}

/**
 * Generate round-robin pairings using Circle Method
 * This creates a fair rotation where each team plays every other team once
 * Note: Home/away assignment is NOT done here - that happens later for balance
 */
function generateRoundRobinPairings(teams: Team[]): TeamPairing[] {
  const pairings: TeamPairing[] = [];
  const n = teams.length;

  if (n < 2) return pairings;

  // For odd number of teams, add a "bye" team
  const teamsWithBye = n % 2 === 0 ? [...teams] : [...teams, null as any];
  const totalTeams = teamsWithBye.length;

  // Circle method: fix one team, rotate others
  for (let round = 0; round < totalTeams - 1; round++) {
    for (let i = 0; i < totalTeams / 2; i++) {
      const teamA = teamsWithBye[i];
      const teamB = teamsWithBye[totalTeams - 1 - i];

      // Skip if either team is the "bye"
      if (teamA && teamB) {
        pairings.push({ teamA, teamB });
      }
    }

    // Rotate all teams except the first one
    if (totalTeams > 2) {
      const temp = teamsWithBye[totalTeams - 1];
      for (let i = totalTeams - 1; i > 1; i--) {
        teamsWithBye[i] = teamsWithBye[i - 1];
      }
      teamsWithBye[1] = temp;
    }
  }

  return pairings;
}

/**
 * Initialize team schedule states
 */
function initializeTeamStates(teams: Team[]): Map<string, TeamScheduleState> {
  const states = new Map<string, TeamScheduleState>();

  for (const team of teams) {
    states.set(team.id, {
      teamId: team.id,
      matchSlots: [],
      fieldCounts: new Map(),
      lastSlot: -Infinity,
      homeCount: 0,
      awayCount: 0,
    });
  }

  return states;
}

/**
 * Check if a team can play in a given slot (respects minimum rest)
 */
function canTeamPlayInSlot(
  teamId: string,
  slot: number,
  minRestSlots: number,
  teamStates: Map<string, TeamScheduleState>
): boolean {
  const state = teamStates.get(teamId);
  if (!state) return false;

  // Check minimum rest period
  if (state.lastSlot !== -Infinity && slot - state.lastSlot < minRestSlots + 1) {
    return false;
  }

  return true;
}

/**
 * Calculate fairness score for assigning a match to a specific slot and field
 * Lower score = more fair
 */
function calculateFairnessScore(
  teamAId: string,
  teamBId: string,
  slot: number,
  field: number,
  teamStates: Map<string, TeamScheduleState>,
  minRestSlots: number
): number {
  const stateA = teamStates.get(teamAId)!;
  const stateB = teamStates.get(teamBId)!;

  let score = 0;

  // Penalize if minimum rest is violated
  if (!canTeamPlayInSlot(teamAId, slot, minRestSlots, teamStates) ||
      !canTeamPlayInSlot(teamBId, slot, minRestSlots, teamStates)) {
    return Infinity; // Invalid assignment
  }

  // Favor more even rest periods
  const restA = slot - stateA.lastSlot;
  const restB = slot - stateB.lastSlot;

  if (stateA.matchSlots.length > 0) {
    const avgRestA = stateA.matchSlots.length > 1
      ? stateA.matchSlots.slice(1).reduce((sum, s, i) => sum + (s - stateA.matchSlots[i]), 0) / (stateA.matchSlots.length - 1)
      : restA;
    score += Math.abs(restA - avgRestA);
  }

  if (stateB.matchSlots.length > 0) {
    const avgRestB = stateB.matchSlots.length > 1
      ? stateB.matchSlots.slice(1).reduce((sum, s, i) => sum + (s - stateB.matchSlots[i]), 0) / (stateB.matchSlots.length - 1)
      : restB;
    score += Math.abs(restB - avgRestB);
  }

  // Favor fair field distribution
  const fieldCountA = stateA.fieldCounts.get(field) || 0;
  const fieldCountB = stateB.fieldCounts.get(field) || 0;
  const totalMatchesA = stateA.matchSlots.length;
  const totalMatchesB = stateB.matchSlots.length;

  if (totalMatchesA > 0) {
    score += fieldCountA / totalMatchesA * 10; // Penalize overuse of same field
  }
  if (totalMatchesB > 0) {
    score += fieldCountB / totalMatchesB * 10;
  }

  // Favor fair home/away distribution
  // TeamA would be home, TeamB would be away
  const homeAwayImbalanceA = Math.abs(stateA.homeCount - stateA.awayCount);
  const homeAwayImbalanceB = Math.abs(stateB.homeCount - stateB.awayCount);

  // Penalize if this assignment would increase imbalance
  const newImbalanceA = Math.abs((stateA.homeCount + 1) - stateA.awayCount);
  const newImbalanceB = Math.abs(stateB.homeCount - (stateB.awayCount + 1));

  if (newImbalanceA > homeAwayImbalanceA) {
    score += 5; // Penalize increasing home imbalance for team A
  }
  if (newImbalanceB > homeAwayImbalanceB) {
    score += 5; // Penalize increasing away imbalance for team B
  }

  // Slightly favor earlier slots to avoid scheduling everything late
  score += slot * 0.1;

  return score;
}

/**
 * Generate fair group phase schedule
 */
export function generateGroupPhaseSchedule(options: GroupPhaseScheduleOptions): Match[] {
  const {
    groups,
    numberOfFields,
    slotDurationMinutes,
    breakBetweenSlotsMinutes,
    minRestSlotsPerTeam,
    startTime,
  } = options;

  const matches: Match[] = [];
  const timeSlots: TimeSlot[] = [];
  let currentSlotIndex = 0;

  // Initialize team states for all teams
  const allTeams: Team[] = [];
  groups.forEach(teams => allTeams.push(...teams));
  const teamStates = initializeTeamStates(allTeams);

  // Generate round-robin pairings for each group
  const groupPairings = new Map<string, TeamPairing[]>();
  groups.forEach((teams, groupId) => {
    groupPairings.set(groupId, generateRoundRobinPairings(teams));
  });

  // Flatten all pairings with group info
  const allPairings: Array<{ groupId: string; pairing: TeamPairing }> = [];
  groupPairings.forEach((pairings, groupId) => {
    pairings.forEach((pairing) => {
      allPairings.push({ groupId, pairing });
    });
  });

  // Schedule matches using greedy algorithm with fairness heuristic
  const remainingPairings = [...allPairings];

  while (remainingPairings.length > 0) {
    // Find slot with available fields
    if (timeSlots.length === currentSlotIndex) {
      timeSlots.push({
        index: currentSlotIndex,
        startTime: startTime ? new Date(startTime.getTime() + currentSlotIndex * (slotDurationMinutes + breakBetweenSlotsMinutes) * 60000) : undefined,
        matches: new Map(),
      });
    }

    const currentSlot = timeSlots[currentSlotIndex];
    let scheduledInThisSlot = false;

    // Try to schedule matches in available fields
    for (let field = 1; field <= numberOfFields; field++) {
      if (currentSlot.matches.has(field)) continue; // Field occupied

      // Find best pairing for this slot and field
      let bestPairingIndex = -1;
      let bestScore = Infinity;

      for (let i = 0; i < remainingPairings.length; i++) {
        const { pairing } = remainingPairings[i];

        const score = calculateFairnessScore(
          pairing.teamA.id,
          pairing.teamB.id,
          currentSlotIndex,
          field,
          teamStates,
          minRestSlotsPerTeam
        );

        if (score < bestScore) {
          bestScore = score;
          bestPairingIndex = i;
        }
      }

      // Schedule best pairing if found
      if (bestPairingIndex >= 0 && bestScore < Infinity) {
        const { groupId, pairing } = remainingPairings[bestPairingIndex];
        const match: Match = {
          id: `match-${Date.now()}-${matches.length}`,
          round: currentSlotIndex + 1,
          field,
          slot: currentSlotIndex,
          teamA: pairing.teamA.id,
          teamB: pairing.teamB.id,
          group: groupId,
          scheduledTime: currentSlot.startTime,
        };

        currentSlot.matches.set(field, match);
        matches.push(match);

        // Update team states
        const stateA = teamStates.get(pairing.teamA.id)!;
        const stateB = teamStates.get(pairing.teamB.id)!;

        stateA.matchSlots.push(currentSlotIndex);
        stateA.lastSlot = currentSlotIndex;
        stateA.fieldCounts.set(field, (stateA.fieldCounts.get(field) || 0) + 1);
        stateA.homeCount++; // Team A is home

        stateB.matchSlots.push(currentSlotIndex);
        stateB.lastSlot = currentSlotIndex;
        stateB.fieldCounts.set(field, (stateB.fieldCounts.get(field) || 0) + 1);
        stateB.awayCount++; // Team B is away

        remainingPairings.splice(bestPairingIndex, 1);
        scheduledInThisSlot = true;
      }
    }

    // Move to next slot
    currentSlotIndex++;

    // Safety check to prevent infinite loop
    if (currentSlotIndex > allPairings.length * 2) {
      console.error('Fair scheduler: Could not schedule all matches with given constraints');
      break;
    }
  }

  // STEP 3: Balance home/away distribution
  balanceHomeAway(matches, teamStates);

  return matches;
}

/**
 * Balance home/away distribution by swapping team positions in matches
 * This is done AFTER time scheduling to not affect pause fairness
 */
function balanceHomeAway(matches: Match[], teamStates: Map<string, TeamScheduleState>): void {
  // Count current home/away per team
  const homeAwayBalance = new Map<string, { home: number; away: number }>();

  teamStates.forEach((_, teamId) => {
    homeAwayBalance.set(teamId, { home: 0, away: 0 });
  });

  // Initial count
  for (const match of matches) {
    const balanceA = homeAwayBalance.get(match.teamA)!;
    const balanceB = homeAwayBalance.get(match.teamB)!;
    balanceA.home++;
    balanceB.away++;
  }

  // Find matches where swapping would improve balance
  for (const match of matches) {
    const balanceA = homeAwayBalance.get(match.teamA)!;
    const balanceB = homeAwayBalance.get(match.teamB)!;

    // Calculate current imbalances
    const imbalanceA = Math.abs(balanceA.home - balanceA.away);
    const imbalanceB = Math.abs(balanceB.home - balanceB.away);
    const totalImbalance = imbalanceA + imbalanceB;

    // Calculate imbalance after swap
    const newImbalanceA = Math.abs((balanceA.home - 1) - (balanceA.away + 1));
    const newImbalanceB = Math.abs((balanceB.home + 1) - (balanceB.away - 1));
    const newTotalImbalance = newImbalanceA + newImbalanceB;

    // Swap if it improves total balance
    if (newTotalImbalance < totalImbalance) {
      // Swap teams
      const temp = match.teamA;
      match.teamA = match.teamB;
      match.teamB = temp;

      // Update balance counters
      balanceA.home--;
      balanceA.away++;
      balanceB.home++;
      balanceB.away--;
    }
  }
}

/**
 * Analyze schedule fairness
 */
export function analyzeScheduleFairness(matches: Match[]): FairnessAnalysis {
  const teamMatchSlots = new Map<string, number[]>();
  const teamFieldCounts = new Map<string, Map<number, number>>();
  const teamHomeAway = new Map<string, { home: number; away: number }>();

  // Collect data
  for (const match of matches) {
    const slot = match.slot ?? match.round - 1;
    const field = match.field;

    // Team A (Home)
    if (!teamMatchSlots.has(match.teamA)) {
      teamMatchSlots.set(match.teamA, []);
      teamFieldCounts.set(match.teamA, new Map());
      teamHomeAway.set(match.teamA, { home: 0, away: 0 });
    }
    teamMatchSlots.get(match.teamA)!.push(slot);
    const fieldCountsA = teamFieldCounts.get(match.teamA)!;
    fieldCountsA.set(field, (fieldCountsA.get(field) || 0) + 1);
    teamHomeAway.get(match.teamA)!.home++;

    // Team B (Away)
    if (!teamMatchSlots.has(match.teamB)) {
      teamMatchSlots.set(match.teamB, []);
      teamFieldCounts.set(match.teamB, new Map());
      teamHomeAway.set(match.teamB, { home: 0, away: 0 });
    }
    teamMatchSlots.get(match.teamB)!.push(slot);
    const fieldCountsB = teamFieldCounts.get(match.teamB)!;
    fieldCountsB.set(field, (fieldCountsB.get(field) || 0) + 1);
    teamHomeAway.get(match.teamB)!.away++;
  }

  // Calculate stats per team
  const teamStats: TeamFairnessStats[] = [];
  let globalMinRest = Infinity;
  let globalMaxRest = -Infinity;
  let globalAvgSum = 0;
  let globalCount = 0;

  teamMatchSlots.forEach((slots, teamId) => {
    slots.sort((a, b) => a - b);

    const rests: number[] = [];
    for (let i = 1; i < slots.length; i++) {
      rests.push(slots[i] - slots[i - 1]);
    }

    const minRest = rests.length > 0 ? Math.min(...rests) : 0;
    const maxRest = rests.length > 0 ? Math.max(...rests) : 0;
    const avgRest = rests.length > 0 ? rests.reduce((a, b) => a + b, 0) / rests.length : 0;
    const restVariance = rests.length > 0
      ? rests.reduce((sum, r) => sum + Math.pow(r - avgRest, 2), 0) / rests.length
      : 0;

    globalMinRest = Math.min(globalMinRest, minRest);
    globalMaxRest = Math.max(globalMaxRest, maxRest);
    globalAvgSum += avgRest;
    globalCount++;

    const homeAway = teamHomeAway.get(teamId) || { home: 0, away: 0 };

    teamStats.push({
      teamId,
      matchSlots: slots,
      restsInSlots: rests,
      minRest,
      maxRest,
      avgRest,
      restVariance,
      fieldDistribution: teamFieldCounts.get(teamId) || new Map(),
      homeCount: homeAway.home,
      awayCount: homeAway.away,
      homeAwayBalance: Math.abs(homeAway.home - homeAway.away),
    });
  });

  // Calculate global variance
  const globalAvgRest = globalCount > 0 ? globalAvgSum / globalCount : 0;
  const totalVariance = teamStats.reduce((sum, stat) => {
    return sum + Math.pow(stat.avgRest - globalAvgRest, 2);
  }, 0) / (teamStats.length || 1);

  return {
    teamStats,
    global: {
      minRestAllTeams: globalMinRest === Infinity ? 0 : globalMinRest,
      maxRestAllTeams: globalMaxRest === -Infinity ? 0 : globalMaxRest,
      avgRestAllTeams: globalAvgRest,
      totalVariance,
    },
  };
}
