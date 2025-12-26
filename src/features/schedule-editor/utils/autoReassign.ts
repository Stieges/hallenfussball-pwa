/**
 * US-SCHEDULE-EDITOR: Auto-Reassignment Utility
 *
 * Automatically reassigns referees after schedule changes.
 * Features:
 * - Fair distribution based on workload
 * - Conflict avoidance
 * - Batch change tracking
 */

import { Match, RefereeConfig } from '../../../types/tournament';
import { MatchChange, ReassignmentResult, ReassignmentOptions } from '../types';
import { detectAllConflicts } from './scheduleConflicts';

// ============================================================================
// Types
// ============================================================================

interface RefereeWorkload {
  refereeId: number;
  name: string;
  assignedMatches: number;
  consecutiveMatches: number;
  matchIds: string[];
}

// ============================================================================
// Workload Calculation
// ============================================================================

/**
 * Calculate current referee workloads from matches
 */
function calculateRefereeWorkloads(
  matches: Match[],
  refereeConfig: RefereeConfig
): Map<number, RefereeWorkload> {
  const workloads = new Map<number, RefereeWorkload>();

  // Initialize all referees
  const numReferees = refereeConfig.numberOfReferees ?? 0;
  for (let i = 1; i <= numReferees; i++) {
    workloads.set(i, {
      refereeId: i,
      name: refereeConfig.refereeNames?.[i] || `SR ${i}`,
      assignedMatches: 0,
      consecutiveMatches: 0,
      matchIds: [],
    });
  }

  // Count assignments (exclude skipped/finished matches for workload calculation)
  const activeMatches = matches
    .filter(m => m.matchStatus !== 'skipped' && m.matchStatus !== 'finished')
    .sort((a, b) => {
      const timeA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
      const timeB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
      return timeA - timeB;
    });

  for (const match of activeMatches) {
    if (match.referee) {
      const workload = workloads.get(match.referee);
      if (workload) {
        workload.assignedMatches++;
        workload.matchIds.push(match.id);
      }
    }
  }

  // Calculate consecutive matches
  for (const [, workload] of workloads) {
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let lastTime: number | null = null;

    for (const matchId of workload.matchIds) {
      const match = matches.find(m => m.id === matchId);
      if (!match?.scheduledTime) {continue;}

      const matchTime = new Date(match.scheduledTime).getTime();

      // Consider matches consecutive if within 30 minutes
      if (lastTime && matchTime - lastTime <= 30 * 60 * 1000) {
        currentConsecutive++;
      } else {
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        currentConsecutive = 1;
      }
      lastTime = matchTime;
    }

    workload.consecutiveMatches = Math.max(maxConsecutive, currentConsecutive);
  }

  return workloads;
}

/**
 * Find the best referee for a match based on workload and constraints
 */
function findBestReferee(
  match: Match,
  matches: Match[],
  refereeConfig: RefereeConfig,
  workloads: Map<number, RefereeWorkload>,
  excludeReferees: number[] = []
): number | null {
  const numReferees = refereeConfig.numberOfReferees ?? 0;
  if (numReferees === 0) {return null;}

  const maxConsecutive = refereeConfig.maxConsecutiveMatches ?? 2;
  const candidates: { id: number; score: number }[] = [];

  for (let refId = 1; refId <= numReferees; refId++) {
    if (excludeReferees.includes(refId)) {continue;}

    const workload = workloads.get(refId);
    if (!workload) {continue;}

    // Check for time conflicts
    const hasConflict = checkRefereeTimeConflict(refId, match, matches);
    if (hasConflict) {continue;}

    // Check consecutive match limit
    if (maxConsecutive > 0 && workload.consecutiveMatches >= maxConsecutive) {
      // Check if this would extend consecutive matches
      const wouldExtend = wouldExtendConsecutive(refId, match, matches);
      if (wouldExtend) {continue;}
    }

    // Calculate fairness score (lower is better)
    // Prefer referees with fewer matches
    let score = workload.assignedMatches * 10;

    // Slight penalty for higher consecutive count
    score += workload.consecutiveMatches;

    candidates.push({ id: refId, score });
  }

  if (candidates.length === 0) {return null;}

  // Sort by score (lower = better)
  candidates.sort((a, b) => a.score - b.score);

  return candidates[0].id;
}

/**
 * Check if a referee has a time conflict with a match
 */
function checkRefereeTimeConflict(
  refereeId: number,
  match: Match,
  allMatches: Match[]
): boolean {
  if (!match.scheduledTime) {return false;}

  const matchTime = new Date(match.scheduledTime).getTime();
  const matchDuration = 15 * 60 * 1000; // Assume 15 min matches

  for (const other of allMatches) {
    if (other.id === match.id) {continue;}
    if (other.referee !== refereeId) {continue;}
    if (other.matchStatus === 'skipped' || other.matchStatus === 'finished') {continue;}
    if (!other.scheduledTime) {continue;}

    const otherTime = new Date(other.scheduledTime).getTime();
    const otherEnd = otherTime + matchDuration;
    const matchEnd = matchTime + matchDuration;

    // Check for overlap
    if (matchTime < otherEnd && matchEnd > otherTime) {
      return true;
    }
  }

  return false;
}

/**
 * Check if assigning to this match would extend consecutive matches
 */
function wouldExtendConsecutive(
  refereeId: number,
  match: Match,
  allMatches: Match[]
): boolean {
  if (!match.scheduledTime) {return false;}

  const matchTime = new Date(match.scheduledTime).getTime();
  const threshold = 30 * 60 * 1000; // 30 minutes

  // Check if ref has a match within 30 min before or after
  for (const other of allMatches) {
    if (other.id === match.id) {continue;}
    if (other.referee !== refereeId) {continue;}
    if (other.matchStatus === 'skipped') {continue;}
    if (!other.scheduledTime) {continue;}

    const otherTime = new Date(other.scheduledTime).getTime();
    if (Math.abs(matchTime - otherTime) <= threshold) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Auto-Reassignment Functions
// ============================================================================

/**
 * Reassign referees for all matches that need them
 */
export function autoReassignReferees(
  matches: Match[],
  refereeConfig: RefereeConfig | undefined,
  options: ReassignmentOptions
): ReassignmentResult {
  if (!refereeConfig || refereeConfig.mode === 'none') {
    return {
      success: true,
      changes: [],
      unresolvedConflicts: [],
      message: 'Keine Schiedsrichter-Konfiguration vorhanden',
    };
  }

  const changes: MatchChange[] = [];
  const excludeMatchIds = new Set(options.excludeMatchIds ?? []);

  // Get matches that need referee assignment
  const matchesNeedingRef = matches.filter(m =>
    !excludeMatchIds.has(m.id) &&
    m.matchStatus !== 'skipped' &&
    m.matchStatus !== 'finished' &&
    (m.referee === undefined || options.target === 'all')
  );

  // Calculate current workloads
  const workloads = calculateRefereeWorkloads(matches, refereeConfig);

  // Assign referees
  for (const match of matchesNeedingRef) {
    const bestRef = findBestReferee(
      match,
      matches,
      refereeConfig,
      workloads
    );

    if (bestRef && bestRef !== match.referee) {
      changes.push({
        matchId: match.id,
        field: 'referee',
        oldValue: match.referee,
        newValue: bestRef,
        timestamp: Date.now(),
      });

      // Update workload for next iteration
      if (match.referee) {
        const oldWorkload = workloads.get(match.referee);
        if (oldWorkload) {
          oldWorkload.assignedMatches--;
          oldWorkload.matchIds = oldWorkload.matchIds.filter(id => id !== match.id);
        }
      }
      const newWorkload = workloads.get(bestRef);
      if (newWorkload) {
        newWorkload.assignedMatches++;
        newWorkload.matchIds.push(match.id);
      }
    }
  }

  // Check for remaining conflicts
  const updatedMatches = matches.map(m => {
    const change = changes.find(c => c.matchId === m.id && c.field === 'referee');
    if (change) {
      return { ...m, referee: change.newValue as number };
    }
    return m;
  });

  const remainingConflicts = detectAllConflicts(updatedMatches, [], {
    matchDurationMinutes: 10,
    minBreakMinutes: 5,
    checkRefereeConflicts: true,
    checkFieldConflicts: false,
  }).filter(c => c.type === 'referee_double_booking');

  return {
    success: remainingConflicts.length === 0,
    changes,
    unresolvedConflicts: remainingConflicts,
    message: changes.length > 0
      ? `${changes.length} Schiedsrichter-${changes.length === 1 ? 'Zuweisung' : 'Zuweisungen'} angepasst`
      : 'Keine Änderungen notwendig',
  };
}

/**
 * Redistribute referees after a match is skipped
 */
export function redistributeAfterSkip(
  matches: Match[],
  skippedMatchId: string,
  refereeConfig: RefereeConfig | undefined
): ReassignmentResult {
  if (!refereeConfig || refereeConfig.mode === 'none') {
    return {
      success: true,
      changes: [],
      unresolvedConflicts: [],
      message: 'Keine Umverteilung notwendig',
    };
  }

  // Find the skipped match
  const skippedMatch = matches.find(m => m.id === skippedMatchId);
  if (!skippedMatch?.referee) {
    return {
      success: true,
      changes: [],
      unresolvedConflicts: [],
      message: 'Keine Umverteilung notwendig',
    };
  }

  const freedReferee = skippedMatch.referee;
  const changes: MatchChange[] = [];

  // Find matches that could benefit from the freed referee
  const candidateMatches = matches.filter(m =>
    m.id !== skippedMatchId &&
    m.matchStatus !== 'skipped' &&
    m.matchStatus !== 'finished' &&
    !m.referee
  );

  // Assign freed referee to unassigned matches
  for (const match of candidateMatches) {
    // Check if freed referee is available for this match
    const hasConflict = checkRefereeTimeConflict(freedReferee, match, matches);
    if (!hasConflict) {
      changes.push({
        matchId: match.id,
        field: 'referee',
        oldValue: undefined,
        newValue: freedReferee,
        timestamp: Date.now(),
      });
      break; // Only assign one match per skip
    }
  }

  return {
    success: true,
    changes,
    unresolvedConflicts: [],
    message: changes.length > 0
      ? `SR ${freedReferee} zu Spiel ${changes[0].matchId.slice(-3)} zugewiesen`
      : 'Keine Umverteilung möglich',
  };
}

/**
 * Balance referee workloads across all matches
 */
export function balanceRefereeWorkloads(
  matches: Match[],
  refereeConfig: RefereeConfig | undefined
): ReassignmentResult {
  if (!refereeConfig || refereeConfig.mode === 'none' || !refereeConfig.numberOfReferees) {
    return {
      success: true,
      changes: [],
      unresolvedConflicts: [],
      message: 'Keine Schiedsrichter konfiguriert',
    };
  }

  const changes: MatchChange[] = [];
  const workloads = calculateRefereeWorkloads(matches, refereeConfig);

  // Calculate target workload
  const activeMatches = matches.filter(
    m => m.matchStatus !== 'skipped' && m.matchStatus !== 'finished'
  );
  const totalMatches = activeMatches.length;
  const numReferees = refereeConfig.numberOfReferees;
  const targetPerRef = Math.floor(totalMatches / numReferees);
  const remainder = totalMatches % numReferees;

  // Find overloaded and underloaded referees
  const overloaded: number[] = [];
  const underloaded: number[] = [];

  for (const [refId, workload] of workloads) {
    const targetForThisRef = targetPerRef + (refId <= remainder ? 1 : 0);
    if (workload.assignedMatches > targetForThisRef + 1) {
      overloaded.push(refId);
    } else if (workload.assignedMatches < targetForThisRef - 1) {
      underloaded.push(refId);
    }
  }

  // Transfer matches from overloaded to underloaded
  for (const overRef of overloaded) {
    const overWorkload = workloads.get(overRef)!;

    for (const underRef of underloaded) {
      if (overWorkload.assignedMatches <= targetPerRef) {break;}

      const underWorkload = workloads.get(underRef)!;
      if (underWorkload.assignedMatches >= targetPerRef) {continue;}

      // Find a match to transfer
      for (const matchId of [...overWorkload.matchIds]) {
        const match = matches.find(m => m.id === matchId);
        if (!match) {continue;}

        // Check if underloaded ref can take this match
        const hasConflict = checkRefereeTimeConflict(underRef, match, matches);
        if (hasConflict) {continue;}

        // Transfer
        changes.push({
          matchId: match.id,
          field: 'referee',
          oldValue: overRef,
          newValue: underRef,
          timestamp: Date.now(),
        });

        // Update workloads
        overWorkload.assignedMatches--;
        overWorkload.matchIds = overWorkload.matchIds.filter(id => id !== matchId);
        underWorkload.assignedMatches++;
        underWorkload.matchIds.push(matchId);

        break;
      }
    }
  }

  return {
    success: true,
    changes,
    unresolvedConflicts: [],
    message: changes.length > 0
      ? `${changes.length} Spiel${changes.length === 1 ? '' : 'e'} umverteilt für bessere Balance`
      : 'Auslastung bereits optimal',
  };
}

/**
 * Get referee workload statistics
 */
export function getRefereeStats(
  matches: Match[],
  refereeConfig: RefereeConfig | undefined
): { refereeId: number; name: string; count: number; percentage: number }[] {
  if (!refereeConfig || refereeConfig.mode === 'none' || !refereeConfig.numberOfReferees) {
    return [];
  }

  const workloads = calculateRefereeWorkloads(matches, refereeConfig);
  const activeMatches = matches.filter(
    m => m.matchStatus !== 'skipped' && m.matchStatus !== 'finished'
  ).length;

  const stats: { refereeId: number; name: string; count: number; percentage: number }[] = [];

  for (const [refId, workload] of workloads) {
    stats.push({
      refereeId: refId,
      name: workload.name,
      count: workload.assignedMatches,
      percentage: activeMatches > 0
        ? Math.round((workload.assignedMatches / activeMatches) * 100)
        : 0,
    });
  }

  return stats.sort((a, b) => a.refereeId - b.refereeId);
}

// ============================================================================
// Field Redistribution (keeps times, redistributes fields fairly)
// ============================================================================

/**
 * Redistribute fields across matches while keeping times fixed
 * Ensures fair distribution across available fields
 */
export function redistributeFields(
  matches: Match[],
  numberOfFields: number
): ReassignmentResult {
  if (numberOfFields <= 1) {
    return {
      success: true,
      changes: [],
      unresolvedConflicts: [],
      message: 'Nur ein Feld vorhanden - keine Verteilung nötig',
    };
  }

  const changes: MatchChange[] = [];

  // Group matches by time slot
  const matchesByTime = new Map<string, Match[]>();

  for (const match of matches) {
    if (match.matchStatus === 'skipped' || match.matchStatus === 'finished') {continue;}
    if (!match.scheduledTime) {continue;}

    const timeKey = new Date(match.scheduledTime).toISOString();
    const existing = matchesByTime.get(timeKey) || [];
    existing.push(match);
    matchesByTime.set(timeKey, existing);
  }

  // For each time slot, distribute matches across fields
  for (const [, matchesInSlot] of matchesByTime) {
    // Sort by original field to maintain some consistency
    matchesInSlot.sort((a, b) => (a.field ?? 1) - (b.field ?? 1));

    // Assign fields 1, 2, 3, ... in order
    matchesInSlot.forEach((match, index) => {
      const newField = (index % numberOfFields) + 1;
      if (match.field !== newField) {
        changes.push({
          matchId: match.id,
          field: 'field',
          oldValue: match.field,
          newValue: newField,
          timestamp: Date.now(),
        });
      }
    });
  }

  return {
    success: true,
    changes,
    unresolvedConflicts: [],
    message: changes.length > 0
      ? `${changes.length} Spiel${changes.length === 1 ? '' : 'e'} auf Felder verteilt`
      : 'Felder bereits optimal verteilt',
  };
}

/**
 * Redistribute both referees and fields while keeping times fixed
 */
export function redistributeAll(
  matches: Match[],
  refereeConfig: RefereeConfig | undefined,
  numberOfFields: number
): { refereeChanges: MatchChange[]; fieldChanges: MatchChange[]; message: string } {
  const refereeResult = autoReassignReferees(matches, refereeConfig, {
    target: 'all',
    optimizeForFairness: true,
  });

  const fieldResult = redistributeFields(matches, numberOfFields);

  return {
    refereeChanges: refereeResult.changes,
    fieldChanges: fieldResult.changes,
    message: `${refereeResult.changes.length} SR-Zuweisungen, ${fieldResult.changes.length} Feld-Zuweisungen angepasst`,
  };
}

export default {
  autoReassignReferees,
  redistributeAfterSkip,
  balanceRefereeWorkloads,
  getRefereeStats,
  redistributeFields,
  redistributeAll,
};
