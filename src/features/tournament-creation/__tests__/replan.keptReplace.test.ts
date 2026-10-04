import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { buildReplanPreview, applyReplan, openReplan } from '../utils/replan';

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

const generatedMatches = (tournament: Tournament): Match[] =>
  generateFullSchedule(tournament).allMatches.map((m, index) => ({
    id: m.id,
    round: index + 1,
    field: m.field,
    teamA: m.originalTeamA,
    teamB: m.originalTeamB,
  }));

const pairingOf = (m: Pick<Match, 'teamA' | 'teamB'>): string =>
  [m.teamA, m.teamB].sort().join(':');

describe('Neuplanung – behaltenes Spiel ersetzt generiertes Spiel', () => {
  it('@W5-009 – die Paarung des behaltenen Spiels kommt genau einmal vor (E1)', () => {
    const established = baseTournament();
    const played: Match = {
      ...generatedMatches(established)[0],
      scoreA: 2,
      scoreB: 1,
      matchStatus: 'finished',
    };
    const withPlayed: Tournament = {
      ...established,
      numberOfTeams: 5,
      teams: [...established.teams, { id: '5', name: 'E' }],
      matches: [played, ...generatedMatches(established).slice(1)],
    };

    const preview = buildReplanPreview(withPlayed);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }

    const updated = applyReplan(withPlayed, preview);
    const samePairing = updated.matches.filter(
      (m) => pairingOf(m) === pairingOf(played)
    );
    expect(samePairing).toHaveLength(1);
    const kept = updated.matches.find((m) => m.id === played.id);
    expect(kept?.scoreA).toBe(2);
    expect(kept?.scoreB).toBe(1);
  });

  it('@W5-009 – ohne Gegenstück wird das Spiel angehängt und als Konflikt gemeldet', () => {
    const established = baseTournament();
    // Team '9' spielt nicht mit – die Paarung hat im neuen Plan kein Gegenstück.
    const orphan: Match = {
      id: 'kept-orphan',
      round: 1,
      field: 1,
      teamA: '9',
      teamB: '1',
      scoreA: 4,
      scoreB: 4,
      matchStatus: 'finished',
      phase: 'groupStage',
    };
    const withOrphan: Tournament = {
      ...established,
      matches: [orphan],
    };

    const preview = buildReplanPreview(withOrphan);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }
    expect(preview.keptMatches.map((m) => m.id)).toContain(orphan.id);
    expect(preview.conflictMatchIds).toContain(orphan.id);
  });

  it('Controller-Ruling: Kollision von behaltenem Anstoß mit dem neuen Plan – @W5-008, nicht bestätigbar', () => {
    const established = baseTournament();
    const generated = generateFullSchedule(established).allMatches;
    const [first, second] = generated;
    // Behaltenes Spiel: eigene Paarung (hat ein Gegenstück), aber bewusst auf
    // dem Feld/Zeit-Slot eines ANDEREN Spiels des neuen Plans.
    const played: Match = {
      id: 'kept-collide',
      round: 1,
      field: second.field,
      teamA: first.originalTeamA,
      teamB: first.originalTeamB,
      scoreA: 1,
      scoreB: 0,
      matchStatus: 'finished',
      phase: 'groupStage',
      scheduledTime: second.startTime,
    };
    const withPlayed: Tournament = {
      ...established,
      matches: [played, ...generatedMatches(established).slice(1)],
    };

    const session = openReplan(withPlayed, withPlayed, 'not-started');
    expect(session.preview.status).toBe('impossible');
    if (session.preview.status !== 'impossible') { return; }
    expect(session.preview.reason.length).toBeGreaterThan(0);
    expect(session.preview.suggestion.length).toBeGreaterThan(0);
    expect(session.confirm().matches).toEqual(withPlayed.matches);
  });
});
