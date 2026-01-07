import { describe, it, expect } from 'vitest';
import {
  areAllGroupMatchesCompleted,
  needsPlayoffResolution,
  resolvePlayoffPairings,
  autoResolvePlayoffsIfReady,
  resolveBracketAfterPlayoffMatch,
} from '../../core/generators';
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

  /**
   * ============================================================================
   * BRACKET RESOLUTION TESTS (Semi → Final, QF → Place 5/7)
   * ============================================================================
   *
   * Diese Tests prüfen die kaskadierende Auflösung von Bracket-Platzhaltern:
   * - semi1-winner / semi1-loser → Finale / Spiel um Platz 3
   * - qf1-loser / qf2-loser → Spiel um Platz 5
   *
   * KONTEXT für Debugging:
   * - Platzhalter-Format: "{matchId}-{winner|loser}" (z.B. "semi1-winner")
   * - resolveBracketPlaceholder() parst diese mit Regex: /^(.+)-(winner|loser)$/
   * - Das referenzierte Match muss: isFinal=true, Ergebnis eingetragen, Teams aufgelöst sein
   *
   * Häufige Fehlerquellen:
   * 1. Match-ID stimmt nicht überein (z.B. "semi1" vs "semi-1")
   * 2. isFinal ist nicht gesetzt
   * 3. Teams des referenzierten Matches sind selbst noch Platzhalter
   * 4. Unentschieden (scoreA === scoreB) → kann nicht aufgelöst werden
   */
  describe('resolveBracketAfterPlayoffMatch - Bracket Resolution', () => {
    /**
     * Test: Halbfinal-Ergebnisse lösen Finale und Spiel um Platz 3 auf
     *
     * Szenario:
     * - semi1: Team A (2) vs Team B (1) → Team A gewinnt
     * - semi2: Team C (0) vs Team D (3) → Team D gewinnt
     * - Finale: semi1-winner vs semi2-winner → Team A vs Team D
     * - Platz 3: semi1-loser vs semi2-loser → Team B vs Team C
     */
    it('resolves final and third-place match after both semifinals are completed', () => {
      const teams: Team[] = [
        { id: 'team-a', name: 'Team A', group: 'A' },
        { id: 'team-b', name: 'Team B', group: 'A' },
        { id: 'team-c', name: 'Team C', group: 'B' },
        { id: 'team-d', name: 'Team D', group: 'B' },
      ];

      const matches: Match[] = [
        // Gruppenspiele (alle fertig)
        { id: 'g1', round: 1, field: 1, teamA: 'team-a', teamB: 'team-b', group: 'A', isFinal: false, scoreA: 1, scoreB: 0 },
        { id: 'g2', round: 1, field: 2, teamA: 'team-c', teamB: 'team-d', group: 'B', isFinal: false, scoreA: 0, scoreB: 1 },

        // Halbfinale (bereits aufgelöst UND Ergebnisse eingetragen)
        {
          id: 'semi1',
          round: 2,
          field: 1,
          teamA: 'team-a', // Aufgelöst!
          teamB: 'team-b', // Aufgelöst!
          isFinal: true,
          label: '1. Halbfinale',
          scoreA: 2, // Team A gewinnt
          scoreB: 1,
        },
        {
          id: 'semi2',
          round: 2,
          field: 2,
          teamA: 'team-c', // Aufgelöst!
          teamB: 'team-d', // Aufgelöst!
          isFinal: true,
          label: '2. Halbfinale',
          scoreA: 0, // Team D gewinnt
          scoreB: 3,
        },

        // Finale (noch mit Platzhaltern)
        {
          id: 'final',
          round: 3,
          field: 1,
          teamA: 'semi1-winner',
          teamB: 'semi2-winner',
          isFinal: true,
          finalType: 'final',
          label: 'Finale',
        },

        // Spiel um Platz 3 (noch mit Platzhaltern)
        {
          id: 'third-place',
          round: 3,
          field: 2,
          teamA: 'semi1-loser',
          teamB: 'semi2-loser',
          isFinal: true,
          finalType: 'thirdPlace',
          label: 'Spiel um Platz 3',
        },
      ];

      const tournament = createTournament(teams, matches);

      // Act: Bracket-Auflösung triggern
      const result = resolveBracketAfterPlayoffMatch(tournament);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.wasResolved).toBe(true);
      expect(result?.updatedMatches).toBe(2); // Finale + Platz 3

      // Finale prüfen
      const finalMatch = tournament.matches.find(m => m.id === 'final');
      expect(finalMatch?.teamA).toBe('team-a'); // semi1-winner
      expect(finalMatch?.teamB).toBe('team-d'); // semi2-winner

      // Platz 3 prüfen
      const thirdPlace = tournament.matches.find(m => m.id === 'third-place');
      expect(thirdPlace?.teamA).toBe('team-b'); // semi1-loser
      expect(thirdPlace?.teamB).toBe('team-c'); // semi2-loser
    });

    /**
     * Test: Viertelfinal-Ergebnisse lösen Spiel um Platz 5/7 auf
     *
     * Kontext: Bei 8+ Teams gibt es Viertelfinals und Platzierungsspiele
     * - qf1-loser vs qf2-loser → Spiel um Platz 5
     * - qf3-loser vs qf4-loser → Spiel um Platz 7
     */
    it('resolves 5th/7th place matches after quarterfinals are completed', () => {
      const teams: Team[] = [
        { id: 't1', name: 'T1', group: 'A' },
        { id: 't2', name: 'T2', group: 'A' },
        { id: 't3', name: 'T3', group: 'B' },
        { id: 't4', name: 'T4', group: 'B' },
        { id: 't5', name: 'T5', group: 'C' },
        { id: 't6', name: 'T6', group: 'C' },
        { id: 't7', name: 'T7', group: 'D' },
        { id: 't8', name: 'T8', group: 'D' },
      ];

      const matches: Match[] = [
        // Gruppenspiele (vereinfacht - alle fertig)
        { id: 'g1', round: 1, field: 1, teamA: 't1', teamB: 't2', group: 'A', isFinal: false, scoreA: 1, scoreB: 0 },
        { id: 'g2', round: 1, field: 2, teamA: 't3', teamB: 't4', group: 'B', isFinal: false, scoreA: 1, scoreB: 0 },
        { id: 'g3', round: 1, field: 1, teamA: 't5', teamB: 't6', group: 'C', isFinal: false, scoreA: 1, scoreB: 0 },
        { id: 'g4', round: 1, field: 2, teamA: 't7', teamB: 't8', group: 'D', isFinal: false, scoreA: 1, scoreB: 0 },

        // Viertelfinals (aufgelöst + Ergebnisse)
        { id: 'qf1', round: 2, field: 1, teamA: 't1', teamB: 't4', isFinal: true, scoreA: 2, scoreB: 1 }, // t1 wins, t4 loses
        { id: 'qf2', round: 2, field: 2, teamA: 't3', teamB: 't2', isFinal: true, scoreA: 0, scoreB: 3 }, // t2 wins, t3 loses
        { id: 'qf3', round: 2, field: 1, teamA: 't5', teamB: 't8', isFinal: true, scoreA: 1, scoreB: 2 }, // t8 wins, t5 loses
        { id: 'qf4', round: 2, field: 2, teamA: 't7', teamB: 't6', isFinal: true, scoreA: 4, scoreB: 0 }, // t7 wins, t6 loses

        // Spiel um Platz 5 (mit Platzhaltern)
        {
          id: 'place56',
          round: 3,
          field: 1,
          teamA: 'qf1-loser',
          teamB: 'qf2-loser',
          isFinal: true,
          finalType: 'fifthSixth',
          label: 'Spiel um Platz 5',
        },

        // Spiel um Platz 7 (mit Platzhaltern)
        {
          id: 'place78',
          round: 3,
          field: 2,
          teamA: 'qf3-loser',
          teamB: 'qf4-loser',
          isFinal: true,
          finalType: 'seventhEighth',
          label: 'Spiel um Platz 7',
        },
      ];

      const tournament = createTournament(teams, matches);

      // Act
      const result = resolveBracketAfterPlayoffMatch(tournament);

      // Assert
      expect(result?.wasResolved).toBe(true);
      expect(result?.updatedMatches).toBe(2);

      const place5 = tournament.matches.find(m => m.id === 'place56');
      expect(place5?.teamA).toBe('t4'); // qf1-loser
      expect(place5?.teamB).toBe('t3'); // qf2-loser

      const place7 = tournament.matches.find(m => m.id === 'place78');
      expect(place7?.teamA).toBe('t5'); // qf3-loser
      expect(place7?.teamB).toBe('t6'); // qf4-loser
    });

    /**
     * Test: Keine Auflösung wenn Halbfinale noch nicht gespielt
     *
     * Edge Case: Platzhalter können nicht aufgelöst werden wenn
     * das referenzierte Match noch kein Ergebnis hat.
     */
    it('does not resolve final when semifinals have no scores yet', () => {
      const teams: Team[] = [
        { id: 'team-a', name: 'Team A', group: 'A' },
        { id: 'team-b', name: 'Team B', group: 'A' },
        { id: 'team-c', name: 'Team C', group: 'B' },
        { id: 'team-d', name: 'Team D', group: 'B' },
      ];

      const matches: Match[] = [
        { id: 'g1', round: 1, field: 1, teamA: 'team-a', teamB: 'team-b', group: 'A', isFinal: false, scoreA: 1, scoreB: 0 },
        { id: 'g2', round: 1, field: 2, teamA: 'team-c', teamB: 'team-d', group: 'B', isFinal: false, scoreA: 0, scoreB: 1 },

        // Halbfinale aufgelöst, aber OHNE Ergebnis
        { id: 'semi1', round: 2, field: 1, teamA: 'team-a', teamB: 'team-b', isFinal: true, label: '1. HF' },
        { id: 'semi2', round: 2, field: 2, teamA: 'team-c', teamB: 'team-d', isFinal: true, label: '2. HF' },

        // Finale mit Platzhaltern
        { id: 'final', round: 3, field: 1, teamA: 'semi1-winner', teamB: 'semi2-winner', isFinal: true },
      ];

      const tournament = createTournament(teams, matches);

      // Call resolution - result not checked, we verify the mutation directly
      resolveBracketAfterPlayoffMatch(tournament);

      // Finale sollte NICHT aufgelöst werden (Semis haben keine Ergebnisse)
      const finalMatch = tournament.matches.find(m => m.id === 'final');
      expect(finalMatch?.teamA).toBe('semi1-winner'); // Immer noch Platzhalter
      expect(finalMatch?.teamB).toBe('semi2-winner');
    });

    /**
     * Test: Keine Auflösung bei Unentschieden
     *
     * Edge Case: Im K.O.-System kann es bei Unentschieden keinen
     * automatischen Sieger geben (Elfmeterschießen etc. nicht abgebildet)
     */
    it('does not resolve bracket when semifinal ended in a draw', () => {
      const teams: Team[] = [
        { id: 'team-a', name: 'Team A', group: 'A' },
        { id: 'team-b', name: 'Team B', group: 'A' },
        { id: 'team-c', name: 'Team C', group: 'B' },
        { id: 'team-d', name: 'Team D', group: 'B' },
      ];

      const matches: Match[] = [
        { id: 'g1', round: 1, field: 1, teamA: 'team-a', teamB: 'team-b', group: 'A', isFinal: false, scoreA: 1, scoreB: 0 },
        { id: 'g2', round: 1, field: 2, teamA: 'team-c', teamB: 'team-d', group: 'B', isFinal: false, scoreA: 0, scoreB: 1 },

        // Halbfinale mit UNENTSCHIEDEN
        { id: 'semi1', round: 2, field: 1, teamA: 'team-a', teamB: 'team-b', isFinal: true, scoreA: 1, scoreB: 1 }, // Draw!
        { id: 'semi2', round: 2, field: 2, teamA: 'team-c', teamB: 'team-d', isFinal: true, scoreA: 2, scoreB: 0 },

        { id: 'final', round: 3, field: 1, teamA: 'semi1-winner', teamB: 'semi2-winner', isFinal: true },
      ];

      const tournament = createTournament(teams, matches);

      resolveBracketAfterPlayoffMatch(tournament);

      // semi1-winner kann nicht aufgelöst werden (Unentschieden)
      const finalMatch = tournament.matches.find(m => m.id === 'final');
      expect(finalMatch?.teamA).toBe('semi1-winner'); // Nicht aufgelöst
      expect(finalMatch?.teamB).toBe('team-c'); // Aber semi2-winner wurde aufgelöst
    });

    /**
     * Test: Keine Auflösung wenn Teams noch Platzhalter sind
     *
     * Edge Case: semi1-winner kann nicht aufgelöst werden wenn
     * semi1.teamA selbst noch ein Platzhalter ist (z.B. "group-a-1st")
     */
    it('does not resolve bracket when semifinal teams are still placeholders', () => {
      const teams: Team[] = [
        { id: 'team-a', name: 'Team A', group: 'A' },
        { id: 'team-b', name: 'Team B', group: 'B' },
      ];

      const matches: Match[] = [
        { id: 'g1', round: 1, field: 1, teamA: 'team-a', teamB: 'team-b', group: 'A', isFinal: false, scoreA: 1, scoreB: 0 },

        // Halbfinale mit PLATZHALTERN (nicht aufgelöst), aber Ergebnis eingetragen
        {
          id: 'semi1',
          round: 2,
          field: 1,
          teamA: 'group-a-1st', // Noch Platzhalter!
          teamB: 'group-b-1st', // Noch Platzhalter!
          isFinal: true,
          scoreA: 2,
          scoreB: 1,
        },

        { id: 'final', round: 3, field: 1, teamA: 'semi1-winner', teamB: 'TBD', isFinal: true },
      ];

      const tournament = createTournament(teams, matches);

      resolveBracketAfterPlayoffMatch(tournament);

      // semi1-winner kann nicht aufgelöst werden (semi1.teamA ist selbst Platzhalter)
      const finalMatch = tournament.matches.find(m => m.id === 'final');
      expect(finalMatch?.teamA).toBe('semi1-winner'); // Nicht aufgelöst
    });
  });

  /**
   * ============================================================================
   * KASKADIERENDER AUFLÖSUNGS-TEST (Kompletter Turnier-Flow)
   * ============================================================================
   *
   * Testet den kompletten Flow:
   * 1. Gruppenphase → Halbfinale aufgelöst
   * 2. Halbfinale gespielt → Finale aufgelöst
   *
   * Dies simuliert einen echten Turnierverlauf.
   */
  describe('Cascading Resolution - Full Tournament Flow', () => {
    it('resolves playoffs in correct order: groups → semis → final', () => {
      const teams: Team[] = [
        { id: 'team-a', name: 'Team A', group: 'A' },
        { id: 'team-b', name: 'Team B', group: 'A' },
        { id: 'team-c', name: 'Team C', group: 'B' },
        { id: 'team-d', name: 'Team D', group: 'B' },
      ];

      const matches: Match[] = [
        // Gruppenspiele
        { id: 'g1', round: 1, field: 1, teamA: 'team-a', teamB: 'team-b', group: 'A', isFinal: false, scoreA: 2, scoreB: 0 },
        { id: 'g2', round: 1, field: 2, teamA: 'team-c', teamB: 'team-d', group: 'B', isFinal: false, scoreA: 1, scoreB: 3 },

        // Halbfinale (noch mit Gruppen-Platzhaltern)
        { id: 'semi1', round: 2, field: 1, teamA: 'group-a-1st', teamB: 'group-b-2nd', isFinal: true, label: 'HF 1' },
        { id: 'semi2', round: 2, field: 2, teamA: 'group-b-1st', teamB: 'group-a-2nd', isFinal: true, label: 'HF 2' },

        // Finale (mit Bracket-Platzhaltern)
        { id: 'final', round: 3, field: 1, teamA: 'semi1-winner', teamB: 'semi2-winner', isFinal: true, finalType: 'final' },
        { id: 'third', round: 3, field: 2, teamA: 'semi1-loser', teamB: 'semi2-loser', isFinal: true, finalType: 'thirdPlace' },
      ];

      const tournament = createTournament(teams, matches);

      // SCHRITT 1: Gruppenphase fertig → Halbfinale auflösen
      const step1 = autoResolvePlayoffsIfReady(tournament);
      expect(step1?.wasResolved).toBe(true);
      expect(step1?.updatedMatches).toBe(2); // Beide Halbfinale

      const semi1After1 = tournament.matches.find(m => m.id === 'semi1');
      const semi2After1 = tournament.matches.find(m => m.id === 'semi2');
      expect(semi1After1?.teamA).toBe('team-a'); // 1st A
      expect(semi1After1?.teamB).toBe('team-c'); // 2nd B
      expect(semi2After1?.teamA).toBe('team-d'); // 1st B
      expect(semi2After1?.teamB).toBe('team-b'); // 2nd A

      // Finale sollte noch Platzhalter haben (Semis nicht gespielt)
      const finalAfter1 = tournament.matches.find(m => m.id === 'final');
      expect(finalAfter1?.teamA).toBe('semi1-winner');

      // SCHRITT 2: Halbfinale spielen (Ergebnisse eintragen)
      const semi1 = tournament.matches.find(m => m.id === 'semi1');
      const semi2 = tournament.matches.find(m => m.id === 'semi2');
      if (semi1) { semi1.scoreA = 3; semi1.scoreB = 1; } // team-a gewinnt
      if (semi2) { semi2.scoreA = 2; semi2.scoreB = 0; } // team-d gewinnt

      // SCHRITT 3: Bracket-Auflösung nach Halbfinale
      const step2 = resolveBracketAfterPlayoffMatch(tournament);
      expect(step2?.wasResolved).toBe(true);
      expect(step2?.updatedMatches).toBe(2); // Finale + Platz 3

      // Finale prüfen
      const finalAfter2 = tournament.matches.find(m => m.id === 'final');
      expect(finalAfter2?.teamA).toBe('team-a'); // semi1-winner
      expect(finalAfter2?.teamB).toBe('team-d'); // semi2-winner

      // Platz 3 prüfen
      const thirdAfter2 = tournament.matches.find(m => m.id === 'third');
      expect(thirdAfter2?.teamA).toBe('team-c'); // semi1-loser (war team-b, aber team-c hat verloren)
      expect(thirdAfter2?.teamB).toBe('team-b'); // semi2-loser
    });
  });
});
