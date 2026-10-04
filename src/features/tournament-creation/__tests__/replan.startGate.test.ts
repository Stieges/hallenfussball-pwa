import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { getReplanAvailability, openReplan } from '../utils/replan';

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

const establishedWith = (matches: Match[]): Tournament => ({
  ...baseTournament(),
  matches,
});

const generatedMatches = (tournament: Tournament): Match[] =>
  generateFullSchedule(tournament).allMatches.map((m, index) => ({
    id: m.id,
    round: index + 1,
    field: m.field,
    teamA: m.originalTeamA,
    teamB: m.originalTeamB,
  }));

describe('Neuplanung – Anpfiff-Sperre in openReplan (startState)', () => {
  it('@W5-008 – bei angepfiffenem Turnier verweigert openReplan die Neuplanung', () => {
    const established = establishedWith(generatedMatches(baseTournament()));
    const updated: Tournament = { ...established, numberOfFields: 3 };

    const session = openReplan(established, updated, 'started');

    expect(session.preview.status).toBe('refused');
    if (session.preview.status !== 'refused') { return; }
    expect(session.preview.reason.length).toBeGreaterThan(0);
    // nicht bestätigbar: confirm gibt den Ist-Stand zurück
    const after = session.confirm();
    expect(after.matches).toEqual(established.matches);
    expect(after.numberOfFields).toBe(established.numberOfFields);
  });

  it('@W5-008 – bei unbekanntem Startzustand ist die Neuplanung nicht verfügbar (fail-closed)', () => {
    const established = establishedWith(generatedMatches(baseTournament()));
    const updated: Tournament = { ...established, numberOfFields: 3 };

    const session = openReplan(established, updated, 'unknown');

    expect(session.preview.status).toBe('refused');
    if (session.preview.status !== 'refused') { return; }
    expect(session.preview.reason.length).toBeGreaterThan(0);
    expect(session.confirm().matches).toEqual(established.matches);
  });

  it('@W5-008 – Gegenbeispiel: ohne Anpfiff bleibt die Neuplanung möglich', () => {
    const established = establishedWith(generatedMatches(baseTournament()));
    const updated: Tournament = { ...established, numberOfFields: 3 };

    const session = openReplan(established, updated, 'not-started');

    expect(session.preview.status).toBe('preview');
  });

  it('getReplanAvailability kennt drei Zustände: offered / refused-after-kickoff / unknown', () => {
    const started = establishedWith([
      { id: 'm1', round: 1, field: 1, teamA: '1', teamB: '2', matchStatus: 'running' },
    ]);
    const planned = establishedWith([
      { id: 'm1', round: 1, field: 1, teamA: '1', teamB: '2', matchStatus: 'scheduled' },
      { id: 'm2', round: 1, field: 2, teamA: '3', teamB: '4', matchStatus: 'scheduled' },
    ]);
    const unknownStatus = establishedWith([
      { id: 'm1', round: 1, field: 1, teamA: '1', teamB: '2', matchStatus: 'snapped' as Match['matchStatus'] },
    ]);

    expect(getReplanAvailability(started)).toBe('refused-after-kickoff');
    expect(getReplanAvailability(planned)).toBe('offered');
    expect(getReplanAvailability(unknownStatus)).toBe('unknown');
  });
});
