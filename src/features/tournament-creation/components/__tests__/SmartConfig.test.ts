import { describe, it, expect } from 'vitest';

interface Recommendation {
  teams: number;
  fields: number;
  gameDuration: number;
  breakDuration: number;
  totalMatches: number;
  estimatedHours: number;
}

// Extract calculation logic for testing
function calculateRecommendation(
  availableHours: number,
  currentTeams: number
): Recommendation {
  const teams = currentTeams;
  const totalMatches = (teams * (teams - 1)) / 2;

  const configurations: Recommendation[] = [];

  const gameDurations = [8, 10, 12, 15];
  const breakDurations = [2, 3, 5];
  const fieldOptions = [1, 2, 3, 4];

  for (const gameDuration of gameDurations) {
    for (const breakDuration of breakDurations) {
      for (const fields of fieldOptions) {
        const slotDuration = gameDuration + breakDuration;
        const slotsNeeded = Math.ceil(totalMatches / fields);
        const totalMinutes = slotsNeeded * slotDuration;
        const estimatedHours = totalMinutes / 60;

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

  // Sort by: fewer fields, then longer game duration
  configurations.sort((a, b) => {
    if (a.fields !== b.fields) {return a.fields - b.fields;}
    return b.gameDuration - a.gameDuration;
  });

  if (configurations.length > 0) {
    return configurations[0];
  }

  // Fallback
  const reducedTeams = Math.max(4, Math.floor(teams * 0.7));
  const reducedMatches = (reducedTeams * (reducedTeams - 1)) / 2;
  const fields = Math.ceil(reducedMatches / (availableHours * 60 / 12));

  return {
    teams: reducedTeams,
    fields: Math.max(1, Math.min(4, fields)),
    gameDuration: 10,
    breakDuration: 2,
    totalMatches: reducedMatches,
    estimatedHours: (reducedMatches / Math.max(1, fields)) * 12 / 60,
  };
}

describe('SmartConfig', () => {
  describe('calculateRecommendation', () => {
    it('calculates correct number of matches', () => {
      const result = calculateRecommendation(4, 6);
      // 6 teams = 6*(6-1)/2 = 15 matches
      expect(result.totalMatches).toBe(15);
    });

    it('prefers fewer fields when possible', () => {
      const result = calculateRecommendation(4, 6);
      // With 4 hours and 6 teams, should prefer 1 field
      expect(result.fields).toBe(1);
    });

    it('increases fields for more teams', () => {
      const result = calculateRecommendation(2, 10);
      // 10 teams = 45 matches, needs more fields for 2 hours
      expect(result.fields).toBeGreaterThan(1);
    });

    it('prefers longer game duration when time allows', () => {
      const result = calculateRecommendation(8, 4);
      // With 8 hours and 4 teams (6 matches), should get longest duration
      expect(result.gameDuration).toBe(15);
    });

    it('reduces game duration for tight schedules', () => {
      const result = calculateRecommendation(2, 8);
      // 8 teams = 28 matches in 2 hours
      expect(result.gameDuration).toBeLessThanOrEqual(10);
    });

    it('falls back to reduced team count when nothing fits', () => {
      const result = calculateRecommendation(0.5, 20);
      // 20 teams in 30 minutes is impossible, should reduce teams
      expect(result.teams).toBeLessThan(20);
    });

    it('never returns more than 4 fields', () => {
      const result = calculateRecommendation(1, 16);
      expect(result.fields).toBeLessThanOrEqual(4);
    });

    it('never returns less than 1 field', () => {
      const result = calculateRecommendation(10, 4);
      expect(result.fields).toBeGreaterThanOrEqual(1);
    });

    it('estimates hours correctly', () => {
      const result = calculateRecommendation(4, 6);
      // 15 matches, 1 field, slotDuration = gameDuration + breakDuration
      // estimatedHours = (15 / 1) * slotDuration / 60
      const expectedMinutes = 15 * (result.gameDuration + result.breakDuration);
      const expectedHours = expectedMinutes / 60;
      expect(result.estimatedHours).toBeCloseTo(expectedHours, 1);
    });

    it('stays within available time', () => {
      const availableHours = 3;
      const result = calculateRecommendation(availableHours, 8);
      expect(result.estimatedHours).toBeLessThanOrEqual(availableHours);
    });

    it('handles minimum team count', () => {
      const result = calculateRecommendation(1, 4);
      expect(result.teams).toBe(4);
      expect(result.totalMatches).toBe(6); // 4*(4-1)/2 = 6
    });

    it('uses fallback for impossible configurations', () => {
      // 20 teams need 190 matches, impossible in 0.3 hours
      const result = calculateRecommendation(0.3, 20);
      expect(result.teams).toBeLessThan(20);
      expect(result.teams).toBeGreaterThanOrEqual(4);
    });
  });
});
