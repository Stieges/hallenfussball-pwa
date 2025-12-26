/**
 * US-SCHEDULE-EDITOR: useMatchConflicts Hook
 *
 * React hook for real-time schedule conflict detection.
 * Provides:
 * - List of all conflicts
 * - Conflicts grouped by match (O(1) lookup)
 * - Change validation
 * - Conflict counts by severity
 */

import { useMemo, useCallback } from 'react';
import { Match, Team, Tournament } from '../../../types/tournament';
import {
  ScheduleConflict,
  ConflictDetectionConfig,
  MatchChange,
} from '../types';
import {
  detectAllConflicts,
  validateMatchChange,
} from '../utils/scheduleConflicts';

// ============================================================================
// Types
// ============================================================================

export interface UseMatchConflictsOptions {
  /** Array of matches to check */
  matches: Match[];
  /** Array of teams for team name lookups */
  teams: Team[];
  /** Match duration in minutes */
  matchDurationMinutes: number;
  /** Minimum break between matches for a team (in minutes) */
  minBreakMinutes?: number;
  /** Whether to check referee conflicts */
  checkRefereeConflicts?: boolean;
  /** Whether to check field conflicts */
  checkFieldConflicts?: boolean;
  /** Disable conflict detection (for performance) */
  enabled?: boolean;
}

export interface UseMatchConflictsReturn {
  /** All detected conflicts */
  conflicts: ScheduleConflict[];
  /** Map from matchId to its conflicts (O(1) lookup) */
  conflictsByMatch: Map<string, ScheduleConflict[]>;
  /** Number of error-level conflicts */
  errorCount: number;
  /** Number of warning-level conflicts */
  warningCount: number;
  /** Whether there are any blocking (error) conflicts */
  hasErrors: boolean;
  /** Whether there are any warning conflicts */
  hasWarnings: boolean;
  /** Validate a proposed change before applying */
  validateChange: (change: MatchChange) => ScheduleConflict[];
  /** Get conflicts for a specific match */
  getMatchConflicts: (matchId: string) => ScheduleConflict[];
  /** Check if a specific match has conflicts */
  matchHasConflicts: (matchId: string) => boolean;
  /** Check if a specific match has error-level conflicts */
  matchHasErrors: (matchId: string) => boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_MIN_BREAK_MINUTES = 5;
const DEFAULT_CHECK_REFEREES = true;
const DEFAULT_CHECK_FIELDS = true;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for detecting and managing schedule conflicts
 */
export function useMatchConflicts(
  options: UseMatchConflictsOptions
): UseMatchConflictsReturn {
  const {
    matches,
    teams,
    matchDurationMinutes,
    minBreakMinutes = DEFAULT_MIN_BREAK_MINUTES,
    checkRefereeConflicts = DEFAULT_CHECK_REFEREES,
    checkFieldConflicts = DEFAULT_CHECK_FIELDS,
    enabled = true,
  } = options;

  // Build configuration object
  const config: ConflictDetectionConfig = useMemo(
    () => ({
      matchDurationMinutes,
      minBreakMinutes,
      checkRefereeConflicts,
      checkFieldConflicts,
    }),
    [matchDurationMinutes, minBreakMinutes, checkRefereeConflicts, checkFieldConflicts]
  );

  // Detect all conflicts (memoized)
  const conflicts = useMemo(() => {
    if (!enabled || matches.length === 0) return [];
    return detectAllConflicts(matches, teams, config);
  }, [matches, teams, config, enabled]);

  // Build match -> conflicts map for O(1) lookup
  const conflictsByMatch = useMemo(() => {
    const map = new Map<string, ScheduleConflict[]>();

    for (const conflict of conflicts) {
      for (const matchId of conflict.matchIds) {
        const existing = map.get(matchId) || [];
        // Avoid duplicates
        if (!existing.some(c => c.id === conflict.id)) {
          map.set(matchId, [...existing, conflict]);
        }
      }
    }

    return map;
  }, [conflicts]);

  // Count conflicts by severity
  const { errorCount, warningCount } = useMemo(() => {
    let errors = 0;
    let warnings = 0;

    for (const conflict of conflicts) {
      if (conflict.severity === 'error') errors++;
      else if (conflict.severity === 'warning') warnings++;
    }

    return { errorCount: errors, warningCount: warnings };
  }, [conflicts]);

  // Validate a proposed change
  const validateChange = useCallback(
    (change: MatchChange): ScheduleConflict[] => {
      if (!enabled) return [];
      return validateMatchChange(matches, teams, change, config);
    },
    [matches, teams, config, enabled]
  );

  // Get conflicts for a specific match
  const getMatchConflicts = useCallback(
    (matchId: string): ScheduleConflict[] => {
      return conflictsByMatch.get(matchId) || [];
    },
    [conflictsByMatch]
  );

  // Check if match has any conflicts
  const matchHasConflicts = useCallback(
    (matchId: string): boolean => {
      return (conflictsByMatch.get(matchId)?.length || 0) > 0;
    },
    [conflictsByMatch]
  );

  // Check if match has error-level conflicts
  const matchHasErrors = useCallback(
    (matchId: string): boolean => {
      const matchConflicts = conflictsByMatch.get(matchId) || [];
      return matchConflicts.some(c => c.severity === 'error');
    },
    [conflictsByMatch]
  );

  return {
    conflicts,
    conflictsByMatch,
    errorCount,
    warningCount,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    validateChange,
    getMatchConflicts,
    matchHasConflicts,
    matchHasErrors,
  };
}

// ============================================================================
// Convenience Hook for Tournament Context
// ============================================================================

/**
 * Hook that works directly with a Tournament object
 */
export function useMatchConflictsFromTournament(
  tournament: Tournament | null,
  enabled: boolean = true
): UseMatchConflictsReturn {
  const emptyResult: UseMatchConflictsReturn = {
    conflicts: [],
    conflictsByMatch: new Map(),
    errorCount: 0,
    warningCount: 0,
    hasErrors: false,
    hasWarnings: false,
    validateChange: () => [],
    getMatchConflicts: () => [],
    matchHasConflicts: () => false,
    matchHasErrors: () => false,
  };

  const result = useMatchConflicts({
    matches: tournament?.matches || [],
    teams: tournament?.teams || [],
    matchDurationMinutes: tournament?.groupPhaseGameDuration || tournament?.gameDuration || 10,
    minBreakMinutes: tournament?.groupPhaseBreakDuration || tournament?.breakDuration || 2,
    checkRefereeConflicts: tournament?.refereeConfig?.mode !== 'none',
    checkFieldConflicts: true,
    enabled: enabled && tournament !== null,
  });

  if (!tournament) return emptyResult;
  return result;
}

export default useMatchConflicts;
