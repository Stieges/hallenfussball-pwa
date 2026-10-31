/**
 * Smart Config Calculator - Pure functions for tournament time optimization
 * Extracted from SmartConfig.tsx for testability and reusability
 */

import type { FinalsPreset } from '../../../types/tournament';
import { generatePlayoffMatches, type GroupSizeInfo } from '../../../core/generators/playoffGenerator';

const STORAGE_KEY = 'smartConfig';

/** Stored configuration from localStorage */
export interface StoredConfig {
  lastHours: number;
  lastApplied?: {
    teams: number;
    fields: number;
    gameDuration: number;
    breakDuration: number;
  };
  /** Saved constraints from last session */
  lastConstraints?: LockedConstraints;
}

/** Fixed constraints that the algorithm cannot change */
export interface LockedConstraints {
  teams?: number;         // e.g., "exactly 8 teams"
  fields?: number;        // e.g., "only 1 field available"
  gameDuration?: number;  // e.g., "exactly 10 min game duration"
  breakDuration?: number; // e.g., "exactly 3 min break"
}

/** Result config to apply to tournament */
export interface SmartConfigResult {
  numberOfTeams: number;
  numberOfFields: number;
  groupPhaseGameDuration: number;
  groupPhaseBreakDuration: number;
}

/** Single recommendation configuration */
export interface Recommendation {
  teams: number;
  fields: number;
  gameDuration: number;
  breakDuration: number;
  totalMatches: number;
  estimatedHours: number;
  /** Gruppenzahl, mit der gerechnet wurde (nur bei mindestens 2 Gruppen, @W4-021) */
  groupCount?: number;
  /** Finalrunde, mit der gerechnet wurde (zusammen mit groupCount) */
  finalsPlan?: FinalsPreset;
}

/** Result of calculation attempt */
export interface CalculationResult {
  recommendation: Recommendation | null;
  constraintsImpossible: boolean;
  minRequiredHours?: number;
  /** Festgehaltene Teamzahl passt mit keiner Konfiguration in die Zeit (@W4-022) */
  teamsKeptTimeShort?: boolean;
}

/**
 * Spielstruktur des Turniers (@W4-020).
 * groupCount fehlt oder < 2 → jeder gegen jeden über alle Teams.
 * finalsPlan wird nur zusammen mit Gruppen gezählt.
 */
export interface MatchStructure {
  groupCount?: number;
  finalsPlan?: FinalsPreset;
  /** @TM-152: Rundenzahl bei „Jeder gegen jeden“ (ohne Gruppen), Vorgabe 1. */
  rounds?: number;
}

/**
 * Finalrunde, die der Generator bei dieser Gruppenzahl tatsächlich spielt (@W4-021).
 * Spiegelt die Rückfälle in core/generators/playoffGenerator.ts.
 */
export function effectiveFinalsPreset(groupCount: number, preset: FinalsPreset): FinalsPreset {
  switch (preset) {
    case 'top-16':
      if (groupCount >= 8) {return 'top-16';}
      return groupCount >= 4 ? 'top-8' : 'top-4';
    case 'top-8':
      return groupCount >= 4 ? 'top-8' : 'top-4';
    case 'all-places':
      if (groupCount === 2) {return 'all-places';}
      return groupCount >= 4 ? 'top-8' : 'top-4';
    default:
      return preset;
  }
}

/** Spielstruktur, die in die Empfehlung übernommen wird (nur bei mindestens 2 Gruppen). */
function structureOf(structure: MatchStructure): Pick<Recommendation, 'groupCount' | 'finalsPlan'> {
  if (structure.groupCount === undefined || structure.groupCount < 2) {
    return {};
  }
  return {
    groupCount: structure.groupCount,
    finalsPlan: effectiveFinalsPreset(structure.groupCount, structure.finalsPlan ?? 'none'),
  };
}

/**
 * Anzahl der Spiele eines Turniers: Gruppenspiele je Gruppe (n·(n−1)/2, bei
 * ungleichen Gruppen größere Gruppen zuerst) plus Spiele der Finalrunde.
 */
export function countTournamentMatches(teams: number, structure: MatchStructure = {}): number {
  const { groupCount, finalsPlan = 'none', rounds = 1 } = structure;
  if (groupCount === undefined || groupCount < 2) {
    return ((teams * (teams - 1)) / 2) * rounds;
  }
  const baseSize = Math.floor(teams / groupCount);
  const largerGroups = teams % groupCount;
  let groupGames = 0;
  // Gruppengrößen für den Generator: „Alle Plätze“ hängt bei 2 Gruppen von der kleinsten Gruppe ab
  const groupSizes: GroupSizeInfo = {};
  for (let index = 0; index < groupCount; index++) {
    const size = index < largerGroups ? baseSize + 1 : baseSize;
    groupGames += (size * (size - 1)) / 2;
    groupSizes[String.fromCharCode(65 + index)] = size;
  }
  const finalsMatches = generatePlayoffMatches(groupCount, { preset: finalsPlan }, groupSizes);
  return groupGames + finalsMatches.length;
}

// Storage functions
export function loadStoredConfig(): StoredConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<StoredConfig>;
      return { lastHours: 4, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return { lastHours: 4 };
}

export function saveStoredConfig(config: StoredConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Calculate optimal tournament configuration based on available time and constraints
 */
export function calculateRecommendation(
  availableHours: number,
  currentTeams: number,
  constraints: LockedConstraints = {},
  structure: MatchStructure = {}
): CalculationResult {
  // Start with current team count and find optimal fields
  const teams = currentTeams;
  const totalMatches = countTournamentMatches(teams, structure);

  // Try different configurations
  const configurations: Recommendation[] = [];

  // Values to try - use constraint if locked, otherwise try all options
  const gameDurations = constraints.gameDuration
    ? [constraints.gameDuration]
    : [5, 6, 7, 8, 10, 12, 15];
  const breakDurations = constraints.breakDuration
    ? [constraints.breakDuration]
    : [0, 1, 2, 3, 5];
  const fieldOptions = constraints.fields
    ? [constraints.fields]
    : [1, 2, 3, 4];

  // Track minimum hours needed with constraints
  let minHoursWithConstraints = Infinity;
  // Schnellste Konfiguration (für eine festgehaltene Teamzahl, @W4-022)
  let fastest: Recommendation | null = null;

  for (const gameDuration of gameDurations) {
    for (const breakDuration of breakDurations) {
      for (const fields of fieldOptions) {
        const slotDuration = gameDuration + breakDuration;
        const slotsNeeded = Math.ceil(totalMatches / fields);
        const totalMinutes = slotsNeeded * slotDuration;
        const estimatedHours = totalMinutes / 60;

        // Track minimum hours needed
        if (estimatedHours < minHoursWithConstraints) {
          minHoursWithConstraints = estimatedHours;
        }
        if (fastest === null || estimatedHours < fastest.estimatedHours) {
          fastest = {
            teams,
            fields,
            gameDuration,
            breakDuration,
            totalMatches,
            estimatedHours,
            ...structureOf(structure),
          };
        }

        if (estimatedHours <= availableHours) {
          configurations.push({
            teams,
            fields,
            gameDuration,
            breakDuration,
            totalMatches,
            estimatedHours,
            ...structureOf(structure),
          });
        }
      }
    }
  }

  // Sort by: fewer fields (simpler), then longer game duration (better quality)
  configurations.sort((a, b) => {
    if (a.fields !== b.fields) {return a.fields - b.fields;}
    return b.gameDuration - a.gameDuration;
  });

  // Return best match if found
  if (configurations.length > 0) {
    return {
      recommendation: configurations[0],
      constraintsImpossible: false,
    };
  }

  // Festgehaltene Teamzahl: nie verändern, auch wenn die Zeit nicht reicht (@W4-022).
  // Festgehaltene Werte bleiben wie eingestellt, freie Werte nehmen die schnellste Konfiguration.
  // Der Hinweis sagt, dass die Zeit nicht reicht; „Übernehmen“ bleibt möglich.
  if (constraints.teams !== undefined && fastest !== null) {
    return {
      recommendation: fastest,
      constraintsImpossible: false,
      teamsKeptTimeShort: true,
    };
  }

  // Check if constraints make it impossible
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if any constraint is set
  const hasConstraints = constraints.fields || constraints.gameDuration || constraints.breakDuration;
  if (hasConstraints) {
    return {
      recommendation: null,
      constraintsImpossible: true,
      minRequiredHours: Math.ceil(minHoursWithConstraints * 10) / 10,
    };
  }

  // Fallback without constraints: reduce teams
  const reducedTeams = Math.max(4, Math.floor(teams * 0.7));
  const reducedMatches = countTournamentMatches(reducedTeams, structure);
  const fields = Math.ceil(reducedMatches / (availableHours * 60 / 12));

  return {
    recommendation: {
      teams: reducedTeams,
      fields: Math.max(1, Math.min(4, fields)),
      gameDuration: 10,
      breakDuration: 2,
      totalMatches: reducedMatches,
      estimatedHours: (reducedMatches / Math.max(1, fields)) * 12 / 60,
      ...structureOf(structure),
    },
    constraintsImpossible: false,
  };
}

/**
 * Build constraints list for display in warnings
 */
export function buildConstraintsList(constraints: LockedConstraints): string[] {
  const list: string[] = [];
  if (constraints.teams) {list.push(`${constraints.teams} Teams`);}
  if (constraints.fields) {
    list.push(`${constraints.fields} ${constraints.fields === 1 ? 'Feld' : 'Felder'}`);
  }
  if (constraints.gameDuration) {list.push(`${constraints.gameDuration} Min Spieldauer`);}
  if (constraints.breakDuration) {list.push(`${constraints.breakDuration} Min Pause`);}
  return list;
}
