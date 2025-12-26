/**
 * Tests for useMatchConflicts Hook
 *
 * Covers:
 * - Conflict detection
 * - Match conflict lookups
 * - Change validation
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMatchConflicts, useMatchConflictsFromTournament } from '../useMatchConflicts';
import { Match, Team, Tournament } from '../../../../types/tournament';

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

function createTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'test-tournament',
    name: 'Test Tournament',
    sportType: 'hallenfussball',
    tournamentType: 'group_only',
    systemType: 'round_robin',
    teams: [],
    matches: [],
    numberOfFields: 2,
    gameDuration: 10,
    breakDuration: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Tournament;
}

// ============================================================================
// useMatchConflicts Tests
// ============================================================================

describe('useMatchConflicts', () => {
  it('should return empty conflicts for empty match list', () => {
    const { result } = renderHook(() =>
      useMatchConflicts({
        matches: [],
        teams: [],
        matchDurationMinutes: 10,
      })
    );

    expect(result.current.conflicts).toHaveLength(0);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.hasWarnings).toBe(false);
  });

  it('should detect team double booking conflicts', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
      })
    );

    expect(result.current.conflicts.length).toBeGreaterThan(0);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.errorCount).toBeGreaterThan(0);
  });

  it('should provide O(1) lookup via conflictsByMatch', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm3',
        teamA: 'team-b',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T11:00:00'),
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
      })
    );

    // m1 and m2 have conflicts
    expect(result.current.conflictsByMatch.get('m1')?.length).toBeGreaterThan(0);
    expect(result.current.conflictsByMatch.get('m2')?.length).toBeGreaterThan(0);
    // m3 should have no conflicts
    expect(result.current.conflictsByMatch.get('m3')).toBeUndefined();
  });

  it('should provide getMatchConflicts helper', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
      })
    );

    const m1Conflicts = result.current.getMatchConflicts('m1');
    expect(m1Conflicts.length).toBeGreaterThan(0);

    const m3Conflicts = result.current.getMatchConflicts('m3');
    expect(m3Conflicts).toHaveLength(0);
  });

  it('should provide matchHasConflicts helper', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm3',
        teamA: 'team-b',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T11:00:00'),
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
      })
    );

    expect(result.current.matchHasConflicts('m1')).toBe(true);
    expect(result.current.matchHasConflicts('m2')).toBe(true);
    expect(result.current.matchHasConflicts('m3')).toBe(false);
  });

  it('should provide matchHasErrors helper', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    // Team double booking is an error, break violation is a warning
    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
      })
    );

    expect(result.current.matchHasErrors('m1')).toBe(true);
    expect(result.current.matchHasErrors('m2')).toBe(true);
  });

  it('should validate proposed changes', () => {
    const teams: Team[] = [];
    const matches = [
      createMatch({
        id: 'm1',
        field: 1,
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        field: 2,
        teamA: 'team-c',
        teamB: 'team-d',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
        checkFieldConflicts: true,
      })
    );

    // Changing m2 to field 1 should create field overlap conflict
    const conflicts = result.current.validateChange({
      matchId: 'm2',
      field: 'field',
      oldValue: 2,
      newValue: 1,
      timestamp: Date.now(),
    });

    expect(conflicts.length).toBeGreaterThan(0);
    // Find the field overlap conflict specifically
    const fieldConflict = conflicts.find(c => c.type === 'field_overlap');
    expect(fieldConflict).toBeDefined();
  });

  it('should respect enabled flag', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
        enabled: false,
      })
    );

    expect(result.current.conflicts).toHaveLength(0);
    expect(result.current.hasErrors).toBe(false);
  });

  it('should respect checkRefereeConflicts flag', () => {
    const matches = [
      createMatch({
        id: 'm1',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        field: 1,
      }),
      createMatch({
        id: 'm2',
        referee: 1,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        field: 2,
      }),
    ];

    const { result: resultWithCheck } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams: [],
        matchDurationMinutes: 10,
        checkRefereeConflicts: true,
      })
    );

    const refConflicts = resultWithCheck.current.conflicts.filter(
      c => c.type === 'referee_double_booking'
    );
    expect(refConflicts.length).toBeGreaterThan(0);

    const { result: resultWithoutCheck } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams: [],
        matchDurationMinutes: 10,
        checkRefereeConflicts: false,
      })
    );

    const noRefConflicts = resultWithoutCheck.current.conflicts.filter(
      c => c.type === 'referee_double_booking'
    );
    expect(noRefConflicts).toHaveLength(0);
  });

  it('should count errors and warnings separately', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    // Create scenario with both error (team double booking) and warning (break violation)
    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'), // Error: same time as m1 with same team
      }),
    ];

    const { result } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
        minBreakMinutes: 5,
      })
    );

    expect(result.current.errorCount).toBeGreaterThan(0);
    expect(result.current.hasErrors).toBe(true);
  });
});

// ============================================================================
// useMatchConflictsFromTournament Tests
// ============================================================================

describe('useMatchConflictsFromTournament', () => {
  it('should handle null tournament', () => {
    const { result } = renderHook(() =>
      useMatchConflictsFromTournament(null)
    );

    expect(result.current.conflicts).toHaveLength(0);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.getMatchConflicts('any')).toHaveLength(0);
    expect(result.current.matchHasConflicts('any')).toBe(false);
    expect(result.current.matchHasErrors('any')).toBe(false);
  });

  it('should work with tournament object', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const tournament = createTournament({
      teams,
      matches,
      gameDuration: 10,
      breakDuration: 2,
    });

    const { result } = renderHook(() =>
      useMatchConflictsFromTournament(tournament)
    );

    expect(result.current.conflicts.length).toBeGreaterThan(0);
    expect(result.current.hasErrors).toBe(true);
  });

  it('should respect enabled flag', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    const tournament = createTournament({
      teams,
      matches,
    });

    const { result } = renderHook(() =>
      useMatchConflictsFromTournament(tournament, false)
    );

    expect(result.current.conflicts).toHaveLength(0);
  });

  it('should use tournament game duration settings', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
      createTeam({ id: 'team-c', name: 'Team C' }),
    ];

    // With 5 min duration, these matches don't overlap
    const matches = [
      createMatch({
        id: 'm1',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-c',
        scheduledTime: new Date('2024-01-15T10:05:00'),
      }),
    ];

    const tournamentShort = createTournament({
      teams,
      matches,
      gameDuration: 5,
    });

    const { result: shortResult } = renderHook(() =>
      useMatchConflictsFromTournament(tournamentShort)
    );

    // With 5 min duration, m1 ends at 10:05, m2 starts at 10:05 - no overlap
    expect(shortResult.current.conflicts.filter(c => c.type === 'team_double_booking')).toHaveLength(0);

    const tournamentLong = createTournament({
      teams,
      matches,
      gameDuration: 10,
    });

    const { result: longResult } = renderHook(() =>
      useMatchConflictsFromTournament(tournamentLong)
    );

    // With 10 min duration, m1 ends at 10:10, m2 starts at 10:05 - overlap!
    expect(longResult.current.conflicts.filter(c => c.type === 'team_double_booking').length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Memoization Tests
// ============================================================================

describe('Memoization', () => {
  it('should not recalculate conflicts when inputs are the same', () => {
    const teams = [createTeam({ id: 'team-a', name: 'Team A' })];
    const matches = [createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-a' })];

    const { result, rerender } = renderHook(() =>
      useMatchConflicts({
        matches,
        teams,
        matchDurationMinutes: 10,
      })
    );

    const initialConflicts = result.current.conflicts;

    // Rerender with same props
    rerender();

    // Should be the same reference (memoized)
    expect(result.current.conflicts).toBe(initialConflicts);
  });

  it('should recalculate when matches change', () => {
    const teams = [
      createTeam({ id: 'team-a', name: 'Team A' }),
      createTeam({ id: 'team-b', name: 'Team B' }),
    ];

    let matches = [
      createMatch({ id: 'm1', teamA: 'team-a', teamB: 'team-b' }),
    ];

    const { result, rerender } = renderHook(
      ({ matches }) =>
        useMatchConflicts({
          matches,
          teams,
          matchDurationMinutes: 10,
        }),
      { initialProps: { matches } }
    );

    expect(result.current.conflicts).toHaveLength(0);

    // Add a conflicting match
    matches = [
      ...matches,
      createMatch({
        id: 'm2',
        teamA: 'team-a',
        teamB: 'team-b',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];

    rerender({ matches });

    // Should have detected new conflicts
    expect(result.current.conflicts.length).toBeGreaterThan(0);
  });
});
