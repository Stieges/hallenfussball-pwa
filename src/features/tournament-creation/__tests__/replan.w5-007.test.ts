import { describe, it, expect } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { openReplan } from '../utils/replan';

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
    finalRoundGameDuration: 10,
    finalRoundBreakDuration: 2,
    breakBetweenPhases: 0,
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

describe('Neuplanung abbrechen', () => {
  it('@W5-007 – Abbrechen nach der Vorschau ändert weder Spielplan noch Einstellungen', () => {
    const established: Tournament = {
      ...baseTournament(),
      matches: generateFullSchedule(baseTournament()).allMatches.map((m, index) => ({
        id: m.id,
        round: index + 1,
        field: m.field,
        teamA: m.originalTeamA,
        teamB: m.originalTeamB,
      })),
    };
    const before = structuredClone(established);

    const withFieldChange: Tournament = {
      ...established,
      numberOfFields: 3,
    };

    const session = openReplan(established, withFieldChange, 'not-started');
    expect(session.preview.status).toBe('preview');

    const afterCancel = session.cancel();

    expect(afterCancel.matches).toEqual(before.matches);
    expect(afterCancel.numberOfFields).toBe(before.numberOfFields);
    expect(afterCancel.teams).toEqual(before.teams);
    expect(established.matches).toEqual(before.matches);
    expect(established.numberOfFields).toBe(before.numberOfFields);
  });
});
