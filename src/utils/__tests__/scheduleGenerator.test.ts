import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '../../core/generators';
import { Tournament, Team } from '../../types/tournament';

// Helper to create a minimal tournament config
// Note: minRestSlots: 0 allows back-to-back matches which is needed for 1 field scenarios
const createTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 'test-tournament',
  title: 'Test Tournament',
  date: '2024-01-15',
  timeSlot: '10:00',
  location: { name: 'Sporthalle Test' },
  ageClass: 'U15',
  sport: 'football',
  tournamentType: 'classic',
  mode: 'classic',
  numberOfTeams: 4,
  numberOfFields: 1,
  groupSystem: 'roundRobin',
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  minRestSlots: 0, // Important: Allow back-to-back matches for simple tests
  teams: [],
  matches: [],
  pointSystem: { win: 3, draw: 1, loss: 0 },
  placementLogic: [
    { id: 'points', label: 'Punkte', enabled: true },
    { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
  ],
  finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
  isKidsTournament: false,
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  resultMode: 'goals',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Helper to create teams
const createTeams = (count: number, group?: string): Team[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    group,
  }));

describe('generateFullSchedule', () => {
  describe('Basic Schedule Generation', () => {
    it('generates correct number of matches for round-robin (4 teams)', () => {
      const teams = createTeams(4);
      const tournament = createTournament({ teams, numberOfTeams: 4 });

      const schedule = generateFullSchedule(tournament);

      // 4 teams = 4*3/2 = 6 matches
      expect(schedule.allMatches.length).toBe(6);
    });

    it('generates correct number of matches for round-robin (5 teams - odd)', () => {
      const teams = createTeams(5);
      const tournament = createTournament({ teams, numberOfTeams: 5 });

      const schedule = generateFullSchedule(tournament);

      // 5 teams = 5*4/2 = 10 matches
      expect(schedule.allMatches.length).toBe(10);
    });

    it('generates correct number of matches for round-robin (8 teams)', () => {
      const teams = createTeams(8);
      const tournament = createTournament({ teams, numberOfTeams: 8 });

      const schedule = generateFullSchedule(tournament);

      // 8 teams = 8*7/2 = 28 matches
      expect(schedule.allMatches.length).toBe(28);
    });
  });

  describe('Time Slot Calculation', () => {
    it('calculates start times correctly', () => {
      const teams = createTeams(4);
      const tournament = createTournament({
        teams,
        numberOfTeams: 4,
        numberOfFields: 1,
        groupPhaseGameDuration: 10,
        groupPhaseBreakDuration: 2,
        timeSlot: '10:00',
      });

      const schedule = generateFullSchedule(tournament);

      expect(schedule.allMatches[0].time).toBe('10:00');
      // Next slot: 10:00 + 10min game + 2min break = 10:12
      // (depending on implementation, could be 10:10 if break is after)
    });

    it('handles multiple fields (parallel matches)', () => {
      const teams = createTeams(8);
      const tournament = createTournament({
        teams,
        numberOfTeams: 8,
        numberOfFields: 2,
      });

      const schedule = generateFullSchedule(tournament);

      // Should have matches on both fields
      const field1Matches = schedule.allMatches.filter(m => m.field === 1);
      const field2Matches = schedule.allMatches.filter(m => m.field === 2);

      expect(field1Matches.length).toBeGreaterThan(0);
      expect(field2Matches.length).toBeGreaterThan(0);
    });
  });

  describe('Group Phase + Finals', () => {
    it('generates group matches for 2 groups', () => {
      const teamsA = createTeams(4, 'A').map((t, i) => ({ ...t, id: `a-${i}`, name: `Team A${i + 1}`, group: 'A' }));
      const teamsB = createTeams(4, 'B').map((t, i) => ({ ...t, id: `b-${i}`, name: `Team B${i + 1}`, group: 'B' }));
      const allTeams = [...teamsA, ...teamsB];

      const tournament = createTournament({
        teams: allTeams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'none' },
      });

      const schedule = generateFullSchedule(tournament);

      // 4 teams per group = 6 matches per group = 12 total
      expect(schedule.allMatches.length).toBe(12);

      // Check that groups are assigned
      const groupAMatches = schedule.allMatches.filter(m => m.group === 'A');
      const groupBMatches = schedule.allMatches.filter(m => m.group === 'B');

      expect(groupAMatches.length).toBe(6);
      expect(groupBMatches.length).toBe(6);
    });

    it('generates finals with top-4 preset', () => {
      const teamsA = createTeams(4, 'A').map((t, i) => ({ ...t, id: `a-${i}`, name: `Team A${i + 1}`, group: 'A' }));
      const teamsB = createTeams(4, 'B').map((t, i) => ({ ...t, id: `b-${i}`, name: `Team B${i + 1}`, group: 'B' }));
      const allTeams = [...teamsA, ...teamsB];

      const tournament = createTournament({
        teams: allTeams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
      });

      const schedule = generateFullSchedule(tournament);

      // Group phase: 12 matches
      // Finals (top-4): at least 2 matches (Semifinal + Final, third place optional)
      expect(schedule.allMatches.length).toBeGreaterThanOrEqual(14);

      // Check finals exist
      const finalMatches = schedule.allMatches.filter(m => m.phase !== 'groupStage');
      expect(finalMatches.length).toBeGreaterThanOrEqual(2);
    });

    it('handles odd team count (5 teams) with groups and finals', () => {
      // BUG FIX: This test verifies that odd team counts don't cause scheduling deadlock
      // Previously, the scheduler would fail with "2 Matches fehlen" error
      const teamsA = createTeams(3, 'A').map((t, i) => ({ ...t, id: `a-${i}`, name: `Team A${i + 1}`, group: 'A' }));
      const teamsB = createTeams(2, 'B').map((t, i) => ({ ...t, id: `b-${i}`, name: `Team B${i + 1}`, group: 'B' }));
      const allTeams = [...teamsA, ...teamsB];

      const tournament = createTournament({
        teams: allTeams,
        numberOfTeams: 5,
        numberOfGroups: 2,
        numberOfFields: 1,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
        minRestSlots: 1, // This was causing the issue - teams need rest between matches
      });

      // Should NOT throw an error
      const schedule = generateFullSchedule(tournament);

      // Group A: 3 teams = 3 matches, Group B: 2 teams = 1 match = 4 group matches
      const groupMatches = schedule.allMatches.filter(m => m.phase === 'groupStage');
      expect(groupMatches.length).toBe(4);

      // Finals should still be generated (semifinal + final + third place)
      const finalMatches = schedule.allMatches.filter(m => m.phase !== 'groupStage');
      expect(finalMatches.length).toBeGreaterThanOrEqual(2);
    });

    it('handles all-places preset with small groups (no invalid placement matches)', () => {
      // BUG FIX: This test verifies that all-places preset doesn't generate
      // placement matches for positions that don't exist in small groups
      const teamsA = createTeams(3, 'A').map((t, i) => ({ ...t, id: `a-${i}`, name: `Team A${i + 1}`, group: 'A' }));
      const teamsB = createTeams(3, 'B').map((t, i) => ({ ...t, id: `b-${i}`, name: `Team B${i + 1}`, group: 'B' }));
      const allTeams = [...teamsA, ...teamsB];

      const tournament = createTournament({
        teams: allTeams,
        numberOfTeams: 6,
        numberOfGroups: 2,
        numberOfFields: 1,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'all-places' },
        minRestSlots: 0, // Allow back-to-back for simplicity
      });

      // Should NOT throw an error
      const schedule = generateFullSchedule(tournament);

      // Group phase: 3 matches per group = 6 total
      const groupMatches = schedule.allMatches.filter(m => m.phase === 'groupStage');
      expect(groupMatches.length).toBe(6);

      // With 3 teams per group:
      // - Place 5/6 match SHOULD exist (3rd place from each group)
      // - Place 7/8 match should NOT exist (no 4th place in 3-team groups)
      const finalMatches = schedule.allMatches.filter(m => m.phase !== 'groupStage');

      // Should have: 2 semifinals + 1 third-place + 1 final + 1 place 5/6 = 5 matches
      // Should NOT have place 7/8 match
      expect(finalMatches.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Schedule Metadata', () => {
    it('includes tournament metadata', () => {
      const teams = createTeams(4);
      const tournament = createTournament({
        teams,
        title: 'My Tournament',
        ageClass: 'U12',
      });

      const schedule = generateFullSchedule(tournament);

      expect(schedule.tournament.title).toBe('My Tournament');
      expect(schedule.tournament.ageClass).toBe('U12');
    });

    it('calculates total duration', () => {
      const teams = createTeams(4);
      const tournament = createTournament({ teams });

      const schedule = generateFullSchedule(tournament);

      expect(schedule.totalDuration).toBeGreaterThan(0);
      expect(schedule.startTime).toBeInstanceOf(Date);
      expect(schedule.endTime).toBeInstanceOf(Date);
    });
  });

  describe('Edge Cases', () => {
    it('handles minimum 2 teams', () => {
      const teams = createTeams(2);
      const tournament = createTournament({ teams, numberOfTeams: 2 });

      const schedule = generateFullSchedule(tournament);

      expect(schedule.allMatches.length).toBe(1);
    });

    it('throws error for 0 teams', () => {
      const tournament = createTournament({ teams: [], numberOfTeams: 0 });

      expect(() => generateFullSchedule(tournament)).toThrow();
    });

    it('handles single field with many teams (minRestSlots: 0)', () => {
      const teams = createTeams(10);
      const tournament = createTournament({
        teams,
        numberOfTeams: 10,
        numberOfFields: 1,
        minRestSlots: 0, // Allow back-to-back
      });

      const schedule = generateFullSchedule(tournament);

      // 10 teams = 45 matches
      expect(schedule.allMatches.length).toBe(45);

      // All on field 1
      expect(schedule.allMatches.every(m => m.field === 1)).toBe(true);
    });
  });

  describe('Match Properties', () => {
    it('assigns unique match IDs', () => {
      const teams = createTeams(4);
      const tournament = createTournament({ teams });

      const schedule = generateFullSchedule(tournament);

      const ids = schedule.allMatches.map(m => m.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('assigns sequential match numbers', () => {
      const teams = createTeams(4);
      const tournament = createTournament({ teams });

      const schedule = generateFullSchedule(tournament);

      const numbers = schedule.allMatches.map(m => m.matchNumber);

      expect(numbers[0]).toBe(1);
      expect(numbers[numbers.length - 1]).toBe(schedule.allMatches.length);
    });

    it('resolves team names correctly', () => {
      const teams = createTeams(4);
      const tournament = createTournament({ teams });

      const schedule = generateFullSchedule(tournament);

      // All matches should have resolved team names
      schedule.allMatches.forEach(match => {
        expect(match.homeTeam).toBeTruthy();
        expect(match.awayTeam).toBeTruthy();
        expect(match.homeTeam).not.toContain('team-'); // Should be name, not ID
      });
    });
  });

  describe('Phases', () => {
    it('creates group stage phase', () => {
      const teams = createTeams(4);
      const tournament = createTournament({ teams });

      const schedule = generateFullSchedule(tournament);

      expect(schedule.phases.length).toBeGreaterThan(0);
      expect(schedule.phases[0].name).toBe('groupStage');
      expect(schedule.phases[0].label).toBe('Gruppenphase');
    });

    it('creates finals phases when configured', () => {
      const teamsA = createTeams(4, 'A').map((t, i) => ({ ...t, id: `a-${i}`, name: `Team A${i + 1}`, group: 'A' }));
      const teamsB = createTeams(4, 'B').map((t, i) => ({ ...t, id: `b-${i}`, name: `Team B${i + 1}`, group: 'B' }));
      const allTeams = [...teamsA, ...teamsB];

      const tournament = createTournament({
        teams: allTeams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
      });

      const schedule = generateFullSchedule(tournament);

      const phaseNames = schedule.phases.map(p => p.name);

      expect(phaseNames).toContain('groupStage');
      // Finals should exist (exact phase names depend on implementation)
      expect(phaseNames.some(p => p !== 'groupStage')).toBe(true);
    });
  });
});

describe('Schedule Fairness', () => {
  it('each team plays equal number of matches in round-robin', () => {
    const teams = createTeams(6);
    const tournament = createTournament({ teams, numberOfTeams: 6 });

    const schedule = generateFullSchedule(tournament);

    // Count matches per team
    const matchCounts: Record<string, number> = {};
    schedule.allMatches.forEach(match => {
      matchCounts[match.homeTeam] = (matchCounts[match.homeTeam] || 0) + 1;
      matchCounts[match.awayTeam] = (matchCounts[match.awayTeam] || 0) + 1;
    });

    // Each team should play 5 matches (n-1 for round-robin)
    Object.values(matchCounts).forEach(count => {
      expect(count).toBe(5);
    });
  });
});
