/**
 * Smart Config Calculator - Pure functions for tournament time optimization
 * Extracted from SmartConfig.tsx for testability and reusability
 */

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
  groups?: number;        // e.g., "exactly 2 groups" (only for groupsAndFinals)
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
}

/** Result of calculation attempt */
export interface CalculationResult {
  recommendation: Recommendation | null;
  constraintsImpossible: boolean;
  minRequiredHours?: number;
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
  constraints: LockedConstraints = {}
): CalculationResult {
  // Start with current team count and find optimal fields
  const teams = currentTeams;
  const totalMatches = (teams * (teams - 1)) / 2;

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

        if (estimatedHours <= availableHours) {
          configurations.push({
            teams,
            fields,
            gameDuration,
            breakDuration,
            totalMatches,
            estimatedHours,
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
  const reducedMatches = (reducedTeams * (reducedTeams - 1)) / 2;
  const fields = Math.ceil(reducedMatches / (availableHours * 60 / 12));

  return {
    recommendation: {
      teams: reducedTeams,
      fields: Math.max(1, Math.min(4, fields)),
      gameDuration: 10,
      breakDuration: 2,
      totalMatches: reducedMatches,
      estimatedHours: (reducedMatches / Math.max(1, fields)) * 12 / 60,
    },
    constraintsImpossible: false,
  };
}

/**
 * Build constraints list for display in warnings
 */
export function buildConstraintsList(
  constraints: LockedConstraints,
  usesGroups: boolean
): string[] {
  const list: string[] = [];
  if (constraints.teams) {list.push(`${constraints.teams} Teams`);}
  if (constraints.groups && usesGroups) {list.push(`${constraints.groups} Gruppen`);}
  if (constraints.fields) {
    list.push(`${constraints.fields} ${constraints.fields === 1 ? 'Feld' : 'Felder'}`);
  }
  if (constraints.gameDuration) {list.push(`${constraints.gameDuration} Min Spieldauer`);}
  if (constraints.breakDuration) {list.push(`${constraints.breakDuration} Min Pause`);}
  return list;
}
