import { describe, it, expect } from 'vitest';
import {
  areAllGroupMatchesCompleted,
  needsPlayoffResolution,
  resolvePlayoffPairings,
  autoResolvePlayoffsIfReady,
} from '../playoffResolver';
import { Tournament, Team, Match } from '../../types/tournament';

describe('Playoff Resolver - DEF-003 Fix', () => {
  // Helper: Create basic tournament structure
  const createTournament = (teams: Team[], matches: Match[]): Tournament => ({
    id: 'test-tournament-1',
    status: 'draft',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: 2,
    numberOfTeams: 4,
    groupSystem: 'groupsAndFinals',
    numberOfGroups: 2,
    groupPhaseGameDuration: 10,
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    placementLogic: [
      { id: 'points', label: 'Punkte', enabled: true },
      { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
      { id: 'goalsFor', label: 'Erzielte Tore', enabled: true },
    ],
    finals: {
      final: true,
      thirdPlace: false,
      fifthSixth: false,
      seventhEighth: false,
    },
    title: 'Test Tournament',
    ageClass: 'U12',
    date: '2024-01-01',
    timeSlot: '09:00',
    location: { name: 'Test Hall' },
    teams,
    matches,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  });

  // Helper: Create teams
  const createTeams = (): Team[] => [
    { id: 'team-1', name: 'Team A1', group: 'Gruppe A' },
    { id: 'team-2', name: 'Team A2', group: 'Gruppe A' },
    { id: 'team-3', name: 'Team B1', group: 'Gruppe B' },
    { id: 'team-4', name: 'Team B2', group: 'Gruppe B' },
  ];

  describe('areAllGroupMatchesCompleted', () => {
    it('returns false when no matches exist', () => {
      const tournament = createTournament(createTeams(), []);
      expect(areAllGroupMatchesCompleted(tournament)).toBe(false);
    });

    it('returns false when group matches are incomplete', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 2,
          scoreB: 1,
        },
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          // No scores - incomplete
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      expect(areAllGroupMatchesCompleted(tournament)).toBe(false);
    });

    it('returns true when all group matches are completed', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 2,
          scoreB: 1,
        },
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          scoreA: 3,
          scoreB: 0,
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      expect(areAllGroupMatchesCompleted(tournament)).toBe(true);
    });

    it('ignores playoff matches when checking group completion', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 2,
          scoreB: 1,
        },
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          scoreA: 3,
          scoreB: 0,
        },
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'group-a-1st',
          teamB: 'group-b-2nd',
          isFinal: true,
          label: 'Halbfinale 1',
          // No scores - but shouldn't affect group completion check
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      expect(areAllGroupMatchesCompleted(tournament)).toBe(true);
    });
  });

  describe('needsPlayoffResolution', () => {
    it('returns false when no playoff matches exist', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      expect(needsPlayoffResolution(tournament)).toBe(false);
    });

    it('returns true when playoff matches have group placeholders', () => {
      const matches: Match[] = [
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'group-a-1st',
          teamB: 'group-b-2nd',
          isFinal: true,
          label: 'Halbfinale 1',
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      expect(needsPlayoffResolution(tournament)).toBe(true);
    });

    it('returns true when playoff matches have TBD placeholders', () => {
      const matches: Match[] = [
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'TBD',
          teamB: 'TBD',
          isFinal: true,
          label: 'Finale',
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      expect(needsPlayoffResolution(tournament)).toBe(true);
    });

    it('returns false when playoff matches are already resolved', () => {
      const matches: Match[] = [
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-3',
          isFinal: true,
          label: 'Finale',
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      expect(needsPlayoffResolution(tournament)).toBe(false);
    });
  });

  describe('resolvePlayoffPairings', () => {
    it('returns not resolved when group phase is incomplete', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          // No scores
        },
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'group-a-1st',
          teamB: 'group-b-1st',
          isFinal: true,
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      const result = resolvePlayoffPairings(tournament);

      expect(result.wasResolved).toBe(false);
      expect(result.updatedMatches).toBe(0);
      expect(result.message).toContain('noch nicht abgeschlossen');
    });

    it('returns not resolved when playoffs are already resolved', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 2,
          scoreB: 1,
        },
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          scoreA: 3,
          scoreB: 0,
        },
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'team-1', // Already resolved
          teamB: 'team-3', // Already resolved
          isFinal: true,
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      const result = resolvePlayoffPairings(tournament);

      expect(result.wasResolved).toBe(false);
      expect(result.updatedMatches).toBe(0);
      expect(result.message).toContain('bereits aufgelöst');
    });

    it('resolves playoff pairings based on group standings', () => {
      const teams = createTeams();
      const matches: Match[] = [
        // Group A: team-1 wins (3 points), team-2 loses (0 points)
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 2,
          scoreB: 1,
        },
        // Group B: team-3 wins (3 points), team-4 loses (0 points)
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          scoreA: 3,
          scoreB: 0,
        },
        // Playoff: 1st A vs 2nd B
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'group-a-1st',
          teamB: 'group-b-2nd',
          isFinal: true,
          label: 'Halbfinale 1',
        },
        // Playoff: 1st B vs 2nd A
        {
          id: 'final-2',
          round: 2,
          field: 2,
          teamA: 'group-b-1st',
          teamB: 'group-a-2nd',
          isFinal: true,
          label: 'Halbfinale 2',
        },
      ];

      const tournament = createTournament(teams, matches);
      const result = resolvePlayoffPairings(tournament);

      expect(result.wasResolved).toBe(true);
      expect(result.updatedMatches).toBe(2);
      expect(result.updatedMatchIds).toEqual(['final-1', 'final-2']);

      // Check that playoffs are resolved correctly
      const final1 = tournament.matches.find(m => m.id === 'final-1');
      const final2 = tournament.matches.find(m => m.id === 'final-2');

      expect(final1?.teamA).toBe('team-1'); // 1st in Group A
      expect(final1?.teamB).toBe('team-4'); // 2nd in Group B
      expect(final2?.teamA).toBe('team-3'); // 1st in Group B
      expect(final2?.teamB).toBe('team-2'); // 2nd in Group A
    });

    it('resolves based on goal difference when points are equal', () => {
      const teams: Team[] = [
        { id: 'team-1', name: 'Team A1', group: 'Gruppe A' },
        { id: 'team-2', name: 'Team A2', group: 'Gruppe A' },
        { id: 'team-3', name: 'Team A3', group: 'Gruppe A' },
      ];

      const matches: Match[] = [
        // Round 1: team-1 vs team-2 (team-1 wins big)
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 5,
          scoreB: 0,
        },
        // Round 2: team-1 vs team-3 (team-3 wins)
        {
          id: 'match-2',
          round: 2,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-3',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 0,
          scoreB: 1,
        },
        // Round 3: team-2 vs team-3 (team-2 wins big)
        {
          id: 'match-3',
          round: 3,
          field: 1,
          teamA: 'team-2',
          teamB: 'team-3',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 4,
          scoreB: 0,
        },
        // Playoff placeholder
        {
          id: 'final-1',
          round: 4,
          field: 1,
          teamA: 'group-a-1st',
          teamB: 'TBD',
          isFinal: true,
          label: 'Finale',
        },
      ];

      const tournament = createTournament(teams, matches);
      const result = resolvePlayoffPairings(tournament);

      expect(result.wasResolved).toBe(true);

      // All teams have 3 points (1 win each)
      // team-1: GD = +4 (5-0, 0-1)
      // team-2: GD = +3 (0-5, 4-0)
      // team-3: GD = 0 (1-0, 0-4)
      // So team-1 should be 1st
      const final = tournament.matches.find(m => m.id === 'final-1');
      expect(final?.teamA).toBe('team-1');
    });
  });

  describe('autoResolvePlayoffsIfReady', () => {
    it('returns null when group phase is not complete', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          // No scores
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      const result = autoResolvePlayoffsIfReady(tournament);

      expect(result).toBeNull();
    });

    it('returns null when playoffs are already resolved', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 2,
          scoreB: 1,
        },
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          scoreA: 3,
          scoreB: 0,
        },
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-3',
          isFinal: true,
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      const result = autoResolvePlayoffsIfReady(tournament);

      expect(result).toBeNull();
    });

    it('resolves playoffs when group phase is complete and resolution is needed', () => {
      const matches: Match[] = [
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 2,
          scoreB: 1,
        },
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          scoreA: 3,
          scoreB: 0,
        },
        {
          id: 'final-1',
          round: 2,
          field: 1,
          teamA: 'group-a-1st',
          teamB: 'group-b-1st',
          isFinal: true,
        },
      ];

      const tournament = createTournament(createTeams(), matches);
      const result = autoResolvePlayoffsIfReady(tournament);

      expect(result).not.toBeNull();
      expect(result?.wasResolved).toBe(true);
      expect(result?.updatedMatches).toBe(1);
    });
  });

  describe('Integration Test - Complete Tournament Flow', () => {
    it('correctly resolves complex 4-team, 2-group tournament', () => {
      const teams = createTeams();
      const matches: Match[] = [
        // Group A matches
        {
          id: 'match-1',
          round: 1,
          field: 1,
          teamA: 'team-1',
          teamB: 'team-2',
          group: 'Gruppe A',
          isFinal: false,
          scoreA: 3,
          scoreB: 1, // team-1 wins
        },
        // Group B matches
        {
          id: 'match-2',
          round: 1,
          field: 2,
          teamA: 'team-3',
          teamB: 'team-4',
          group: 'Gruppe B',
          isFinal: false,
          scoreA: 2,
          scoreB: 2, // Draw
        },
        // Playoffs: Cross-bracket (1st A vs 2nd B, 1st B vs 2nd A)
        {
          id: 'semi-1',
          round: 2,
          field: 1,
          teamA: 'group-a-1st',
          teamB: 'group-b-2nd',
          isFinal: true,
          label: 'Halbfinale 1',
        },
        {
          id: 'semi-2',
          round: 2,
          field: 2,
          teamA: 'group-b-1st',
          teamB: 'group-a-2nd',
          isFinal: true,
          label: 'Halbfinale 2',
        },
        {
          id: 'final',
          round: 3,
          field: 1,
          teamA: 'TBD',
          teamB: 'TBD',
          isFinal: true,
          label: 'Finale',
        },
      ];

      const tournament = createTournament(teams, matches);

      // Step 1: Verify group phase is complete
      expect(areAllGroupMatchesCompleted(tournament)).toBe(true);

      // Step 2: Verify playoffs need resolution
      expect(needsPlayoffResolution(tournament)).toBe(true);

      // Step 3: Auto-resolve
      const result = autoResolvePlayoffsIfReady(tournament);

      expect(result).not.toBeNull();
      expect(result?.wasResolved).toBe(true);
      expect(result?.updatedMatches).toBe(2); // Only semi-finals resolved (final still TBD)

      // Step 4: Verify correct pairings
      const semi1 = tournament.matches.find(m => m.id === 'semi-1');
      const semi2 = tournament.matches.find(m => m.id === 'semi-2');

      // Group A: team-1 (3 pts) > team-2 (0 pts)
      // Group B: Draw, so need to check goal difference
      // team-3: 2 goals for, 2 against = 0 GD
      // team-4: 2 goals for, 2 against = 0 GD
      // Since they're equal, first in array wins (team-3)

      expect(semi1?.teamA).toBe('team-1'); // 1st Group A
      expect(semi1?.teamB).toBe('team-4'); // 2nd Group B (or team-3 if equal)

      expect(semi2?.teamA).toBe('team-3'); // 1st Group B (or team-4 if equal)
      expect(semi2?.teamB).toBe('team-2'); // 2nd Group A

      // Final should still be TBD
      const final = tournament.matches.find(m => m.id === 'final');
      expect(final?.teamA).toBe('TBD');
      expect(final?.teamB).toBe('TBD');
    });
  });
});
