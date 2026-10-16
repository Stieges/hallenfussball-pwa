/**
 * Fair Tournament Scheduler
 *
 * Implements fair match scheduling with:
 * - Multi-field support
 * - Equal rest periods between matches
 * - Even distribution of matches over time
 * - Fair field distribution
 */

import { Team, Match } from '../../types/tournament';
import { FairnessCalculator } from '../../utils/FairnessCalculator';
import { generateGroupStageMatchId } from '../../utils/idGenerator';
import { parseDFBMatches, getDFBPattern } from '../../constants/dfbMatchPatterns';
import {
  createTieBreakKeys,
  isBetterVariant,
  isWithinBaseline,
  measureVariant,
  variantCountFor,
  type VariantMetrics,
} from './scheduleVariants';
import { IncompleteScheduleError } from './incompleteScheduleError';
import { teamSlot, requireTeamId, matchSideTeamId, transitionalSides } from '../models/matchSlot';

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
export interface TeamScheduleState {
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
  /** Optional: DFB pattern code to use (e.g., "1T06M" for 6 teams) */
  dfbPatternCode?: string;
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
  home: Team;
  away: Team | null;
}

/**
 * Generate round-robin pairings using Circle Method
 * This creates a fair rotation where each team plays every other team once
 * Note: Home/away assignment is NOT done here - that happens later for balance
 */
function generateRoundRobinPairings(teams: Team[]): TeamPairing[] {
  const pairings: TeamPairing[] = [];
  const n = teams.length;

  if (n < 2) { return pairings; }

  // For odd number of teams, add a "bye" team
  const teamsWithBye: (Team | null)[] = n % 2 === 0 ? [...teams] : [...teams, null];
  const totalTeams = teamsWithBye.length;

  // Circle method: fix one team, rotate others
  for (let round = 0; round < totalTeams - 1; round++) {
    for (let i = 0; i < totalTeams / 2; i++) {
      const teamA = teamsWithBye[i];
      const teamB = teamsWithBye[totalTeams - 1 - i];

      // Skip if either team is the "bye"
      if (teamA && teamB) {
        pairings.push({ home: teamA, away: teamB });
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
 * Generate pairings from DFB pattern
 * The DFB pattern defines exact match order and should be followed
 */
function generateDFBPairings(teams: Team[], patternCode: string): TeamPairing[] {
  const pattern = getDFBPattern(teams.length);
  if (pattern?.code !== patternCode) {
    console.warn(`[FairScheduler] DFB pattern ${patternCode} not found or doesn't match team count ${teams.length}, falling back to Circle Method`);
    return generateRoundRobinPairings(teams);
  }

  const pairings: TeamPairing[] = [];
  const dfbMatches = parseDFBMatches(pattern);

  for (const { home, away } of dfbMatches) {
    // DFB patterns use 1-based indices
    const teamA = teams[home - 1];
    const teamB = teams[away - 1];

     
    if (teamA && teamB) {
      pairings.push({ home: teamA, away: teamB });
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
  if (!state) { return false; }

  // Check minimum rest period
  if (state.lastSlot !== -Infinity && slot - state.lastSlot < minRestSlots + 1) {
    return false;
  }

  return true;
}

/**
 * Calculate fairness score for assigning a match to a specific slot and field
 * Lower score = more fair
 *
 * Key principle: Minimize the GLOBAL variance (maxAvgRest - minAvgRest) across ALL teams
 */
function calculateFairnessScore(
  teamAId: string,
  teamBId: string,
  slot: number,
  field: number,
  teamStates: Map<string, TeamScheduleState>,
  minRestSlots: number,
  fairnessCalculator: FairnessCalculator
): number {
  const stateA = teamStates.get(teamAId);
  const stateB = teamStates.get(teamBId);

  // Early return if states not found (should never happen with valid input)
  if (!stateA || !stateB) {
    return Infinity;
  }

  let score = 0;

  // Penalize if minimum rest is violated
  if (!canTeamPlayInSlot(teamAId, slot, minRestSlots, teamStates) ||
    !canTeamPlayInSlot(teamBId, slot, minRestSlots, teamStates)) {
    return Infinity; // Invalid assignment
  }

  // PRIORITY 1: Minimize global variance (maxAvgRest - minAvgRest)
  // Use cached values from FairnessCalculator for O(1) lookups

  // Get projected average rest for the two teams playing in this slot
  const projectedAvgA = fairnessCalculator.projectedAvgRest(teamAId, slot);
  const projectedAvgB = fairnessCalculator.projectedAvgRest(teamBId, slot);

  // Get current average rest for all other teams from cache
  const currentAvgs = fairnessCalculator.getAvgRestByTeam();

  // Build complete list with projections for A & B
  const allAvgs: number[] = [];
  currentAvgs.forEach((avg, teamId) => {
    if (teamId !== teamAId && teamId !== teamBId) {
      allAvgs.push(avg);
    }
  });
  allAvgs.push(projectedAvgA, projectedAvgB);

  // Calculate global variance with projected values
  const filtered = allAvgs.filter(v => v > 0);
  if (filtered.length > 0) {
    const globalMinAvg = Math.min(...filtered);
    const globalMaxAvg = Math.max(...filtered);
    const globalVariance = globalMaxAvg - globalMinAvg;
    score += globalVariance * 100; // High weight for global fairness
  }

  // Favor fair field distribution
  const fieldCountA = stateA.fieldCounts.get(field) ?? 0;
  const fieldCountB = stateB.fieldCounts.get(field) ?? 0;
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
 * Validates scheduling options before attempting to generate schedule
 * Returns error message if invalid, null if valid
 */
function validateSchedulingConstraints(
  options: GroupPhaseScheduleOptions
): string | null {
  const { groups, numberOfFields, slotDurationMinutes, breakBetweenSlotsMinutes } = options;

  // Count total teams
  let totalTeams = 0;
  groups.forEach(teams => totalTeams += teams.length);

  // Check 1: Minimum 2 teams
  if (totalTeams < 2) {
    return 'Mindestens 2 Teams werden benötigt';
  }

  // Check 2: Minimum 1 field
  if (numberOfFields < 1 || numberOfFields === 0) {
    return 'Mindestens 1 Feld wird benötigt';
  }

  // Check 3: Positive durations
  if (slotDurationMinutes <= 0) {
    return 'Spieldauer muss positiv sein';
  }

  if (breakBetweenSlotsMinutes < 0) {
    return 'Pause zwischen Spielen kann nicht negativ sein';
  }

  // Check 4: Extreme edge cases (only reject truly impossible scenarios)
  // This is a very conservative check - the actual scheduling algorithm
  // will provide better error messages if constraints can't be met

  // Only reject if setup is obviously impossible (e.g., 100+ teams with 1 field)
  if (totalTeams > 100 && numberOfFields < 3) {
    return (
      `Zu viele Teams (${totalTeams}) für nur ${numberOfFields} Feld(er). ` +
      `Empfehlung: Mindestens 5 Felder verwenden.`
    );
  }

  return null; // ✅ Valid
}

interface PairingEntry {
  groupId: string;
  pairing: TeamPairing;
}

interface RankedPairing extends PairingEntry {
  tieKey: number;
}

/**
 * Alle Paarungen aller Gruppen in fester Reihenfolge.
 */
function buildAllPairings(groups: Map<string, Team[]>, dfbPatternCode?: string): PairingEntry[] {
  const allPairings: PairingEntry[] = [];
  groups.forEach((teams, groupId) => {
    // DFB pattern when specified (official DFB order), otherwise Circle Method
    const pairings = dfbPatternCode
      ? generateDFBPairings(teams, dfbPatternCode)
      : generateRoundRobinPairings(teams);
    for (const pairing of pairings) {
      allPairings.push({ groupId, pairing });
    }
  });
  return allPairings;
}

/**
 * Fehler fuer einen Spielplan, der nicht alle Spiele unterbringt (@W4-025).
 * Wird nie still zurueckgegeben.
 */
function incompleteScheduleError(missingMatches: number): IncompleteScheduleError {
  return new IncompleteScheduleError(missingMatches);
}

/**
 * Erzeugt genau einen Plan fuer einen Gleichstands-Seed, ohne Auswahl.
 * Seed 0 entspricht dem bisherigen Verhalten. Wirft, wenn Spiele fehlen.
 *
 * @internal Nur fuer Tests und Vergleiche; die App nutzt generateGroupPhaseSchedule.
 */
export function scheduleGroupPhaseVariant(options: GroupPhaseScheduleOptions, seed: number): Match[] {
  const validationError = validateSchedulingConstraints(options);
  if (validationError) {
    throw new Error(validationError);
  }
  return runGreedySchedule(options, buildAllPairings(options.groups, options.dfbPatternCode), seed);
}

/**
 * Generiert den Gruppenspielplan. Rechnet variantCountFor(...) Varianten (max. 50)
 * und nimmt die beste (siehe scheduleVariants.ts). Deterministisch: gleiche Eingabe,
 * gleicher Plan. Wirft, wenn keine Variante alle Spiele unterbringt.
 */
export function generateGroupPhaseSchedule(options: GroupPhaseScheduleOptions): Match[] {
  const validationError = validateSchedulingConstraints(options);
  if (validationError) {
    throw new Error(validationError);
  }

  const allPairings = buildAllPairings(options.groups, options.dfbPatternCode);
  const teamCount = [...options.groups.values()].reduce((sum, teams) => sum + teams.length, 0);
  const variantCount = variantCountFor(allPairings.length, teamCount, options.numberOfFields);

  let best: { matches: Match[]; metrics: VariantMetrics } | null = null;
  let firstError: Error | null = null;
  let baseline: VariantMetrics | null = null;

  for (let seed = 0; seed < variantCount; seed++) {
    let matches: Match[];
    try {
      matches = runGreedySchedule(options, allPairings, seed);
    } catch (error) {
      // Unvollstaendige Variante ist kein Plan; Fehler von Seed 0 ist die Referenz.
      firstError ??= error instanceof Error ? error : new Error(String(error));
      continue;
    }
    const metrics = measureVariant(seed, matches);
    if (seed === 0) {
      baseline = metrics;
    } else if (baseline && !isWithinBaseline(metrics, baseline)) {
      continue;
    }
    if (!best || isBetterVariant(metrics, best.metrics)) {
      best = { matches, metrics };
    }
  }

  if (!best) {
    throw firstError ?? incompleteScheduleError(allPairings.length);
  }
  return best.matches;
}

/**
 * Greedy-Lauf fuer einen Gleichstands-Seed. Wirft bei Deadlock oder bei
 * Erreichen der Sicherheitsgrenze, solange noch Spiele offen sind.
 */
function runGreedySchedule(
  options: GroupPhaseScheduleOptions,
  allPairings: PairingEntry[],
  tieBreakSeed: number
): Match[] {
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

  // Create FairnessCalculator for performance optimization
  const fairnessCalculator = new FairnessCalculator();
  fairnessCalculator.bindTeamStates(teamStates);

  // Gleichstands-Schluessel je Paarung (Seed 0 = Paarungs-Reihenfolge)
  const tieKeys = createTieBreakKeys(allPairings.length, tieBreakSeed);
  const remainingPairings: RankedPairing[] = allPairings.map((entry, index) => ({
    ...entry,
    tieKey: tieKeys[index],
  }));

  // Track consecutive empty slots for smarter deadlock detection
  let consecutiveEmptySlots = 0;
  // Maximum empty slots before declaring deadlock:
  // At least minRestSlotsPerTeam + 1 (teams need time to rest)
  // Plus a buffer based on team count
  const maxConsecutiveEmptySlots = Math.max(
    minRestSlotsPerTeam + 2,
    Math.ceil(allTeams.length / numberOfFields) + 1
  );

  while (remainingPairings.length > 0) {
    let progressThisSlot = false; // Track if any match was placed this slot

    // Find slot with available fields
    if (timeSlots.length === currentSlotIndex) {
      timeSlots.push({
        index: currentSlotIndex,
        startTime: startTime ? new Date(startTime.getTime() + currentSlotIndex * (slotDurationMinutes + breakBetweenSlotsMinutes) * 60000) : undefined,
        matches: new Map(),
      });
    }

    const currentSlot = timeSlots[currentSlotIndex];

    // Try to schedule matches in available fields
    for (let field = 1; field <= numberOfFields; field++) {
      if (currentSlot.matches.has(field)) { continue; } // Field occupied

      // Find best pairing for this slot and field
      // Strategy: Prioritize matches with teams that have had longest rest
      let bestPairingIndex = -1;
      let bestScore = Infinity;
      const candidates: Array<{ index: number; score: number; longestRestSinceLastMatch: number; tieKey: number }> = [];

      for (let i = 0; i < remainingPairings.length; i++) {
        const { pairing } = remainingPairings[i];

        // NOTE: pairing.away is guaranteed non-null here because BYE-pairings
        // are filtered out in generateRoundRobinPairings()
        if (!pairing.away) { continue; } // Type guard for safety

        const score = calculateFairnessScore(
          pairing.home.id,
          pairing.away.id,
          currentSlotIndex,
          field,
          teamStates,
          minRestSlotsPerTeam,
          fairnessCalculator
        );

        if (score < Infinity) {
          const teamAState = teamStates.get(pairing.home.id);
          const teamBState = teamStates.get(pairing.away.id);
          if (!teamAState || !teamBState) { continue; } // Skip if states not found
          const restA = currentSlotIndex - teamAState.lastSlot;
          const restB = currentSlotIndex - teamBState.lastSlot;
          const minRest = Math.min(restA, restB);

          candidates.push({ index: i, score, longestRestSinceLastMatch: minRest, tieKey: remainingPairings[i].tieKey });
        }
      }

      // Sort candidates: prefer those with longest rest (to spread matches out),
      // then by fairness score, then by the tie-break key of the variant
      candidates.sort((a, b) => {
        // First priority: choose matches where BOTH teams have had longer rest
        if (a.longestRestSinceLastMatch !== b.longestRestSinceLastMatch) {
          return b.longestRestSinceLastMatch - a.longestRestSinceLastMatch; // Descending
        }
        // Second priority: fairness score
        if (a.score !== b.score) {
          return a.score - b.score;
        }
        // Tie: key of the variant (Seed 0 = pairing order)
        return a.tieKey - b.tieKey;
      });

      if (candidates.length > 0) {
        bestPairingIndex = candidates[0].index;
        bestScore = candidates[0].score;
      }

      // Schedule best pairing if found
      if (bestPairingIndex >= 0 && bestScore < Infinity) {
        const { groupId, pairing } = remainingPairings[bestPairingIndex];

        // Type guard: pairing.away is non-null (BYE-pairings filtered earlier)
        if (!pairing.away) { continue; }

        const stateA = teamStates.get(pairing.home.id);
        const stateB = teamStates.get(pairing.away.id);
        if (!stateA || !stateB) { continue; } // Skip if states not found

        // @TM-015: Gruppenspiele tragen Team-IDs als Slot (wirft, wenn die ID keine UUID ist).
        const sideA = teamSlot(pairing.home.id);
        const sideB = teamSlot(pairing.away.id);
        const match: Match = {
          id: generateGroupStageMatchId(),
          round: currentSlotIndex + 1,
          field,
          slot: currentSlotIndex,
          slotA: sideA,
          slotB: sideB,
          ...transitionalSides(sideA, sideB),
          group: groupId,
          scheduledTime: currentSlot.startTime,
        };

        currentSlot.matches.set(field, match);
        matches.push(match);

        // Update team states (reuse stateA/stateB from above)
        stateA.matchSlots.push(currentSlotIndex);
        stateA.lastSlot = currentSlotIndex;
        stateA.fieldCounts.set(field, (stateA.fieldCounts.get(field) ?? 0) + 1);
        stateA.homeCount++; // Team A is home

        stateB.matchSlots.push(currentSlotIndex);
        stateB.lastSlot = currentSlotIndex;
        stateB.fieldCounts.set(field, (stateB.fieldCounts.get(field) ?? 0) + 1);
        stateB.awayCount++; // Team B is away

        // Update FairnessCalculator caches after assignment
        fairnessCalculator.recordAssignment(pairing.home.id);
        fairnessCalculator.recordAssignment(pairing.away.id);

        remainingPairings.splice(bestPairingIndex, 1);
        progressThisSlot = true; // Mark that we made progress
      }
    }

    // Stall detection: Track consecutive empty slots
    // Empty slots are normal when teams need rest periods
    if (!progressThisSlot) {
      consecutiveEmptySlots++;

      // Only throw if we've had too many consecutive empty slots
      // This indicates a true deadlock, not just normal rest periods
      if (consecutiveEmptySlots > maxConsecutiveEmptySlots) {
        throw incompleteScheduleError(remainingPairings.length);
      }
    } else {
      // Reset counter when we make progress
      consecutiveEmptySlots = 0;
    }

    // Move to next slot
    currentSlotIndex++;

    // Safety limit: running past it with matches still open is an error, never a partial plan (@W4-025)
    if (remainingPairings.length > 0 && currentSlotIndex > allPairings.length * 2) {
      throw incompleteScheduleError(remainingPairings.length);
    }
  }

  // STEP 3: Balance home/away distribution
  balanceHomeAway(matches, teamStates);

  return matches;
}

/** Team-ID einer Seite eines vom Generator erzeugten Gruppenspiels (Invariante: beide Seiten besetzt). */
function groupTeamId(match: Match, side: 'A' | 'B'): string {
  return requireTeamId(side === 'A' ? match.slotA : match.slotB);
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
    // Gruppenspiele tragen immer zwei Team-Slots (Generator-Invariante)
    const balanceA = homeAwayBalance.get(groupTeamId(match, 'A'));
    const balanceB = homeAwayBalance.get(groupTeamId(match, 'B'));
    if (balanceA) { balanceA.home++; }
    if (balanceB) { balanceB.away++; }
  }

  // Find matches where swapping would improve balance
  for (const match of matches) {
    const balanceA = homeAwayBalance.get(groupTeamId(match, 'A'));
    const balanceB = homeAwayBalance.get(groupTeamId(match, 'B'));
    if (!balanceA || !balanceB) { continue; }

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
      // Swap teams (die Slots tauschen; das Übergangsfeld wird daraus neu abgeleitet)
      const tempSlot = match.slotA;
      match.slotA = match.slotB;
      match.slotB = tempSlot;
      Object.assign(match, transitionalSides(match.slotA, match.slotB));

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

  // Collect data (A-03: Team-ID aus dem Slot; eine offene Seite hat kein Team und zählt nicht)
  const record = (teamId: string | undefined, slot: number, field: number, isHome: boolean): void => {
    if (teamId === undefined) { return; }
    let slots = teamMatchSlots.get(teamId);
    let fieldCounts = teamFieldCounts.get(teamId);
    let homeAway = teamHomeAway.get(teamId);
    if (!slots) {
      slots = [];
      teamMatchSlots.set(teamId, slots);
    }
    if (!fieldCounts) {
      fieldCounts = new Map();
      teamFieldCounts.set(teamId, fieldCounts);
    }
    if (!homeAway) {
      homeAway = { home: 0, away: 0 };
      teamHomeAway.set(teamId, homeAway);
    }
    slots.push(slot);
    fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    if (isHome) { homeAway.home++; } else { homeAway.away++; }
  };
  for (const match of matches) {
    const slot = match.slot ?? match.round - 1;
    record(matchSideTeamId(match, 'A'), slot, match.field, true);
    record(matchSideTeamId(match, 'B'), slot, match.field, false);
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

    const homeAway = teamHomeAway.get(teamId) ?? { home: 0, away: 0 };

    teamStats.push({
      teamId,
      matchSlots: slots,
      restsInSlots: rests,
      minRest,
      maxRest,
      avgRest,
      restVariance,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Map.get returns any due to generic instantiation
      fieldDistribution: teamFieldCounts.get(teamId) ?? new Map(),
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
