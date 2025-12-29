/**
 * Test fixture: Tournament with matches for E2E testing
 *
 * This creates a minimal but complete tournament structure that works
 * with the app's scheduleGenerator and LiveCockpit components.
 */

export const STORAGE_KEY_TOURNAMENTS = 'tournaments';

export function createTestTournament() {
  const now = new Date().toISOString();
  return {
    id: 'e2e-test-tournament',
    title: 'E2E Test Turnier',
    status: 'published',
    sportType: 'hallenfussball',
    tournamentType: 'group_only',
    createdAt: now,
    updatedAt: now,
    settings: {
      matchDurationMinutes: 10,
      breakDurationMinutes: 2,
      numberOfGroups: 1,
      teamsPerGroup: 4,
      pointsPerWin: 3,
      pointsPerDraw: 1,
      pointsPerLoss: 0,
      numberOfFields: 1,
      simultaneousMatches: 1,
    },
    teams: [
      { id: 'team-1', name: 'FC Test A', groupLabel: 'A' },
      { id: 'team-2', name: 'FC Test B', groupLabel: 'A' },
      { id: 'team-3', name: 'FC Test C', groupLabel: 'A' },
      { id: 'team-4', name: 'FC Test D', groupLabel: 'A' },
    ],
    matches: [
      {
        id: 'match-1',
        number: 1,
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        scheduledTime: '10:00',
        field: 1,
        phase: 'groupStage',
        group: 'A',
      },
      {
        id: 'match-2',
        number: 2,
        homeTeamId: 'team-3',
        awayTeamId: 'team-4',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        scheduledTime: '10:15',
        field: 1,
        phase: 'groupStage',
        group: 'A',
      },
      {
        id: 'match-3',
        number: 3,
        homeTeamId: 'team-1',
        awayTeamId: 'team-3',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        scheduledTime: '10:30',
        field: 1,
        phase: 'groupStage',
        group: 'A',
      },
      {
        id: 'match-4',
        number: 4,
        homeTeamId: 'team-2',
        awayTeamId: 'team-4',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        scheduledTime: '10:45',
        field: 1,
        phase: 'groupStage',
        group: 'A',
      },
    ],
  };
}

/**
 * Seed localStorage with test tournament data
 * Usage in Playwright:
 *   await page.evaluate(seedTestTournament);
 */
export function seedTestTournament() {
  const tournament = {
    id: 'e2e-test-tournament',
    title: 'E2E Test Turnier',
    status: 'published',
    sportType: 'hallenfussball',
    tournamentType: 'group_only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      matchDurationMinutes: 10,
      breakDurationMinutes: 2,
      numberOfGroups: 1,
      teamsPerGroup: 4,
      pointsPerWin: 3,
      pointsPerDraw: 1,
      pointsPerLoss: 0,
      numberOfFields: 1,
      simultaneousMatches: 1,
    },
    teams: [
      { id: 'team-1', name: 'FC Test A', groupLabel: 'A' },
      { id: 'team-2', name: 'FC Test B', groupLabel: 'A' },
      { id: 'team-3', name: 'FC Test C', groupLabel: 'A' },
      { id: 'team-4', name: 'FC Test D', groupLabel: 'A' },
    ],
    matches: [
      {
        id: 'match-1',
        number: 1,
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        scheduledTime: '10:00',
        field: 1,
        phase: 'groupStage',
        group: 'A',
      },
      {
        id: 'match-2',
        number: 2,
        homeTeamId: 'team-3',
        awayTeamId: 'team-4',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        scheduledTime: '10:15',
        field: 1,
        phase: 'groupStage',
        group: 'A',
      },
    ],
  };
  localStorage.setItem('tournaments', JSON.stringify([tournament]));
}

/**
 * Clear test data from localStorage
 */
export function clearTestTournament() {
  localStorage.removeItem('tournaments');
  localStorage.removeItem('liveMatches-e2e-test-tournament');
}
