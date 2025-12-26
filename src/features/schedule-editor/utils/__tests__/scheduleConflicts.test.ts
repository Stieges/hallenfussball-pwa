/**
 * Tests for Schedule Conflict Detection Utilities
 *
 * Covers:
 * - Team double booking detection
 * - Referee double booking detection
 * - Field overlap detection
 * - Break time violation detection
 * - Edge cases and boundary conditions
 */

import { describe, it, expect } from 'vitest';
import {
  detectTeamConflicts,
  detectRefereeConflicts,
  detectFieldOverlaps,
  detectBreakViolations,
  detectAllConflicts,
  validateMatchChange,
  getConflictsForMatch,
  hasBlockingConflicts,
  groupConflictsByType,
  getConflictTypeLabel,
} from '../scheduleConflicts';
import { Match, Team } from '../../../../types/tournament';

// ============================================================================
// Test Helpers
// ============================================================================

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: `match-${Math.random().toString(36).slice(2, 7)}`,
    round: 1,
    field: 1,
    teamA: 'team-a',
    teamB: 'team-b',
    scheduledTime: new Date('2024-01-15T10:00:00'),
    matchStatus: 'scheduled',
    ...overrides,
  };
}

function createTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: `team-${Math.random().toString(36).slice(2, 7)}`,
    name: `Team ${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    group: 'A',
    ...overrides,
  };
}

// ============================================================================
// Team Conflict Detection Tests
// ============================================================================

describe('detectTeamConflicts', () => {
  const matchDuration = 10; // 10 minutes

  it('should detect no conflicts when teams have no overlapping matches', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
      createTeam({ id: 'team-d', name: 'Team D' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-c',
        teamB: 'team-d',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectTeamConflicts(matches, matchDuration, teams);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect conflict when same team plays in two overlapping matches', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:05:00'), // Overlaps (within 10 min)
      }),
    ];

    const conflicts = detectTeamConflicts(matches, matchDuration, teams);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('team_double_booking');
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].matchIds).toContain('match-1');
    expect(conflicts[0].matchIds).toContain('match-2');
    expect(conflicts[0].message).toContain('Team A');
  });

  it('should not detect conflict when matches are sequential (no overlap)', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:10:00'), // Starts exactly when match-1 ends
      }),
    ];

    const conflicts = detectTeamConflicts(matches, matchDuration, teams);
    expect(conflicts).toHaveLength(0);
  });

  it('should ignore finished matches', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
        matchStatus: 'finished',
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectTeamConflicts(matches, matchDuration, teams);
    expect(conflicts).toHaveLength(0);
  });

  it('should ignore skipped matches', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
        matchStatus: 'skipped',
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectTeamConflicts(matches, matchDuration, teams);
    expect(conflicts).toHaveLength(0);
  });

  it('should handle matches without scheduled time', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: undefined,
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectTeamConflicts(matches, matchDuration, teams);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect multiple conflicts when team is triple-booked', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
      createTeam({ id: 'team-d', name: 'Team D' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-3',
        teamA: 'team-a',
        teamB: 'team-d',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectTeamConflicts(matches, matchDuration, teams);
    // 3 pairs: match-1/match-2, match-1/match-3, match-2/match-3
    expect(conflicts).toHaveLength(3);
  });
});

// ============================================================================
// Referee Conflict Detection Tests
// ============================================================================

describe('detectRefereeConflicts', () => {
  const matchDuration = 10;

  it('should detect no conflicts when referees have no overlapping matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        referee: 2,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectRefereeConflicts(matches, matchDuration);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect conflict when same referee is assigned to overlapping matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:05:00'),
      }),
    ];

    const conflicts = detectRefereeConflicts(matches, matchDuration);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('referee_double_booking');
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].message).toContain('Schiedsrichter 1');
  });

  it('should not detect conflict when same referee has sequential matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:10:00'),
      }),
    ];

    const conflicts = detectRefereeConflicts(matches, matchDuration);
    expect(conflicts).toHaveLength(0);
  });

  it('should ignore matches without referee assignment', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        referee: undefined,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        referee: undefined,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectRefereeConflicts(matches, matchDuration);
    expect(conflicts).toHaveLength(0);
  });

  it('should ignore finished and skipped matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        matchStatus: 'finished',
      }),
      createMatch({
        id: 'match-2',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        matchStatus: 'scheduled',
      }),
    ];

    const conflicts = detectRefereeConflicts(matches, matchDuration);
    expect(conflicts).toHaveLength(0);
  });
});

// ============================================================================
// Field Overlap Detection Tests
// ============================================================================

describe('detectFieldOverlaps', () => {
  const matchDuration = 10;

  it('should detect no conflicts when fields have no overlapping matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        field: 2,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectFieldOverlaps(matches, matchDuration);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect conflict when same field has overlapping matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:05:00'),
      }),
    ];

    const conflicts = detectFieldOverlaps(matches, matchDuration);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('field_overlap');
    expect(conflicts[0].severity).toBe('error');
    expect(conflicts[0].message).toContain('Feld 1');
  });

  it('should not detect conflict when same field has sequential matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:10:00'),
      }),
    ];

    const conflicts = detectFieldOverlaps(matches, matchDuration);
    expect(conflicts).toHaveLength(0);
  });

  it('should ignore finished and skipped matches', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        matchStatus: 'finished',
      }),
      createMatch({
        id: 'match-2',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        matchStatus: 'scheduled',
      }),
    ];

    const conflicts = detectFieldOverlaps(matches, matchDuration);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect multiple overlaps on same field', () => {
    const matches = [
      createMatch({
        id: 'match-1',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-3',
        field: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const conflicts = detectFieldOverlaps(matches, matchDuration);
    expect(conflicts).toHaveLength(3); // 3 pairs
  });
});

// ============================================================================
// Break Violation Detection Tests
// ============================================================================

describe('detectBreakViolations', () => {
  const matchDuration = 10;
  const minBreak = 5;

  it('should detect no violations when teams have sufficient break time', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:15:00'), // 5 min break after 10 min match
      }),
    ];

    const conflicts = detectBreakViolations(matches, teams, matchDuration, minBreak);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect violation when team has insufficient break time', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:12:00'), // Only 2 min break
      }),
    ];

    const conflicts = detectBreakViolations(matches, teams, matchDuration, minBreak);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('break_violation');
    expect(conflicts[0].severity).toBe('warning');
    expect(conflicts[0].message).toContain('Team A');
    expect(conflicts[0].message).toContain('2 Min.');
  });

  it('should ignore finished and skipped matches', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
        matchStatus: 'finished',
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:12:00'),
        matchStatus: 'scheduled',
      }),
    ];

    const conflicts = detectBreakViolations(matches, teams, matchDuration, minBreak);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect violations for multiple teams', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
      createTeam({ id: 'team-d', name: 'Team D' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:12:00'), // Violation for team-a
      }),
      createMatch({
        id: 'match-3',
        teamA: 'team-b',
        teamB: 'team-d',
        scheduledTime: new Date('2024-01-15T10:12:00'), // Violation for team-b
      }),
    ];

    const conflicts = detectBreakViolations(matches, teams, matchDuration, minBreak);
    expect(conflicts).toHaveLength(2);
  });
});

// ============================================================================
// Full Detection Tests
// ============================================================================

describe('detectAllConflicts', () => {
  it('should detect all conflict types when present', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        field: 1,
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a', // Same team as match-1
        teamB: 'team-c',
        field: 1, // Same field as match-1
        referee: 1, // Same referee as match-1
        scheduledTime: new Date('2024-01-15T10:00:00'), // Same time
      }),
    ];

    const config = {
      matchDurationMinutes: 10,
      minBreakMinutes: 5,
      checkRefereeConflicts: true,
      checkFieldConflicts: true,
    };

    const conflicts = detectAllConflicts(matches, teams, config);

    const types = new Set(conflicts.map(c => c.type));
    expect(types.has('team_double_booking')).toBe(true);
    expect(types.has('referee_double_booking')).toBe(true);
    expect(types.has('field_overlap')).toBe(true);
  });

  it('should respect config flags for referee/field checks', () => {
    const teams: Team[] = [];
    const matches = [
      createMatch({
        id: 'match-1',
        field: 1,
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        field: 1,
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const configNoChecks = {
      matchDurationMinutes: 10,
      minBreakMinutes: 5,
      checkRefereeConflicts: false,
      checkFieldConflicts: false,
    };

    const conflictsNoChecks = detectAllConflicts(matches, teams, configNoChecks);
    expect(conflictsNoChecks.filter(c => c.type === 'referee_double_booking')).toHaveLength(0);
    expect(conflictsNoChecks.filter(c => c.type === 'field_overlap')).toHaveLength(0);

    const configWithChecks = {
      matchDurationMinutes: 10,
      minBreakMinutes: 5,
      checkRefereeConflicts: true,
      checkFieldConflicts: true,
    };

    const conflictsWithChecks = detectAllConflicts(matches, teams, configWithChecks);
    expect(conflictsWithChecks.filter(c => c.type === 'referee_double_booking')).toHaveLength(1);
    expect(conflictsWithChecks.filter(c => c.type === 'field_overlap')).toHaveLength(1);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('validateMatchChange', () => {
  it('should detect conflicts that would result from a field change', () => {
    const teams: Team[] = [];
    const matches = [
      createMatch({
        id: 'match-1',
        field: 1,
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        field: 2,
        teamA: 'team-c',
        teamB: 'team-d',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const config = {
      matchDurationMinutes: 10,
      minBreakMinutes: 5,
      checkRefereeConflicts: true,
      checkFieldConflicts: true,
    };

    // Changing match-2 to field 1 should create field overlap conflict
    const conflicts = validateMatchChange(matches, teams, {
      matchId: 'match-2',
      field: 'field',
      oldValue: 2,
      newValue: 1,
      timestamp: Date.now(),
    }, config);

    expect(conflicts.length).toBeGreaterThan(0);
    // Find the field overlap conflict specifically
    const fieldConflict = conflicts.find(c => c.type === 'field_overlap');
    expect(fieldConflict).toBeDefined();
    expect(fieldConflict!.type).toBe('field_overlap');
  });
});

describe('getConflictsForMatch', () => {
  it('should return only conflicts involving the specified match', () => {
    const conflicts = [
      { id: 'c1', type: 'team_double_booking' as const, severity: 'error' as const, matchIds: ['m1', 'm2'], message: '' },
      { id: 'c2', type: 'field_overlap' as const, severity: 'error' as const, matchIds: ['m2', 'm3'], message: '' },
      { id: 'c3', type: 'break_violation' as const, severity: 'warning' as const, matchIds: ['m3', 'm4'], message: '' },
    ];

    const m2Conflicts = getConflictsForMatch(conflicts, 'm2');
    expect(m2Conflicts).toHaveLength(2);
    expect(m2Conflicts.map(c => c.id)).toContain('c1');
    expect(m2Conflicts.map(c => c.id)).toContain('c2');
  });
});

describe('hasBlockingConflicts', () => {
  it('should return true when there are error severity conflicts', () => {
    const conflicts = [
      { id: 'c1', type: 'team_double_booking' as const, severity: 'error' as const, matchIds: [], message: '' },
    ];
    expect(hasBlockingConflicts(conflicts)).toBe(true);
  });

  it('should return false when only warnings exist', () => {
    const conflicts = [
      { id: 'c1', type: 'break_violation' as const, severity: 'warning' as const, matchIds: [], message: '' },
    ];
    expect(hasBlockingConflicts(conflicts)).toBe(false);
  });

  it('should return false for empty conflict list', () => {
    expect(hasBlockingConflicts([])).toBe(false);
  });
});

describe('groupConflictsByType', () => {
  it('should group conflicts by their type', () => {
    const conflicts = [
      { id: 'c1', type: 'team_double_booking' as const, severity: 'error' as const, matchIds: [], message: '' },
      { id: 'c2', type: 'team_double_booking' as const, severity: 'error' as const, matchIds: [], message: '' },
      { id: 'c3', type: 'field_overlap' as const, severity: 'error' as const, matchIds: [], message: '' },
    ];

    const grouped = groupConflictsByType(conflicts);
    expect(grouped.get('team_double_booking')).toHaveLength(2);
    expect(grouped.get('field_overlap')).toHaveLength(1);
  });
});

describe('getConflictTypeLabel', () => {
  it('should return German labels for all conflict types', () => {
    expect(getConflictTypeLabel('team_double_booking')).toBe('Team-Doppelbelegung');
    expect(getConflictTypeLabel('referee_double_booking')).toBe('SR-Doppelbelegung');
    expect(getConflictTypeLabel('field_overlap')).toBe('Feld-Überschneidung');
    expect(getConflictTypeLabel('break_violation')).toBe('Pausenzeit-Verletzung');
    expect(getConflictTypeLabel('dependency_violation')).toBe('Abhängigkeits-Verletzung');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty match list', () => {
    const conflicts = detectAllConflicts([], [], {
      matchDurationMinutes: 10,
      minBreakMinutes: 5,
      checkRefereeConflicts: true,
      checkFieldConflicts: true,
    });
    expect(conflicts).toHaveLength(0);
  });

  it('should handle single match', () => {
    const matches = [createMatch()];
    const conflicts = detectAllConflicts(matches, [], {
      matchDurationMinutes: 10,
      minBreakMinutes: 5,
      checkRefereeConflicts: true,
      checkFieldConflicts: true,
    });
    expect(conflicts).toHaveLength(0);
  });

  it('should handle matches at midnight boundary', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T23:55:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-16T00:00:00'), // Next day
      }),
    ];

    // With 10 min match duration, these overlap
    const conflicts = detectTeamConflicts(matches, 10, teams);
    expect(conflicts).toHaveLength(1);
  });

  it('should handle ISO date strings', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: '2024-01-15T10:00:00.000Z' as unknown as Date,
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: '2024-01-15T10:05:00.000Z' as unknown as Date,
      }),
    ];

    const conflicts = detectTeamConflicts(matches, 10, teams);
    expect(conflicts).toHaveLength(1);
  });

  it('should handle very long match duration', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'match-1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'match-2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T11:00:00'),
      }),
    ];

    // With 120 min match duration, these overlap
    const conflicts = detectTeamConflicts(matches, 120, teams);
    expect(conflicts).toHaveLength(1);
  });
});
