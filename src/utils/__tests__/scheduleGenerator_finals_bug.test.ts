/**
 * Test to reproduce the "Finals not showing in Management Tab" bug
 *
 * The bug: When a tournament with groups + finals is created, finals are shown in the preview,
 * but after publishing and loading in the Management Tab, finals are missing.
 *
 * Root cause hypothesis: The `createPhases` function slices based on position,
 * but the matches in the persisted tournament might not be in the expected order
 * (all group matches first, then finals).
 */
import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '../../core/generators';
import { Tournament, Team, Match } from '../../types/tournament';

// Helper to create teams with groups
const createTeamsWithGroups = (teamsPerGroup: number, groups: string[]): Team[] => {
  const teams: Team[] = [];
  groups.forEach(group => {
    for (let i = 0; i < teamsPerGroup; i++) {
      teams.push({
        id: `team-${group}-${i + 1}`,
        name: `Team ${group}${i + 1}`,
        group,
      });
    }
  });
  return teams;
};

// Helper to create a minimal tournament config
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
  numberOfTeams: 8,
  numberOfFields: 1,
  groupSystem: 'groupsAndFinals',
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  minRestSlots: 0,
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

describe('Finals Bug Reproduction', () => {
  describe('Fresh tournament (no persisted matches)', () => {
    it('generates finals correctly for fresh tournament', () => {
      const teams = createTeamsWithGroups(4, ['A', 'B']);
      const tournament = createTournament({
        teams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
      });

      const schedule = generateFullSchedule(tournament);

      // Check phases
      const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
      const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');

      expect(groupPhase).toBeDefined();
      expect(groupPhase?.matches.length).toBe(12); // 6 matches per group

      // Finals should exist
      expect(finalPhases.length).toBeGreaterThan(0);

      const totalFinalMatches = finalPhases.reduce((sum, p) => sum + p.matches.length, 0);
      expect(totalFinalMatches).toBeGreaterThanOrEqual(2); // At least semi + final
    });
  });

  describe('Persisted tournament (simulating load from localStorage)', () => {
    it('should show finals when tournament with isFinal matches is loaded', () => {
      const teams = createTeamsWithGroups(4, ['A', 'B']);

      // Step 1: Generate schedule for fresh tournament (like in Preview)
      const freshTournament = createTournament({
        teams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
      });

      const freshSchedule = generateFullSchedule(freshTournament);

      // Step 2: Simulate what TournamentCreationService.publish() does
      const persistedMatches: Match[] = freshSchedule.allMatches.map((scheduledMatch, index) => ({
        id: scheduledMatch.id,
        round: Math.floor(index / freshTournament.numberOfFields) + 1,
        field: scheduledMatch.field,
        slot: scheduledMatch.slot,
        teamA: scheduledMatch.originalTeamA,
        teamB: scheduledMatch.originalTeamB,
        scoreA: scheduledMatch.scoreA,
        scoreB: scheduledMatch.scoreB,
        group: scheduledMatch.group,
        isFinal: scheduledMatch.phase !== 'groupStage', // This is how publish sets it
        finalType: scheduledMatch.finalType,
        label: scheduledMatch.label,
        scheduledTime: scheduledMatch.startTime,
        referee: scheduledMatch.referee,
        // NOTE: 'phase' is NOT saved! This might be the bug.
      }));

      // Verify some finals were marked
      const finalsInPersisted = persistedMatches.filter(m => m.isFinal);
      expect(finalsInPersisted.length).toBeGreaterThan(0);
      console.log(`Persisted ${finalsInPersisted.length} final matches`);

      // Step 3: Create tournament with persisted matches (like loading from localStorage)
      const loadedTournament = createTournament({
        teams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
        matches: persistedMatches,
      });

      // Step 4: Generate schedule from loaded tournament (like useTournamentManager does)
      const loadedSchedule = generateFullSchedule(loadedTournament);

      // THE BUG: Finals should still be visible in phases
      const groupPhase = loadedSchedule.phases.find(p => p.name === 'groupStage');
      const finalPhases = loadedSchedule.phases.filter(p => p.name !== 'groupStage');

      console.log('Phases after loading:', loadedSchedule.phases.map(p => ({ name: p.name, matches: p.matches.length })));

      expect(groupPhase).toBeDefined();
      expect(groupPhase?.matches.length).toBe(12);

      // THIS IS THE CRITICAL ASSERTION - finals should still exist
      expect(finalPhases.length).toBeGreaterThan(0);

      const totalFinalMatches = finalPhases.reduce((sum, p) => sum + p.matches.length, 0);
      expect(totalFinalMatches).toBeGreaterThanOrEqual(2);
    });

    it('should handle matches with phase property persisted', () => {
      const teams = createTeamsWithGroups(4, ['A', 'B']);

      // Generate fresh schedule
      const freshTournament = createTournament({
        teams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
      });

      const freshSchedule = generateFullSchedule(freshTournament);

      // Simulate saving WITH phase property (potential fix)
      const persistedMatchesWithPhase: Match[] = freshSchedule.allMatches.map((scheduledMatch, index) => ({
        id: scheduledMatch.id,
        round: Math.floor(index / freshTournament.numberOfFields) + 1,
        field: scheduledMatch.field,
        slot: scheduledMatch.slot,
        teamA: scheduledMatch.originalTeamA,
        teamB: scheduledMatch.originalTeamB,
        scoreA: scheduledMatch.scoreA,
        scoreB: scheduledMatch.scoreB,
        group: scheduledMatch.group,
        isFinal: scheduledMatch.phase !== 'groupStage',
        finalType: scheduledMatch.finalType,
        label: scheduledMatch.label,
        scheduledTime: scheduledMatch.startTime,
        referee: scheduledMatch.referee,
        phase: scheduledMatch.phase, // INCLUDE PHASE!
      }));

      const loadedTournament = createTournament({
        teams,
        numberOfTeams: 8,
        numberOfGroups: 2,
        groupSystem: 'groupsAndFinals',
        finalsConfig: { preset: 'top-4' },
        matches: persistedMatchesWithPhase,
      });

      const loadedSchedule = generateFullSchedule(loadedTournament);

      const finalPhases = loadedSchedule.phases.filter(p => p.name !== 'groupStage');

      console.log('Phases with phase property:', loadedSchedule.phases.map(p => ({ name: p.name, matches: p.matches.length })));

      // With phase saved, this should definitely work
      expect(finalPhases.length).toBeGreaterThan(0);
    });
  });
});
