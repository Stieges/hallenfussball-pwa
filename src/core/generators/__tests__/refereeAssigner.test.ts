import { describe, it, expect } from 'vitest';
import { assignReferees, getRefereeDisplayName, isValidFinalsReferee } from '../refereeAssigner';
import type { Team, Match, RefereeConfig } from '../../../types/tournament';

// =============================================================================
// Test Helpers
// =============================================================================

interface TestMatch {
  id: string;
  field: number;
  slot?: number;
  referee?: number;
  teamA?: string;
  teamB?: string;
  homeTeam?: string;
  awayTeam?: string;
}

function createMatch(overrides: Partial<TestMatch> & { id: string }): TestMatch {
  return { field: 1, slot: 0, ...overrides };
}

function createTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
  }));
}

// =============================================================================
// assignReferees — mode: 'none'
// =============================================================================

describe('assignReferees mode=none', () => {
  it('returns matches unchanged', () => {
    const matches = [
      createMatch({ id: 'm1', teamA: 'Team 1', teamB: 'Team 2' }),
      createMatch({ id: 'm2', teamA: 'Team 3', teamB: 'Team 4' }),
    ];
    const config: RefereeConfig = { mode: 'none' };
    const result = assignReferees(matches, createTeams(4), config);
    expect(result).toEqual(matches);
  });
});

// =============================================================================
// assignReferees — mode: 'organizer'
// =============================================================================

describe('assignReferees mode=organizer', () => {
  it('assigns referees with round-robin distribution', () => {
    const matches = Array.from({ length: 6 }, (_, i) =>
      createMatch({ id: `m${i + 1}`, slot: i, field: 1 })
    );
    const config: RefereeConfig = {
      mode: 'organizer',
      numberOfReferees: 2,
      maxConsecutiveMatches: 1,
    };
    const result = assignReferees(matches, createTeams(4), config);

    // Every match should have a referee assigned
    for (const m of result) {
      expect(m.referee).toBeDefined();
      expect(m.referee).toBeGreaterThanOrEqual(1);
      expect(m.referee).toBeLessThanOrEqual(2);
    }
  });

  it('respects maxConsecutiveMatches constraint', () => {
    const matches = Array.from({ length: 4 }, (_, i) =>
      createMatch({ id: `m${i + 1}`, slot: i, field: 1 })
    );
    const config: RefereeConfig = {
      mode: 'organizer',
      numberOfReferees: 2,
      maxConsecutiveMatches: 1,
    };
    const result = assignReferees(matches, createTeams(4), config);

    // No referee should have two consecutive slots (maxConsecutive=1 means 1 slot break needed)
    for (let i = 1; i < result.length; i++) {
      const currentSlot = result[i].slot ?? 0;
      const previousSlot = result[i - 1].slot ?? 0;
      if (currentSlot - previousSlot < 1) {
        continue; // same slot, skip
      }
      // Adjacent slots should have different referees
      if (currentSlot - previousSlot === 1) {
        expect(result[i].referee).not.toBe(result[i - 1].referee);
      }
    }
  });

  it('balances workload across referees', () => {
    const matches = Array.from({ length: 8 }, (_, i) =>
      createMatch({ id: `m${i + 1}`, slot: i, field: 1 })
    );
    const config: RefereeConfig = {
      mode: 'organizer',
      numberOfReferees: 2,
      maxConsecutiveMatches: 1,
    };
    const result = assignReferees(matches, createTeams(4), config);

    const workload = [0, 0];
    for (const m of result) {
      if (m.referee) {
        workload[m.referee - 1]++;
      }
    }
    // Difference should be at most 1
    expect(Math.abs(workload[0] - workload[1])).toBeLessThanOrEqual(1);
  });

  it('preserves manual assignments', () => {
    const matches = [
      createMatch({ id: 'm1', slot: 0, field: 1 }),
      createMatch({ id: 'm2', slot: 1, field: 1 }),
      createMatch({ id: 'm3', slot: 2, field: 1 }),
    ];
    const config: RefereeConfig = {
      mode: 'organizer',
      numberOfReferees: 2,
      maxConsecutiveMatches: 1,
      manualAssignments: { m2: 99 },
    };
    const result = assignReferees(matches, createTeams(4), config);

    expect(result.find(m => m.id === 'm2')!.referee).toBe(99);
  });

  it('defaults to 2 referees when numberOfReferees not set', () => {
    const matches = Array.from({ length: 4 }, (_, i) =>
      createMatch({ id: `m${i + 1}`, slot: i, field: 1 })
    );
    const config: RefereeConfig = { mode: 'organizer' };
    const result = assignReferees(matches, createTeams(4), config);

    const refNumbers = new Set(result.map(m => m.referee));
    // Should only use refs 1 and 2
    for (const ref of refNumbers) {
      expect(ref).toBeGreaterThanOrEqual(1);
      expect(ref).toBeLessThanOrEqual(2);
    }
  });
});

// =============================================================================
// assignReferees — mode: 'teams'
// =============================================================================

describe('assignReferees mode=teams', () => {
  it('assigns previous home team as referee for next match on same field', () => {
    const teams = createTeams(4);
    const matches = [
      createMatch({ id: 'm1', slot: 0, field: 1, teamA: 'Team 1', teamB: 'Team 2' }),
      createMatch({ id: 'm2', slot: 1, field: 1, teamA: 'Team 3', teamB: 'Team 4' }),
    ];
    const config: RefereeConfig = { mode: 'teams' };
    const result = assignReferees(matches, teams, config);

    // First match: no previous match, so no referee
    expect(result.find(m => m.id === 'm1')!.referee).toBeUndefined();
    // Second match: Team 1 (index 0 + 1 = 1) was home in previous match
    expect(result.find(m => m.id === 'm2')!.referee).toBe(1);
  });

  it('handles ScheduledMatch format (homeTeam/awayTeam)', () => {
    const teams = createTeams(4);
    const matches = [
      createMatch({ id: 'm1', slot: 0, field: 1, homeTeam: 'Team 1', awayTeam: 'Team 2' }),
      createMatch({ id: 'm2', slot: 1, field: 1, homeTeam: 'Team 3', awayTeam: 'Team 4' }),
    ];
    const config: RefereeConfig = { mode: 'teams' };
    const result = assignReferees(matches, teams, config);

    expect(result.find(m => m.id === 'm2')!.referee).toBe(1);
  });

  it('assigns separately per field', () => {
    const teams = createTeams(4);
    const matches = [
      createMatch({ id: 'm1', slot: 0, field: 1, teamA: 'Team 1', teamB: 'Team 2' }),
      createMatch({ id: 'm2', slot: 0, field: 2, teamA: 'Team 3', teamB: 'Team 4' }),
      createMatch({ id: 'm3', slot: 1, field: 1, teamA: 'Team 3', teamB: 'Team 4' }),
      createMatch({ id: 'm4', slot: 1, field: 2, teamA: 'Team 1', teamB: 'Team 2' }),
    ];
    const config: RefereeConfig = { mode: 'teams' };
    const result = assignReferees(matches, teams, config);

    // Field 1: previous home was Team 1 → ref = 1
    expect(result.find(m => m.id === 'm3')!.referee).toBe(1);
    // Field 2: previous home was Team 3 → ref = 3
    expect(result.find(m => m.id === 'm4')!.referee).toBe(3);
  });

  it('preserves manual assignments in teams mode', () => {
    const teams = createTeams(4);
    const matches = [
      createMatch({ id: 'm1', slot: 0, field: 1, teamA: 'Team 1', teamB: 'Team 2' }),
      createMatch({ id: 'm2', slot: 1, field: 1, teamA: 'Team 3', teamB: 'Team 4' }),
    ];
    const config: RefereeConfig = {
      mode: 'teams',
      manualAssignments: { m2: 42 },
    };
    const result = assignReferees(matches, teams, config);

    expect(result.find(m => m.id === 'm2')!.referee).toBe(42);
  });
});

// =============================================================================
// getRefereeDisplayName
// =============================================================================

describe('getRefereeDisplayName', () => {
  it('returns "-" when refereeNumber is undefined', () => {
    expect(getRefereeDisplayName(undefined, { mode: 'organizer' })).toBe('-');
  });

  it('returns custom name from refereeNames', () => {
    const config: RefereeConfig = {
      mode: 'organizer',
      refereeNames: { 1: 'Max Mustermann' },
    };
    expect(getRefereeDisplayName(1, config)).toBe('Max Mustermann');
  });

  it('returns team name in teams mode', () => {
    const teams = createTeams(3);
    const config: RefereeConfig = { mode: 'teams' };
    expect(getRefereeDisplayName(2, config, teams)).toBe('Team 2');
  });

  it('returns number as string when no config matches', () => {
    expect(getRefereeDisplayName(5, { mode: 'organizer' })).toBe('5');
  });

  it('returns number as string when config is undefined', () => {
    expect(getRefereeDisplayName(3, undefined)).toBe('3');
  });
});

// =============================================================================
// isValidFinalsReferee
// =============================================================================

describe('isValidFinalsReferee', () => {
  const teams = createTeams(4);
  const match: Match = {
    id: 'final',
    round: 1,
    field: 1,
    teamA: 'Team 1',
    teamB: 'Team 2',
  };

  it('returns false when finalsRefereeMode is "none"', () => {
    const config: RefereeConfig = { mode: 'organizer', finalsRefereeMode: 'none' };
    expect(isValidFinalsReferee(match, 3, config, teams)).toBe(false);
  });

  it('returns false when finalsRefereeMode is undefined', () => {
    const config: RefereeConfig = { mode: 'organizer' };
    expect(isValidFinalsReferee(match, 3, config, teams)).toBe(false);
  });

  it('returns false when referee team is playing in the match', () => {
    const config: RefereeConfig = { mode: 'teams', finalsRefereeMode: 'neutralTeams' };
    // Team 1 (index 0, referee number 1) is playing
    expect(isValidFinalsReferee(match, 1, config, teams)).toBe(false);
  });

  it('returns true for neutral team referee', () => {
    const config: RefereeConfig = { mode: 'teams', finalsRefereeMode: 'neutralTeams' };
    // Team 3 (referee number 3) is not playing
    expect(isValidFinalsReferee(match, 3, config, teams)).toBe(true);
  });
});
