import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { buildReplanPreview } from '../utils/replan';
import { testUuid } from '../../../test/testIds';

const baseTournament = (): Tournament =>
  ({
    id: 't1',
    title: 'Test Cup',
    ageClass: 'U13',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'roundRobin',
    groupSystem: 'roundRobin',
    date: '2030-01-01',
    timeSlot: '09:00',
    startDate: '2030-01-01',
    startTime: '09:00',
    numberOfTeams: 4,
    numberOfFields: 2,
    numberOfGroups: 1,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    placementLogic: [],
    teams: [
      { id: testUuid(1), name: 'A' },
      { id: testUuid(2), name: 'B' },
      { id: testUuid(3), name: 'C' },
      { id: testUuid(4), name: 'D' },
    ],
    matches: [],
    status: 'published',
    publishedAt: '2026-10-04T08:00:00Z',
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' },
    createdAt: '2026-10-04T08:00:00Z',
    updatedAt: '2026-10-04T08:00:00Z',
  }) as unknown as Tournament;

describe('G2 – halb gesetztes Ergebnis schützt das Spiel', () => {
  it('scoreA ohne scoreB zählt als Ereignis und bleibt erhalten', () => {
    const established = baseTournament();
    const all = generateFullSchedule(established).allMatches;
    const halfSet: Match = {
      id: all[0].id,
      round: 1,
      field: all[0].field,
      slotA: all[0].slotA,
      slotB: all[0].slotB,
      scoreA: 2,
    };
    const withHalf: Tournament = {
      ...established,
      matches: [halfSet],
    };

    const preview = buildReplanPreview(withHalf);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }
    expect(preview.keptMatches.map((m) => m.id)).toContain(halfSet.id);
    expect(preview.keptNotices.some((n) => n.matchId === halfSet.id)).toBe(true);
  });
});
