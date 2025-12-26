/**
 * US-SCHEDULE-EDITOR: Schedule Conflict Detection Utilities
 *
 * Algorithms for detecting various types of scheduling conflicts:
 * - Team double booking
 * - Referee double booking
 * - Field overlap
 * - Break time violations
 */

import { Match, Team } from '../../../types/tournament';
import {
  ScheduleConflict,
  ConflictType,
  ConflictDetectionConfig,
  MatchChange,
} from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a date from various formats (Date object, ISO string, or undefined)
 */
function parseMatchTime(time: Date | string | undefined): Date | null {
  if (!time) {return null;}
  if (time instanceof Date) {return time;}
  return new Date(time);
}

/**
 * Add minutes to a date
 */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Check if two time ranges overlap
 */
function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Get minutes between two dates
 */
function getMinutesBetween(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (60 * 1000);
}

/**
 * Generate a unique conflict ID
 */
function generateConflictId(type: ConflictType, ...matchIds: string[]): string {
  return `${type}-${matchIds.sort().join('-')}`;
}

// ============================================================================
// Team Conflict Detection
// ============================================================================

/**
 * Detect conflicts where a team is scheduled to play in two matches at the same time
 */
export function detectTeamConflicts(
  matches: Match[],
  matchDurationMinutes: number,
  teams: Team[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const teamMap = new Map(teams.map(t => [t.id, t]));

  // Only check scheduled/running matches
  const activeMatches = matches.filter(
    m => m.matchStatus !== 'finished' && m.matchStatus !== 'skipped'
  );

  for (let i = 0; i < activeMatches.length; i++) {
    const match1 = activeMatches[i];
    const time1 = parseMatchTime(match1.scheduledTime);
    if (!time1) {continue;}

    const end1 = addMinutes(time1, matchDurationMinutes);

    for (let j = i + 1; j < activeMatches.length; j++) {
      const match2 = activeMatches[j];
      const time2 = parseMatchTime(match2.scheduledTime);
      if (!time2) {continue;}

      const end2 = addMinutes(time2, matchDurationMinutes);

      // Check if times overlap
      if (!doTimesOverlap(time1, end1, time2, end2)) {continue;}

      // Check for shared teams
      const sharedTeamIds = [match1.teamA, match1.teamB].filter(
        id => id === match2.teamA || id === match2.teamB
      );

      for (const teamId of sharedTeamIds) {
        const team = teamMap.get(teamId);
        conflicts.push({
          id: generateConflictId('team_double_booking', match1.id, match2.id, teamId),
          type: 'team_double_booking',
          severity: 'error',
          matchIds: [match1.id, match2.id],
          message: `Team "${team?.name || teamId}" hat zwei Spiele gleichzeitig`,
          suggestion: 'Eines der Spiele in einen anderen Zeitslot verschieben',
          context: {
            teamId,
            teamName: team?.name,
          },
        });
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Referee Conflict Detection
// ============================================================================

/**
 * Detect conflicts where a referee is assigned to two matches at the same time
 */
export function detectRefereeConflicts(
  matches: Match[],
  matchDurationMinutes: number
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Only check matches with referees assigned
  const matchesWithReferees = matches.filter(
    m =>
      m.referee !== undefined &&
      m.matchStatus !== 'finished' &&
      m.matchStatus !== 'skipped'
  );

  for (let i = 0; i < matchesWithReferees.length; i++) {
    const match1 = matchesWithReferees[i];
    const time1 = parseMatchTime(match1.scheduledTime);
    if (!time1) {continue;}

    const end1 = addMinutes(time1, matchDurationMinutes);

    for (let j = i + 1; j < matchesWithReferees.length; j++) {
      const match2 = matchesWithReferees[j];
      const time2 = parseMatchTime(match2.scheduledTime);
      if (!time2) {continue;}

      // Same referee?
      if (match1.referee !== match2.referee) {continue;}

      const end2 = addMinutes(time2, matchDurationMinutes);

      // Check if times overlap
      if (!doTimesOverlap(time1, end1, time2, end2)) {
        continue;
      }

      conflicts.push({
        id: generateConflictId('referee_double_booking', match1.id, match2.id),
        type: 'referee_double_booking',
        severity: 'error',
        matchIds: [match1.id, match2.id],
        message: `Schiedsrichter ${match1.referee} ist zwei Spielen gleichzeitig zugewiesen`,
        suggestion: 'Schiedsrichter für eines der Spiele ändern',
        context: {
          refereeId: match1.referee,
        },
      });
    }
  }

  return conflicts;
}

// ============================================================================
// Field Conflict Detection
// ============================================================================

/**
 * Detect conflicts where the same field has overlapping matches
 */
export function detectFieldOverlaps(
  matches: Match[],
  matchDurationMinutes: number
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Group matches by field
  const matchesByField = new Map<number, Match[]>();
  for (const match of matches) {
    if (match.matchStatus === 'finished' || match.matchStatus === 'skipped') {continue;}

    const existing = matchesByField.get(match.field) ?? [];
    existing.push(match);
    matchesByField.set(match.field, existing);
  }

  // Check each field for overlaps
  for (const [fieldId, fieldMatches] of matchesByField) {
    for (let i = 0; i < fieldMatches.length; i++) {
      const match1 = fieldMatches[i];
      const time1 = parseMatchTime(match1.scheduledTime);
      if (!time1) {continue;}

      const end1 = addMinutes(time1, matchDurationMinutes);

      for (let j = i + 1; j < fieldMatches.length; j++) {
        const match2 = fieldMatches[j];
        const time2 = parseMatchTime(match2.scheduledTime);
        if (!time2) {continue;}

        const end2 = addMinutes(time2, matchDurationMinutes);

        if (doTimesOverlap(time1, end1, time2, end2)) {
          conflicts.push({
            id: generateConflictId('field_overlap', match1.id, match2.id),
            type: 'field_overlap',
            severity: 'error',
            matchIds: [match1.id, match2.id],
            message: `Feld ${fieldId} hat zwei überlappende Spiele`,
            suggestion: 'Eines der Spiele auf ein anderes Feld oder in anderen Zeitslot verschieben',
            context: {
              fieldId,
            },
          });
        }
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Break Time Violation Detection
// ============================================================================

/**
 * Detect conflicts where a team doesn't have enough break time between matches
 */
export function detectBreakViolations(
  matches: Match[],
  teams: Team[],
  matchDurationMinutes: number,
  minBreakMinutes: number
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const teamMap = new Map(teams.map(t => [t.id, t]));

  // Group matches by team
  const matchesByTeam = new Map<string, Match[]>();

  for (const match of matches) {
    if (match.matchStatus === 'finished' || match.matchStatus === 'skipped') {continue;}

    for (const teamId of [match.teamA, match.teamB]) {
      const existing = matchesByTeam.get(teamId) ?? [];
      existing.push(match);
      matchesByTeam.set(teamId, existing);
    }
  }

  // Check each team's matches for break violations
  for (const [teamId, teamMatches] of matchesByTeam) {
    // Sort by scheduled time
    const sortedMatches = [...teamMatches].sort((a, b) => {
      const timeA = parseMatchTime(a.scheduledTime);
      const timeB = parseMatchTime(b.scheduledTime);
      if (!timeA || !timeB) {return 0;}
      return timeA.getTime() - timeB.getTime();
    });

    for (let i = 0; i < sortedMatches.length - 1; i++) {
      const match1 = sortedMatches[i];
      const match2 = sortedMatches[i + 1];

      const time1 = parseMatchTime(match1.scheduledTime);
      const time2 = parseMatchTime(match2.scheduledTime);
      if (!time1 || !time2) {continue;}

      const end1 = addMinutes(time1, matchDurationMinutes);
      const breakMinutes = getMinutesBetween(end1, time2);

      if (breakMinutes < minBreakMinutes && time2 > end1) {
        const team = teamMap.get(teamId);
        conflicts.push({
          id: generateConflictId('break_violation', match1.id, match2.id, teamId),
          type: 'break_violation',
          severity: 'warning',
          matchIds: [match1.id, match2.id],
          message: `Team "${team?.name || teamId}" hat nur ${Math.round(breakMinutes)} Min. Pause (min. ${minBreakMinutes} erforderlich)`,
          suggestion: 'Mehr Zeit zwischen den Spielen einplanen',
          context: {
            teamId,
            teamName: team?.name,
            requiredBreakMinutes: minBreakMinutes,
            actualBreakMinutes: Math.round(breakMinutes),
          },
        });
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect all schedule conflicts
 */
export function detectAllConflicts(
  matches: Match[],
  teams: Team[],
  config: ConflictDetectionConfig
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Team double booking (always check)
  conflicts.push(
    ...detectTeamConflicts(matches, config.matchDurationMinutes, teams)
  );

  // Referee conflicts
  if (config.checkRefereeConflicts) {
    conflicts.push(
      ...detectRefereeConflicts(matches, config.matchDurationMinutes)
    );
  }

  // Field overlaps
  if (config.checkFieldConflicts) {
    conflicts.push(
      ...detectFieldOverlaps(matches, config.matchDurationMinutes)
    );
  }

  // Break violations
  conflicts.push(
    ...detectBreakViolations(
      matches,
      teams,
      config.matchDurationMinutes,
      config.minBreakMinutes
    )
  );

  return conflicts;
}

// ============================================================================
// Change Validation
// ============================================================================

/**
 * Validate a proposed match change before applying it
 * Returns conflicts that would result from the change
 */
export function validateMatchChange(
  matches: Match[],
  teams: Team[],
  change: MatchChange,
  config: ConflictDetectionConfig
): ScheduleConflict[] {
  // Create a copy of matches with the proposed change applied
  const updatedMatches = matches.map(m => {
    if (m.id !== change.matchId) {return m;}
    return { ...m, [change.field]: change.newValue };
  });

  // Detect conflicts in the updated schedule
  const newConflicts = detectAllConflicts(updatedMatches, teams, config);

  // Filter to only conflicts involving the changed match
  return newConflicts.filter(c => c.matchIds.includes(change.matchId));
}

/**
 * Get conflicts for a specific match
 */
export function getConflictsForMatch(
  conflicts: ScheduleConflict[],
  matchId: string
): ScheduleConflict[] {
  return conflicts.filter(c => c.matchIds.includes(matchId));
}

/**
 * Check if schedule has any blocking errors (severity: 'error')
 */
export function hasBlockingConflicts(conflicts: ScheduleConflict[]): boolean {
  return conflicts.some(c => c.severity === 'error');
}

/**
 * Group conflicts by type for display
 */
export function groupConflictsByType(
  conflicts: ScheduleConflict[]
): Map<ConflictType, ScheduleConflict[]> {
  const grouped = new Map<ConflictType, ScheduleConflict[]>();

  for (const conflict of conflicts) {
    const existing = grouped.get(conflict.type) ?? [];
    existing.push(conflict);
    grouped.set(conflict.type, existing);
  }

  return grouped;
}

/**
 * Get human-readable conflict type label
 */
export function getConflictTypeLabel(type: ConflictType): string {
  switch (type) {
    case 'team_double_booking':
      return 'Team-Doppelbelegung';
    case 'referee_double_booking':
      return 'SR-Doppelbelegung';
    case 'field_overlap':
      return 'Feld-Überschneidung';
    case 'break_violation':
      return 'Pausenzeit-Verletzung';
    case 'dependency_violation':
      return 'Abhängigkeits-Verletzung';
    default:
      return 'Unbekannter Konflikt';
  }
}
