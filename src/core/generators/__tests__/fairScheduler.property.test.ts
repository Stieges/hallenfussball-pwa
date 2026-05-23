import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateGroupPhaseSchedule,
  analyzeScheduleFairness,
} from '../../generators';
import type { Team, Match } from '../../../types/tournament';

/**
 * Property tests for FairScheduler (HP-5e).
 *
 * Covers two invariants that the existing example-driven tests cannot
 * exercise broadly:
 *
 * 1. **Schedule completeness (round-robin)** — for every group of n teams,
 *    every unordered pair plays exactly once. Total matches = n*(n-1)/2.
 *
 * 2. **Pausen-Fairness-Invariante** — the spread between the team with the
 *    longest average rest and the team with the shortest average rest must
 *    stay below `MAX_FAIRNESS_DELTA`. The threshold is set just above the
 *    worst case the current scheduler reaches on the tested input space —
 *    if a future change worsens it, fast-check will shrink the case to the
 *    smallest team-count / field-count counterexample for inspection.
 *
 * Input space is intentionally kept inside the algorithm's known-stable
 * range (4–16 teams, 1–3 fields). The 128-team deadlock is out of scope
 * and tracked separately via the skipped test in fairScheduler.minimal.test.ts.
 */

const MAX_FAIRNESS_DELTA = 1.5;

function createTeams(n: number, group = 'A'): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Team ${i}`,
    group,
    players: [],
  }));
}

function generate(numTeams: number, numFields: number): Match[] {
  return generateGroupPhaseSchedule({
    groups: new Map([['A', createTeams(numTeams)]]),
    numberOfFields: numFields,
    slotDurationMinutes: 10,
    breakBetweenSlotsMinutes: 2,
    minRestSlotsPerTeam: 1,
    startTime: new Date('2024-01-01T09:00:00'),
  });
}

describe('FairScheduler — round-robin completeness (property)', () => {
  it('every unordered team pair appears exactly once', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 16 }),
        fc.integer({ min: 1, max: 3 }),
        (numTeams, numFields) => {
          const matches = generate(numTeams, numFields);

          const expectedMatchCount = (numTeams * (numTeams - 1)) / 2;
          expect(matches.length).toBe(expectedMatchCount);

          const pairs = new Set<string>();
          for (const m of matches) {
            const key = [m.teamA, m.teamB].sort().join('|');
            expect(pairs.has(key)).toBe(false);
            pairs.add(key);
          }
          expect(pairs.size).toBe(expectedMatchCount);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('every team plays exactly n-1 matches', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 16 }),
        fc.integer({ min: 1, max: 3 }),
        (numTeams, numFields) => {
          const matches = generate(numTeams, numFields);

          const counts = new Map<string, number>();
          for (const m of matches) {
            counts.set(m.teamA, (counts.get(m.teamA) ?? 0) + 1);
            counts.set(m.teamB, (counts.get(m.teamB) ?? 0) + 1);
          }

          for (let i = 0; i < numTeams; i++) {
            expect(counts.get(`t${i}`)).toBe(numTeams - 1);
          }
        },
      ),
      { numRuns: 15 },
    );
  });
});

describe('FairScheduler — Pausen-Fairness-Invariante (property)', () => {
  it('maxAvgRest - minAvgRest stays within tolerance for tested input space', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 16 }),
        fc.integer({ min: 1, max: 3 }),
        (numTeams, numFields) => {
          const matches = generate(numTeams, numFields);
          const analysis = analyzeScheduleFairness(matches);

          const avgRests = analysis.teamStats.map((s) => s.avgRest);
          const maxAvg = Math.max(...avgRests);
          const minAvg = Math.min(...avgRests);
          const delta = maxAvg - minAvg;

          expect(delta).toBeLessThanOrEqual(MAX_FAIRNESS_DELTA);
        },
      ),
      { numRuns: 15 },
    );
  });

  it('no team has back-to-back matches when minRestSlotsPerTeam=1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 12 }),
        fc.integer({ min: 1, max: 3 }),
        (numTeams, numFields) => {
          const matches = generate(numTeams, numFields);
          const analysis = analyzeScheduleFairness(matches);

          for (const stats of analysis.teamStats) {
            if (stats.restsInSlots.length === 0) {
              continue;
            }
            expect(stats.minRest).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 15 },
    );
  });
});
