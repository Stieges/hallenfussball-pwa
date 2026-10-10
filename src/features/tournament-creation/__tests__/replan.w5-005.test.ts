import { describe, it, expect } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
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
    numberOfFields: 1,
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

describe('Neuplanung – Struktur ändern vor dem ersten Anpfiff', () => {
  it('@W5-005 – neue Teams bekommen Spiele, Vorschau mit Endzeit ersetzt nach Bestätigung den alten Plan', () => {
    const established = {
      ...baseTournament(),
      matches: generateFullSchedule(baseTournament()).allMatches.map((m, index) => ({
        id: m.id,
        round: index + 1,
        field: m.field,
        teamA: m.originalTeamA,
        teamB: m.originalTeamB,
      })),
    };

    const withNewTeam: Tournament = {
      ...established,
      numberOfTeams: 5,
      teams: [
        ...established.teams,
        { id: '5', name: 'E' },
      ],
    };

    const preview = buildReplanPreview(withNewTeam);

    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }
    expect(preview.endTime).toBeInstanceOf(Date);
    const sides = preview.schedule.allMatches.flatMap((m) => [
      m.originalTeamA,
      m.originalTeamB,
    ]);
    expect(sides).toContain('5');

    const updated = applyReplan(withNewTeam, preview);
    expect(updated.matches.length).toBe(preview.schedule.allMatches.length);
    const updatedSides = updated.matches.flatMap((m) => [m.teamA, m.teamB]);
    expect(updatedSides).toContain('5');
  });
});
