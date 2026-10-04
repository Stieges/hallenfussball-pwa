import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { buildReplanPreview, applyReplan } from '../utils/replan';

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
    finalRoundGameDuration: 21,
    finalRoundBreakDuration: 2,
    breakBetweenPhases: 5,
    placementLogic: [],
    teams: [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
      { id: '3', name: 'C' },
      { id: '4', name: 'D' },
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

describe('G6 + W3 – Dauer nach Phase, applyReplan gibt das merged-Item zurück', () => {
  it('Finale behalten → Endzeit mit finalRoundGameDuration', () => {
    const established = baseTournament();
    const playedFinal: Match = {
      id: 'kept-final',
      round: 9,
      field: 1,
      teamA: '1',
      teamB: '2',
      phase: 'final',
      isFinal: true,
      scoreA: 2,
      scoreB: 0,
      matchStatus: 'finished',
    };
    const withPlayed: Tournament = {
      ...established,
      numberOfTeams: 5,
      teams: [...established.teams, { id: '5', name: 'E' }],
      matches: [playedFinal],
    };

    const preview = buildReplanPreview(withPlayed);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }

    const mergedFinal = preview.schedule.allMatches.find(
      (m) => m.id === 'kept-final'
    );
    expect(mergedFinal).toBeDefined();
    const expectedEnd =
      mergedFinal!.startTime.getTime() + 21 * 60000;
    expect(mergedFinal!.endTime.getTime()).toBe(expectedEnd);

    const updated = applyReplan(withPlayed, preview);
    const stored = updated.matches.find((m) => m.id === playedFinal.id);
    expect(stored?.scoreA).toBe(2);
    expect(stored?.scheduledTime).toEqual(mergedFinal!.startTime);
  });
});
