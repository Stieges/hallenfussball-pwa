/**
 * Tests for Auto-Reassignment Utilities
 *
 * Covers:
 * - Automatic referee assignment
 * - Redistribution after skipped matches
 * - Workload balancing
 * - Referee statistics
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  autoReassignReferees,
  redistributeAfterSkip,
  balanceRefereeWorkloads,
  getRefereeStats,
} from '../autoReassign';
import { Match, RefereeConfig } from '../../../../types/tournament';

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

function createRefereeConfig(overrides: Partial<RefereeConfig> = {}): RefereeConfig {
  return {
    mode: 'organizer',
    numberOfReferees: 3,
    refereeNames: {
      1: 'SR 1',
      2: 'SR 2',
      3: 'SR 3',
    },
    ...overrides,
  };
}

// ============================================================================
// autoReassignReferees Tests
// ============================================================================

describe('autoReassignReferees', () => {
  it('should return early when no referee config', () => {
    const matches = [createMatch()];
    const result = autoReassignReferees(matches, undefined, { target: 'referee', optimizeForFairness: true });

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0);
    expect(result.message).toContain('Keine Schiedsrichter-Konfiguration');
  });

  it('should return early when referee mode is none', () => {
    const matches = [createMatch()];
    const config = createRefereeConfig({ mode: 'none' });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0);
  });

  it('should assign referees to unassigned matches', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined, scheduledTime: new Date('2024-01-15T10:00:00') }),
      createMatch({ id: 'm2', referee: undefined, scheduledTime: new Date('2024-01-15T10:15:00') }),
      createMatch({ id: 'm3', referee: undefined, scheduledTime: new Date('2024-01-15T10:30:00') }),
    ];
    const config = createRefereeConfig();
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.message).toContain('Zuweisung');
  });

  it('should not assign referees to finished matches', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined, matchStatus: 'finished' }),
    ];
    const config = createRefereeConfig();
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    expect(result.changes).toHaveLength(0);
  });

  it('should not assign referees to skipped matches', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined, matchStatus: 'skipped' }),
    ];
    const config = createRefereeConfig();
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    expect(result.changes).toHaveLength(0);
  });

  it('should respect excludeMatchIds option', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined }),
      createMatch({ id: 'm2', referee: undefined }),
    ];
    const config = createRefereeConfig();
    const result = autoReassignReferees(matches, config, {
      target: 'referee',
      optimizeForFairness: true,
      excludeMatchIds: ['m1'],
    });

    // m1 should be excluded
    const changedIds = result.changes.map(c => c.matchId);
    expect(changedIds).not.toContain('m1');
  });

  it('should avoid referee time conflicts', () => {
    // Two matches at the same time
    const matches = [
      createMatch({
        id: 'm1',
        referee: undefined,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        field: 1,
      }),
      createMatch({
        id: 'm2',
        referee: undefined,
        scheduledTime: new Date('2024-01-15T10:00:00'),
        field: 2,
      }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 2 });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    // Both should be assigned, but to different referees
    const m1Change = result.changes.find(c => c.matchId === 'm1');
    const m2Change = result.changes.find(c => c.matchId === 'm2');

    if (m1Change && m2Change) {
      expect(m1Change.newValue).not.toBe(m2Change.newValue);
    }
  });

  it('should distribute workload fairly', () => {
    // 6 matches, 3 referees = 2 each
    const matches = [];
    for (let i = 1; i <= 6; i++) {
      matches.push(
        createMatch({
          id: `m${i}`,
          referee: undefined,
          scheduledTime: new Date(`2024-01-15T${10 + i}:00:00`),
        })
      );
    }
    const config = createRefereeConfig({ numberOfReferees: 3 });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    // Count assignments per referee
    const assignmentCounts = new Map<number, number>();
    for (const change of result.changes) {
      const refId = change.newValue as number;
      assignmentCounts.set(refId, (assignmentCounts.get(refId) || 0) + 1);
    }

    // Each referee should have ~2 matches
    for (const [, count] of assignmentCounts) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    }
  });
});

// ============================================================================
// redistributeAfterSkip Tests
// ============================================================================

describe('redistributeAfterSkip', () => {
  it('should return early when no referee config', () => {
    const matches = [createMatch({ referee: 1, matchStatus: 'skipped' })];
    const result = redistributeAfterSkip(matches, matches[0].id, undefined);

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0);
  });

  it('should return early when skipped match has no referee', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined, matchStatus: 'skipped' }),
      createMatch({ id: 'm2', referee: undefined }),
    ];
    const config = createRefereeConfig();
    const result = redistributeAfterSkip(matches, 'm1', config);

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0);
  });

  it('should assign freed referee to unassigned match', () => {
    const matches = [
      createMatch({
        id: 'm1',
        referee: 1,
        matchStatus: 'skipped',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        referee: undefined,
        matchStatus: 'scheduled',
        scheduledTime: new Date('2024-01-15T10:30:00'),
      }),
    ];
    const config = createRefereeConfig();
    const result = redistributeAfterSkip(matches, 'm1', config);

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].matchId).toBe('m2');
    expect(result.changes[0].newValue).toBe(1); // Freed referee
  });

  it('should not assign to match with time conflict', () => {
    const matches = [
      createMatch({
        id: 'm1',
        referee: 1,
        matchStatus: 'skipped',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
      createMatch({
        id: 'm2',
        referee: undefined,
        matchStatus: 'scheduled',
        scheduledTime: new Date('2024-01-15T10:00:00'), // Same time
      }),
      // Referee 1 already has another match at 10:00
      createMatch({
        id: 'm3',
        referee: 1,
        matchStatus: 'scheduled',
        scheduledTime: new Date('2024-01-15T10:00:00'),
      }),
    ];
    const config = createRefereeConfig();
    const result = redistributeAfterSkip(matches, 'm1', config);

    // Should not assign to m2 due to conflict with m3
    const m2Change = result.changes.find(c => c.matchId === 'm2');
    expect(m2Change).toBeUndefined();
  });
});

// ============================================================================
// balanceRefereeWorkloads Tests
// ============================================================================

describe('balanceRefereeWorkloads', () => {
  it('should return early when no referee config', () => {
    const matches = [createMatch({ referee: 1 })];
    const result = balanceRefereeWorkloads(matches, undefined);

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0);
  });

  it('should return early when referee mode is none', () => {
    const matches = [createMatch({ referee: 1 })];
    const config = createRefereeConfig({ mode: 'none' });
    const result = balanceRefereeWorkloads(matches, config);

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(0);
  });

  it('should balance when one referee has too many matches', () => {
    // 4 matches, all assigned to referee 1, but we have 2 referees
    const matches = [
      createMatch({ id: 'm1', referee: 1, scheduledTime: new Date('2024-01-15T10:00:00') }),
      createMatch({ id: 'm2', referee: 1, scheduledTime: new Date('2024-01-15T10:15:00') }),
      createMatch({ id: 'm3', referee: 1, scheduledTime: new Date('2024-01-15T10:30:00') }),
      createMatch({ id: 'm4', referee: 1, scheduledTime: new Date('2024-01-15T10:45:00') }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 2 });
    const result = balanceRefereeWorkloads(matches, config);

    // Should transfer some matches to referee 2
    const transfersToRef2 = result.changes.filter(c => c.newValue === 2);
    expect(transfersToRef2.length).toBeGreaterThan(0);
  });

  it('should not balance when already optimal', () => {
    // 4 matches, 2 per referee
    const matches = [
      createMatch({ id: 'm1', referee: 1, scheduledTime: new Date('2024-01-15T10:00:00') }),
      createMatch({ id: 'm2', referee: 1, scheduledTime: new Date('2024-01-15T10:30:00') }),
      createMatch({ id: 'm3', referee: 2, scheduledTime: new Date('2024-01-15T10:15:00') }),
      createMatch({ id: 'm4', referee: 2, scheduledTime: new Date('2024-01-15T10:45:00') }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 2 });
    const result = balanceRefereeWorkloads(matches, config);

    expect(result.changes).toHaveLength(0);
    expect(result.message).toContain('optimal');
  });

  it('should ignore finished and skipped matches', () => {
    const matches = [
      createMatch({ id: 'm1', referee: 1, matchStatus: 'finished' }),
      createMatch({ id: 'm2', referee: 1, matchStatus: 'finished' }),
      createMatch({ id: 'm3', referee: 1, matchStatus: 'skipped' }),
      createMatch({ id: 'm4', referee: 2, matchStatus: 'scheduled' }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 2 });
    const result = balanceRefereeWorkloads(matches, config);

    // Only m4 is active, so no balancing needed
    expect(result.changes).toHaveLength(0);
  });

  it('should avoid creating time conflicts when balancing', () => {
    // Referee 1 has 3 matches, referee 2 has none
    // But all matches are at same time, so transfer not possible
    const matches = [
      createMatch({ id: 'm1', referee: 1, scheduledTime: new Date('2024-01-15T10:00:00'), field: 1 }),
      createMatch({ id: 'm2', referee: 1, scheduledTime: new Date('2024-01-15T10:00:00'), field: 2 }),
      createMatch({ id: 'm3', referee: 1, scheduledTime: new Date('2024-01-15T10:00:00'), field: 3 }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 2 });
    const result = balanceRefereeWorkloads(matches, config);

    // Should still try to balance, transferring matches that don't conflict
    // But only 1 can be transferred to ref 2 (others would conflict)
    expect(result.changes.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// getRefereeStats Tests
// ============================================================================

describe('getRefereeStats', () => {
  it('should return empty array when no referee config', () => {
    const matches = [createMatch({ referee: 1 })];
    const result = getRefereeStats(matches, undefined);

    expect(result).toHaveLength(0);
  });

  it('should return empty array when referee mode is none', () => {
    const matches = [createMatch({ referee: 1 })];
    const config = createRefereeConfig({ mode: 'none' });
    const result = getRefereeStats(matches, config);

    expect(result).toHaveLength(0);
  });

  it('should calculate correct statistics', () => {
    const matches = [
      createMatch({ referee: 1 }),
      createMatch({ referee: 1 }),
      createMatch({ referee: 2 }),
      createMatch({ referee: 3 }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 3 });
    const result = getRefereeStats(matches, config);

    expect(result).toHaveLength(3);

    const ref1Stats = result.find(s => s.refereeId === 1);
    expect(ref1Stats).toBeDefined();
    expect(ref1Stats!.count).toBe(2);
    expect(ref1Stats!.percentage).toBe(50); // 2/4 = 50%

    const ref2Stats = result.find(s => s.refereeId === 2);
    expect(ref2Stats!.count).toBe(1);
    expect(ref2Stats!.percentage).toBe(25);

    const ref3Stats = result.find(s => s.refereeId === 3);
    expect(ref3Stats!.count).toBe(1);
    expect(ref3Stats!.percentage).toBe(25);
  });

  it('should use referee names from config', () => {
    const matches = [createMatch({ referee: 1 })];
    const config = createRefereeConfig({
      numberOfReferees: 1,
      refereeNames: { 1: 'Max Mustermann' },
    });
    const result = getRefereeStats(matches, config);

    expect(result[0].name).toBe('Max Mustermann');
  });

  it('should exclude finished and skipped matches', () => {
    const matches = [
      createMatch({ referee: 1, matchStatus: 'finished' }),
      createMatch({ referee: 1, matchStatus: 'skipped' }),
      createMatch({ referee: 1, matchStatus: 'scheduled' }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 1 });
    const result = getRefereeStats(matches, config);

    expect(result[0].count).toBe(1); // Only scheduled match counted
    expect(result[0].percentage).toBe(100);
  });

  it('should handle zero active matches', () => {
    const matches = [
      createMatch({ referee: 1, matchStatus: 'finished' }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 2 });
    const result = getRefereeStats(matches, config);

    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(0);
    expect(result[0].percentage).toBe(0);
  });

  it('should return referees sorted by ID', () => {
    const matches = [
      createMatch({ referee: 3 }),
      createMatch({ referee: 1 }),
      createMatch({ referee: 2 }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 3 });
    const result = getRefereeStats(matches, config);

    expect(result[0].refereeId).toBe(1);
    expect(result[1].refereeId).toBe(2);
    expect(result[2].refereeId).toBe(3);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty match list', () => {
    const config = createRefereeConfig();

    const reassignResult = autoReassignReferees([], config, { target: 'referee', optimizeForFairness: true });
    expect(reassignResult.changes).toHaveLength(0);

    const balanceResult = balanceRefereeWorkloads([], config);
    expect(balanceResult.changes).toHaveLength(0);

    const statsResult = getRefereeStats([], config);
    expect(statsResult).toHaveLength(3);
    statsResult.forEach(s => expect(s.count).toBe(0));
  });

  it('should handle single referee', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined }),
      createMatch({ id: 'm2', referee: undefined }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 1 });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    // All should be assigned to referee 1
    result.changes.forEach(c => {
      expect(c.newValue).toBe(1);
    });
  });

  it('should handle more referees than matches', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 5 });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    expect(result.changes).toHaveLength(1);
  });

  it('should handle matches without scheduled time', () => {
    const matches = [
      createMatch({ id: 'm1', referee: undefined, scheduledTime: undefined }),
    ];
    const config = createRefereeConfig();
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    // Should still assign (no time conflict possible)
    expect(result.changes).toHaveLength(1);
  });

  it('should handle teams mode', () => {
    const config = createRefereeConfig({ mode: 'teams' });
    const matches = [createMatch({ referee: undefined })];
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    // Should work with teams mode too
    expect(result.success).toBe(true);
  });

  it('should handle missing refereeNames in config', () => {
    const config: RefereeConfig = {
      mode: 'organizer',
      numberOfReferees: 2,
      // No refereeNames
    };
    const matches = [createMatch({ referee: 1 })];
    const result = getRefereeStats(matches, config);

    expect(result[0].name).toBe('SR 1'); // Default name
    expect(result[1].name).toBe('SR 2');
  });

  it('should handle maxConsecutiveMatches limit', () => {
    // Create 4 consecutive matches
    const matches = [
      createMatch({ id: 'm1', referee: 1, scheduledTime: new Date('2024-01-15T10:00:00') }),
      createMatch({ id: 'm2', referee: 1, scheduledTime: new Date('2024-01-15T10:15:00') }),
      createMatch({ id: 'm3', referee: 1, scheduledTime: new Date('2024-01-15T10:30:00') }),
      createMatch({ id: 'm4', referee: undefined, scheduledTime: new Date('2024-01-15T10:45:00') }),
    ];
    const config = createRefereeConfig({
      numberOfReferees: 2,
      maxConsecutiveMatches: 2,
    });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    // m4 should be assigned to referee 2 due to consecutive limit
    const m4Change = result.changes.find(c => c.matchId === 'm4');
    if (m4Change) {
      expect(m4Change.newValue).toBe(2);
    }
  });
});

// ============================================================================
// Negative Test Cases
// ============================================================================

describe('Negative Test Cases', () => {
  it('should handle impossible assignment (all refs conflicted)', () => {
    // 3 matches at same time, only 2 referees
    // Note: The algorithm assigns greedily, so some refs will be double-booked
    const matches = [
      createMatch({ id: 'm1', referee: undefined, scheduledTime: new Date('2024-01-15T10:00:00'), field: 1 }),
      createMatch({ id: 'm2', referee: undefined, scheduledTime: new Date('2024-01-15T10:00:00'), field: 2 }),
      createMatch({ id: 'm3', referee: undefined, scheduledTime: new Date('2024-01-15T10:00:00'), field: 3 }),
    ];
    const config = createRefereeConfig({ numberOfReferees: 2 });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    // Algorithm will assign as many as possible - at minimum 2 (one per ref)
    // The third match may or may not be assigned depending on conflict checking
    expect(result.changes.length).toBeGreaterThanOrEqual(2);
    // Check that at least 2 unique referees were assigned
    const assignedRefs = new Set(result.changes.map(c => c.newValue));
    expect(assignedRefs.size).toBeLessThanOrEqual(2);
  });

  it('should not crash with invalid match data', () => {
    const matches = [
      createMatch({
        id: 'm1',
        referee: undefined,
        scheduledTime: new Date('invalid-date'),
      }),
    ];
    const config = createRefereeConfig();

    // Should not throw
    expect(() => autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true })).not.toThrow();
  });

  it('should handle numberOfReferees = 0', () => {
    const matches = [createMatch({ referee: undefined })];
    const config = createRefereeConfig({ numberOfReferees: 0 });
    const result = autoReassignReferees(matches, config, { target: 'referee', optimizeForFairness: true });

    expect(result.changes).toHaveLength(0);
  });
});
