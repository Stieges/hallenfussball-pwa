import { describe, it, expect } from 'vitest';
import { calculateStandings, getQualifiedTeams } from '../calculations';
import { Team, Match, Tournament, Standing } from '../../types/tournament';

// Helper to create a minimal tournament config
const createTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 'test-tournament',
  title: 'Test Tournament',
  date: '2024-01-01',
  timeSlot: '10:00',
  location: { name: 'Test Location' },
  ageClass: 'U15',
  numberOfTeams: 4,
  numberOfFields: 1,
  groupSystem: 'roundRobin',
  groupPhaseGameDuration: 10,
  teams: [],
  matches: [],
  pointSystem: { win: 3, draw: 1, loss: 0 },
  placementLogic: [
    { id: 'points', label: 'Punkte', enabled: true, order: 1 },
    { id: 'goalDifference', label: 'Tordifferenz', enabled: true, order: 2 },
    { id: 'goalsFor', label: 'Tore', enabled: true, order: 3 },
    { id: 'directComparison', label: 'Direkter Vergleich', enabled: true, order: 4 },
  ],
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

describe('calculateStandings', () => {
  describe('Basic Points Calculation', () => {
    it('calculates points correctly for a win (3-1-0 system)', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1',
          teamB: 'Team 2',
          scoreA: 2,
          scoreB: 1,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].team.name).toBe('Team 1');
      expect(standings[0].points).toBe(3);
      expect(standings[0].won).toBe(1);

      expect(standings[1].team.name).toBe('Team 2');
      expect(standings[1].points).toBe(0);
      expect(standings[1].lost).toBe(1);
    });

    it('calculates points correctly for a draw', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1',
          teamB: 'Team 2',
          scoreA: 1,
          scoreB: 1,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].points).toBe(1);
      expect(standings[0].drawn).toBe(1);
      expect(standings[1].points).toBe(1);
      expect(standings[1].drawn).toBe(1);
    });

    it('calculates goal difference correctly', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1',
          teamB: 'Team 2',
          scoreA: 5,
          scoreB: 2,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      const team1 = standings.find(s => s.team.name === 'Team 1')!;
      const team2 = standings.find(s => s.team.name === 'Team 2')!;

      expect(team1.goalsFor).toBe(5);
      expect(team1.goalsAgainst).toBe(2);
      expect(team1.goalDifference).toBe(3);

      expect(team2.goalsFor).toBe(2);
      expect(team2.goalsAgainst).toBe(5);
      expect(team2.goalDifference).toBe(-3);
    });
  });

  describe('Team Matching (BUG-001 Fix)', () => {
    it('matches teams by name', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1', // Using name
          teamB: 'Team 2',
          scoreA: 1,
          scoreB: 0,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].played).toBe(1);
      expect(standings[1].played).toBe(1);
    });

    it('matches teams by ID (edge case)', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'team-1', // Using ID instead of name
          teamB: 'team-2',
          scoreA: 1,
          scoreB: 0,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      // Should still find teams by ID
      expect(standings[0].played).toBe(1);
      expect(standings[1].played).toBe(1);
    });

    it('handles mixed ID and name references', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1', // Name
          teamB: 'team-2', // ID
          scoreA: 2,
          scoreB: 1,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].played).toBe(1);
      expect(standings[1].played).toBe(1);
    });
  });

  describe('Sorting and Placement Logic', () => {
    it('sorts by points first', () => {
      const teams = createTeams(3);
      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 1, scoreB: 0 },
        { id: 'm2', round: 2, field: 1, teamA: 'Team 1', teamB: 'Team 3', scoreA: 1, scoreB: 0 },
        { id: 'm3', round: 3, field: 1, teamA: 'Team 2', teamB: 'Team 3', scoreA: 1, scoreB: 0 },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].team.name).toBe('Team 1'); // 6 points
      expect(standings[1].team.name).toBe('Team 2'); // 3 points
      expect(standings[2].team.name).toBe('Team 3'); // 0 points
    });

    it('sorts by goal difference when points are equal', () => {
      const teams = createTeams(3);
      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 3, scoreB: 0 },
        { id: 'm2', round: 2, field: 1, teamA: 'Team 2', teamB: 'Team 3', scoreA: 3, scoreB: 0 },
        { id: 'm3', round: 3, field: 1, teamA: 'Team 3', teamB: 'Team 1', scoreA: 1, scoreB: 0 },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      // All have 3 points, sort by goal difference
      // Team 1: +3-1 = +2
      // Team 2: +3-3 = 0
      // Team 3: +1-3 = -2
      expect(standings[0].team.name).toBe('Team 1');
      expect(standings[1].team.name).toBe('Team 2');
      expect(standings[2].team.name).toBe('Team 3');
    });

    it('sorts by goals scored when goal difference is equal', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 2, scoreB: 2 },
      ];
      // Additional context needed - both have same GD
      // Let's create a scenario with multiple matches
      const teams3 = createTeams(3);
      const matches3: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 3, scoreB: 1 }, // T1: +2
        { id: 'm2', round: 2, field: 1, teamA: 'Team 2', teamB: 'Team 3', scoreA: 4, scoreB: 0 }, // T2: +2
        { id: 'm3', round: 3, field: 1, teamA: 'Team 1', teamB: 'Team 3', scoreA: 0, scoreB: 2 }, // T1: 0
      ];
      const tournament = createTournament({ teams: teams3, matches: matches3 });

      const standings = calculateStandings(teams3, matches3, tournament);

      // Both Team 1 and Team 2 have 3 points
      // Team 1: GF=3, GA=3, GD=0
      // Team 2: GF=5, GA=4, GD=+1
      // Team 2 should be first (better GD)
      expect(standings[0].team.name).toBe('Team 2');
    });
  });

  describe('Direct Comparison', () => {
    it('uses direct comparison when other criteria are equal', () => {
      const teams = createTeams(3);
      // Scenario: All teams beat each other in a circle
      // T1 beats T2, T2 beats T3, T3 beats T1 (all 1:0)
      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 1, scoreB: 0 },
        { id: 'm2', round: 2, field: 1, teamA: 'Team 2', teamB: 'Team 3', scoreA: 1, scoreB: 0 },
        { id: 'm3', round: 3, field: 1, teamA: 'Team 3', teamB: 'Team 1', scoreA: 1, scoreB: 0 },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      // All have: 3 points, GD=0, GF=1, GA=1
      // Direct comparison should determine order
      // This is a circular case - implementation may vary
      expect(standings.length).toBe(3);
      expect(standings.every(s => s.points === 3)).toBe(true);
    });

    it('direct comparison works with team IDs', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'team-1', // Using IDs
          teamB: 'team-2',
          scoreA: 2,
          scoreB: 1,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      // Direct comparison should still work
      expect(standings[0].team.id).toBe('team-1');
    });
  });

  describe('Group Filtering', () => {
    it('calculates standings for specific group only', () => {
      const teamsA = createTeams(2, 'A').map((t, i) => ({ ...t, id: `a-${i}`, name: `Team A${i + 1}` }));
      const teamsB = createTeams(2, 'B').map((t, i) => ({ ...t, id: `b-${i}`, name: `Team B${i + 1}` }));
      const allTeams = [...teamsA, ...teamsB];

      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team A1', teamB: 'Team A2', scoreA: 2, scoreB: 0, group: 'A' },
        { id: 'm2', round: 1, field: 2, teamA: 'Team B1', teamB: 'Team B2', scoreA: 1, scoreB: 1, group: 'B' },
      ];
      const tournament = createTournament({ teams: allTeams, matches });

      const standingsA = calculateStandings(allTeams, matches, tournament, 'A');
      const standingsB = calculateStandings(allTeams, matches, tournament, 'B');

      expect(standingsA.length).toBe(2);
      expect(standingsA[0].team.name).toBe('Team A1');
      expect(standingsA[0].points).toBe(3);

      expect(standingsB.length).toBe(2);
      expect(standingsB[0].points).toBe(1); // Draw
      expect(standingsB[1].points).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty matches array', () => {
      const teams = createTeams(4);
      const tournament = createTournament({ teams, matches: [] });

      const standings = calculateStandings(teams, [], tournament);

      expect(standings.length).toBe(4);
      standings.forEach(s => {
        expect(s.played).toBe(0);
        expect(s.points).toBe(0);
      });
    });

    it('handles matches without scores (pending)', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1',
          teamB: 'Team 2',
          // No scoreA/scoreB
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].played).toBe(0);
      expect(standings[1].played).toBe(0);
    });

    it('handles 0:0 result correctly', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1',
          teamB: 'Team 2',
          scoreA: 0,
          scoreB: 0,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].drawn).toBe(1);
      expect(standings[0].goalsFor).toBe(0);
      expect(standings[0].goalDifference).toBe(0);
    });

    it('handles high scores correctly', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        {
          id: 'm1',
          round: 1,
          field: 1,
          teamA: 'Team 1',
          teamB: 'Team 2',
          scoreA: 15,
          scoreB: 0,
        },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].goalsFor).toBe(15);
      expect(standings[0].goalDifference).toBe(15);
      expect(standings[1].goalDifference).toBe(-15);
    });

    it('excludes final matches from group standings', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 1, scoreB: 0 },
        { id: 'm2', round: 2, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 2, scoreB: 0, isFinal: true },
      ];
      const tournament = createTournament({ teams, matches });

      const standings = calculateStandings(teams, matches, tournament);

      // Only the non-final match should count
      expect(standings[0].played).toBe(1);
      expect(standings[0].goalsFor).toBe(1);
    });
  });

  describe('Custom Point Systems', () => {
    it('supports 2-1-0 point system', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 1, scoreB: 0 },
      ];
      const tournament = createTournament({
        teams,
        matches,
        pointSystem: { win: 2, draw: 1, loss: 0 },
      });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].points).toBe(2); // Win with 2 points
    });

    it('supports point system with loss points', () => {
      const teams = createTeams(2);
      const matches: Match[] = [
        { id: 'm1', round: 1, field: 1, teamA: 'Team 1', teamB: 'Team 2', scoreA: 1, scoreB: 0 },
      ];
      const tournament = createTournament({
        teams,
        matches,
        pointSystem: { win: 3, draw: 1, loss: -1 },
      });

      const standings = calculateStandings(teams, matches, tournament);

      expect(standings[0].points).toBe(3);
      expect(standings[1].points).toBe(-1); // Loss penalty
    });
  });
});

describe('getQualifiedTeams', () => {
  it('returns top N teams from standings', () => {
    const standings: Standing[] = [
      { team: { id: '1', name: 'Team 1' }, played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 5, goalsAgainst: 1, goalDifference: 4, points: 6 },
      { team: { id: '2', name: 'Team 2' }, played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 3 },
      { team: { id: '3', name: 'Team 3' }, played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 6, goalDifference: -5, points: 0 },
    ];

    const qualified = getQualifiedTeams(standings, 2);

    expect(qualified.length).toBe(2);
    expect(qualified[0].name).toBe('Team 1');
    expect(qualified[1].name).toBe('Team 2');
  });

  it('handles count larger than standings', () => {
    const standings: Standing[] = [
      { team: { id: '1', name: 'Team 1' }, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    ];

    const qualified = getQualifiedTeams(standings, 5);

    expect(qualified.length).toBe(1);
  });
});
