/**
 * Mock Tournament Data for Local Testing
 *
 * 7 Vereine mit realistischen Namen und Ergebnissen
 * Zum Testen der PublicLiveView ohne Supabase
 */

import { Tournament, Team, Match, RuntimeMatchEvent } from '../types/tournament';
import { teamSlot, pendingSlot } from '../core/models/matchSlot';
import type { MatchSlot } from '../core/models/schemas/MatchSlotSchema';

// Keine Importe aus `src/test/*`. B-06: nach dem Löschen des LocalTestScreen nur noch von Tests genutzt (Umzug nach src/test/ offen).
/** Deterministische UUID für Mock-Teams und -Spiele (Team-IDs sind UUIDs, siehe `TeamIdSchema`). */
function testUuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function slots(slotA: MatchSlot, slotB: MatchSlot): Pick<Match, 'slotA' | 'slotB'> {
  return { slotA, slotB };
}
const vs = (teamIdA: string, teamIdB: string) => slots(teamSlot(teamIdA), teamSlot(teamIdB));
const groupRank = (group: string, rank: number): MatchSlot => pendingSlot({ kind: 'groupRank', group, rank });
const resultOf = (matchId: string, role: 'winner' | 'loser'): MatchSlot =>
  pendingSlot({ kind: 'matchResult', matchId, role });

// Halbfinal-IDs (UUIDs: Finalseiten verweisen darauf)
const HF1_ID = testUuid(101);
const HF2_ID = testUuid(102);

// 7 realistische deutsche Jugendvereine
const MOCK_TEAMS: Team[] = [
  { id: testUuid(1), name: 'TSV Grünwald', group: 'A', colors: { primary: '#2E7D32' } },
  { id: testUuid(2), name: 'FC Bayern München II', group: 'A', colors: { primary: '#DC052D' } },
  { id: testUuid(3), name: 'SpVgg Unterhaching', group: 'A', colors: { primary: '#E53935' } },
  { id: testUuid(4), name: 'SV Heimstetten', group: 'A', colors: { primary: '#1565C0' } },
  { id: testUuid(5), name: 'TSV 1860 München II', group: 'B', colors: { primary: '#0D47A1' } },
  { id: testUuid(6), name: 'FC Deisenhofen', group: 'B', colors: { primary: '#FF6F00' } },
  { id: testUuid(7), name: 'SC Fürstenfeldbruck', group: 'B', colors: { primary: '#4A148C' } },
];

// Event ID counter
let eventIdCounter = 1;

// Helper: Create a RuntimeMatchEvent for a goal
function createGoalEvent(
  teamId: string,
  teamName: string,
  homeScore: number,
  awayScore: number,
  minute: number,
  playerNumber?: number
): RuntimeMatchEvent {
  return {
    id: `evt-${eventIdCounter++}`,
    timestampSeconds: minute * 60,
    type: 'GOAL',
    payload: {
      teamId,
      teamName,
      direction: 'INC',
      playerNumber,
    },
    scoreAfter: { home: homeScore, away: awayScore },
  };
}

// Erstelle Matches mit verschiedenen Status
function createMockMatches(): Match[] {
  const now = new Date();
  const matches: Match[] = [];

  // Gruppe A - Spiele
  // Spiel 1: TSV Grünwald vs FC Bayern München II - FINISHED (3:2)
  const match1Time = new Date(now.getTime() - 60 * 60 * 1000);
  matches.push({
    id: 'match-1',
    matchNumber: 1,
    ...vs(testUuid(1), testUuid(2)),
    scoreA: 3,
    scoreB: 2,
    round: 1,
    slot: 0,
    field: 1,
    group: 'A',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'finished',
    scheduledTime: match1Time,
    finishedAt: new Date(match1Time.getTime() + 12 * 60 * 1000).toISOString(),
    events: [
      createGoalEvent(testUuid(1), 'TSV Grünwald', 1, 0, 3, 10),
      createGoalEvent(testUuid(2), 'FC Bayern München II', 1, 1, 5, 7),
      createGoalEvent(testUuid(1), 'TSV Grünwald', 2, 1, 7, 9),
      createGoalEvent(testUuid(2), 'FC Bayern München II', 2, 2, 9, 11),
      createGoalEvent(testUuid(1), 'TSV Grünwald', 3, 2, 11, 10),
    ],
  });

  // Spiel 2: SpVgg Unterhaching vs SV Heimstetten - FINISHED (1:1)
  const match2Time = new Date(now.getTime() - 50 * 60 * 1000);
  matches.push({
    id: 'match-2',
    matchNumber: 2,
    ...vs(testUuid(3), testUuid(4)),
    scoreA: 1,
    scoreB: 1,
    round: 1,
    slot: 0,
    field: 2,
    group: 'A',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'finished',
    scheduledTime: match2Time,
    finishedAt: new Date(match2Time.getTime() + 12 * 60 * 1000).toISOString(),
    events: [
      createGoalEvent(testUuid(3), 'SpVgg Unterhaching', 1, 0, 4, 8),
      createGoalEvent(testUuid(4), 'SV Heimstetten', 1, 1, 8, 5),
    ],
  });

  // Spiel 3: TSV Grünwald vs SpVgg Unterhaching - RUNNING (2:1)
  const match3Time = new Date(now.getTime() - 5 * 60 * 1000);
  matches.push({
    id: 'match-3',
    matchNumber: 3,
    ...vs(testUuid(1), testUuid(3)),
    scoreA: 2,
    scoreB: 1,
    round: 2,
    slot: 1,
    field: 1,
    group: 'A',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'running',
    scheduledTime: match3Time,
    timerStartTime: new Date().toISOString(),
    timerElapsedSeconds: 300,
    events: [
      createGoalEvent(testUuid(1), 'TSV Grünwald', 1, 0, 2, 10),
      createGoalEvent(testUuid(3), 'SpVgg Unterhaching', 1, 1, 3, 8),
      createGoalEvent(testUuid(1), 'TSV Grünwald', 2, 1, 5, 9),
    ],
  });

  // Spiel 4: FC Bayern München II vs SV Heimstetten - RUNNING (0:0)
  matches.push({
    id: 'match-4',
    matchNumber: 4,
    ...vs(testUuid(2), testUuid(4)),
    scoreA: 0,
    scoreB: 0,
    round: 2,
    slot: 1,
    field: 2,
    group: 'A',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'running',
    scheduledTime: match3Time,
    timerStartTime: new Date().toISOString(),
    timerElapsedSeconds: 180,
    events: [],
  });

  // Spiel 5: TSV Grünwald vs SV Heimstetten - SCHEDULED
  const match5Time = new Date(now.getTime() + 15 * 60 * 1000);
  matches.push({
    id: 'match-5',
    matchNumber: 5,
    ...vs(testUuid(1), testUuid(4)),
    scoreA: undefined,
    scoreB: undefined,
    round: 3,
    slot: 2,
    field: 1,
    group: 'A',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'scheduled',
    scheduledTime: match5Time,
    events: [],
  });

  // Spiel 6: FC Bayern München II vs SpVgg Unterhaching - SCHEDULED
  matches.push({
    id: 'match-6',
    matchNumber: 6,
    ...vs(testUuid(2), testUuid(3)),
    scoreA: undefined,
    scoreB: undefined,
    round: 3,
    slot: 2,
    field: 2,
    group: 'A',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'scheduled',
    scheduledTime: match5Time,
    events: [],
  });

  // Gruppe B - Spiele
  // Spiel 7: TSV 1860 München II vs FC Deisenhofen - FINISHED (4:0)
  const match7Time = new Date(now.getTime() - 45 * 60 * 1000);
  matches.push({
    id: 'match-7',
    matchNumber: 7,
    ...vs(testUuid(5), testUuid(6)),
    scoreA: 4,
    scoreB: 0,
    round: 1,
    slot: 0,
    field: 1,
    group: 'B',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'finished',
    scheduledTime: match7Time,
    finishedAt: new Date(match7Time.getTime() + 12 * 60 * 1000).toISOString(),
    events: [
      createGoalEvent(testUuid(5), 'TSV 1860 München II', 1, 0, 2, 11),
      createGoalEvent(testUuid(5), 'TSV 1860 München II', 2, 0, 4, 7),
      createGoalEvent(testUuid(5), 'TSV 1860 München II', 3, 0, 7, 11),
      createGoalEvent(testUuid(5), 'TSV 1860 München II', 4, 0, 10, 9),
    ],
  });

  // Spiel 8: FC Deisenhofen vs SC Fürstenfeldbruck - FINISHED (2:3)
  const match8Time = new Date(now.getTime() - 30 * 60 * 1000);
  matches.push({
    id: 'match-8',
    matchNumber: 8,
    ...vs(testUuid(6), testUuid(7)),
    scoreA: 2,
    scoreB: 3,
    round: 2,
    slot: 1,
    field: 1,
    group: 'B',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'finished',
    scheduledTime: match8Time,
    finishedAt: new Date(match8Time.getTime() + 12 * 60 * 1000).toISOString(),
    events: [
      createGoalEvent(testUuid(7), 'SC Fürstenfeldbruck', 0, 1, 3, 10),
      createGoalEvent(testUuid(6), 'FC Deisenhofen', 1, 1, 5, 8),
      createGoalEvent(testUuid(7), 'SC Fürstenfeldbruck', 1, 2, 7, 6),
      createGoalEvent(testUuid(6), 'FC Deisenhofen', 2, 2, 9, 8),
      createGoalEvent(testUuid(7), 'SC Fürstenfeldbruck', 2, 3, 11, 10),
    ],
  });

  // Spiel 9: TSV 1860 München II vs SC Fürstenfeldbruck - SCHEDULED
  const match9Time = new Date(now.getTime() + 25 * 60 * 1000);
  matches.push({
    id: 'match-9',
    matchNumber: 9,
    ...vs(testUuid(5), testUuid(7)),
    scoreA: undefined,
    scoreB: undefined,
    round: 3,
    slot: 3,
    field: 1,
    group: 'B',
    phase: 'groupStage',
    isFinal: false,
    matchStatus: 'scheduled',
    scheduledTime: match9Time,
    events: [],
  });

  // Halbfinale - SCHEDULED
  const hfTime = new Date(now.getTime() + 45 * 60 * 1000);
  matches.push({
    id: HF1_ID,
    matchNumber: 10,
    ...slots(groupRank('A', 1), groupRank('B', 2)),
    scoreA: undefined,
    scoreB: undefined,
    round: 4,
    slot: 4,
    field: 1,
    phase: 'semifinal',
    isFinal: true,
    matchStatus: 'scheduled',
    scheduledTime: hfTime,
    events: [],
    label: 'Halbfinale 1',
  });

  matches.push({
    id: HF2_ID,
    matchNumber: 11,
    ...slots(groupRank('B', 1), groupRank('A', 2)),
    scoreA: undefined,
    scoreB: undefined,
    round: 4,
    slot: 4,
    field: 2,
    phase: 'semifinal',
    isFinal: true,
    matchStatus: 'scheduled',
    scheduledTime: hfTime,
    events: [],
    label: 'Halbfinale 2',
  });

  // Finale - SCHEDULED
  const finalTime = new Date(now.getTime() + 60 * 60 * 1000);
  matches.push({
    id: 'match-final',
    matchNumber: 12,
    ...slots(resultOf(HF1_ID, 'winner'), resultOf(HF2_ID, 'winner')),
    scoreA: undefined,
    scoreB: undefined,
    round: 5,
    slot: 5,
    field: 1,
    phase: 'final',
    isFinal: true,
    finalType: 'final',
    matchStatus: 'scheduled',
    scheduledTime: finalTime,
    events: [],
    label: 'Finale',
  });

  // Spiel um Platz 3
  matches.push({
    id: 'match-3rd',
    matchNumber: 13,
    ...slots(resultOf(HF1_ID, 'loser'), resultOf(HF2_ID, 'loser')),
    scoreA: undefined,
    scoreB: undefined,
    round: 5,
    slot: 5,
    field: 2,
    phase: 'thirdPlace',
    isFinal: true,
    finalType: 'thirdPlace',
    matchStatus: 'scheduled',
    scheduledTime: finalTime,
    events: [],
    label: 'Spiel um Platz 3',
  });

  return matches;
}

// Das komplette Mock-Tournament
export const MOCK_TOURNAMENT: Tournament = {
  id: 'test-tournament-local',
  title: 'Hallencup U11 Oberbayern',
  status: 'published',
  sport: 'football',
  sportId: 'hallenfussball' as unknown as import('../config/sports/types').SportId,
  tournamentType: 'classic',
  mode: 'classic',
  ageClass: 'U11',
  isKidsTournament: false,
  date: new Date().toISOString().split('T')[0],
  timeSlot: '09:00',
  location: {
    name: 'Dreifachturnhalle Grünwald',
    street: 'Sportstraße 12',
    postalCode: '82031',
    city: 'Grünwald',
  },
  numberOfTeams: 7,
  numberOfGroups: 2,
  numberOfFields: 2,
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  finalRoundGameDuration: 12,
  finalRoundBreakDuration: 3,
  breakBetweenPhases: 10,
  minRestSlots: 1,
  gamePeriods: 1,
  halftimeBreak: 0,
  groupSystem: 'groupsAndFinals',
  resultMode: 'goals',
  teams: MOCK_TEAMS,
  matches: createMockMatches(),
  groups: [
    { id: 'A', customName: 'Gruppe A' },
    { id: 'B', customName: 'Gruppe B' },
  ],
  fields: [
    { id: 'field-1', defaultName: 'Feld 1', customName: 'Feld Ost' },
    { id: 'field-2', defaultName: 'Feld 2', customName: 'Feld West' },
  ],
  finals: {
    final: true,
    thirdPlace: true,
    fifthSixth: false,
    seventhEighth: false,
  },
  finalsConfig: {
    preset: 'top-4',
    parallelSemifinals: true,
    tiebreaker: 'shootout',
  },
  pointSystem: {
    win: 3,
    draw: 1,
    loss: 0,
  },
  placementLogic: [
    { id: 'points', label: 'Punkte', enabled: true },
    { id: 'goalDiff', label: 'Tordifferenz', enabled: true },
    { id: 'goalsFor', label: 'Tore', enabled: true },
    { id: 'directComparison', label: 'Direkter Vergleich', enabled: true },
  ],
  organizer: 'TSV Grünwald Fußball',
  contactInfo: {
    name: 'Max Mustermann',
    email: 'turnier@tsv-gruenwald.de',
    phone: '089 12345678',
  },
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  shareCode: 'TEST01',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default MOCK_TOURNAMENT;
