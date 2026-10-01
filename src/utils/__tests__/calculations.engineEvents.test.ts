/**
 * C3b-2b (Plan §8 Nr. 12): Torschützenliste/Fair-Play/Export lesen Engine-Spiele aus dem
 * Adapter (`toRuntimeEvents`, ohne Zurückgenommenes) statt aus `Match.events` -- dort schreibt
 * die App bei Engine-Spielen nichts (kein Schreiben, kein syncUp). Quelle framework-frei in
 * `src/core`; die Map kommt (F3b2: EIN Lauf je Export-Klick) über `loadEngineEventsForExport` zu
 * den Lesern.
 */
import { describe, it, expect } from 'vitest';
import { reduceMatch, type EngineEvent } from '../../core/match';
import { toRuntimeEvents } from '../../core/match/client';
import { ctx, ev, goal, start } from '../../core/match/client/__tests__/fixtures';
import { calculateScorers, calculateFairPlay, eventsForMatch } from '../calculations';
import type { Match, RuntimeMatchEvent, Team, Tournament } from '../../types/tournament';

function engineEvents(log: EngineEvent[]): RuntimeMatchEvent[] {
  const { state } = reduceMatch(log, ctx);
  return toRuntimeEvents(state, log, ctx);
}

function tournamentWith(matches: Match[], teams?: Team[]): Tournament {
  return {
    id: 'tour-engine-events',
    title: 'Test-Turnier',
    date: '2024-01-01',
    timeSlot: '10:00',
    location: { name: 'Test Location' },
    ageClass: 'U15',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'classic',
    numberOfTeams: 2,
    numberOfFields: 1,
    groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10,
    teams: teams ?? [
      { id: 'teamA', name: 'FC Alpha' },
      { id: 'teamB', name: 'SV Beta' },
    ],
    matches,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    placementLogic: [
      { id: 'points', label: 'Punkte', enabled: true },
      { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
      { id: 'goalsFor', label: 'Tore', enabled: true },
      { id: 'directComparison', label: 'Direkter Vergleich', enabled: true },
    ],
    finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

// Engine-Spiel: Turnierkopie OHNE match.events (dort schreibt die App nichts, §8 Nr. 12).
const ENGINE_MATCH: Match = { id: 'm', round: 1, field: 1, teamA: 'teamA', teamB: 'teamB' };

describe('Engine-Ereignisse für Torschützenliste/Fair-Play/Export (C3b-2b)', () => {
  it('Engine-Tor erscheint in Torschützenliste und Export, zurückgenommenes nicht', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7 }),
      goal('g2', 'teamA', 3000, 40_000, { playerNumber: 9 }),
      ev({ id: 'r1', type: 'RETRACT', at: 4000, targetId: 'g2' }),
    ];
    const map = new Map([['m', engineEvents(log)]]);

    const scorers = calculateScorers(tournamentWith([ENGINE_MATCH]), map);
    expect(scorers.map((s) => [s.playerName, s.goals])).toEqual([['#7', 1]]);

    const exportRows = eventsForMatch(ENGINE_MATCH, map);
    expect(exportRows.map((e) => e.id)).toEqual(['g1']);
  });

  it('Fair-Play zählt Engine-Karten', () => {
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 15_000, payload: { playerNumber: 5 } }),
      ev({ id: 'rc1', type: 'RED_CARD', at: 3000, teamId: 'teamB', clockMs: 20_000, payload: { playerNumber: 3 } }),
    ];
    const map = new Map([['m', engineEvents(log)]]);

    const fairPlay = calculateFairPlay(tournamentWith([ENGINE_MATCH]), map);
    expect(fairPlay.find((e) => e.teamName === 'FC Alpha')).toMatchObject({ yellowCards: 1, redCards: 0, points: 1 });
    expect(fairPlay.find((e) => e.teamName === 'SV Beta')).toMatchObject({ yellowCards: 0, redCards: 1, points: 5 });
  });

  it('Altspiele ohne Map-Eintrag zählen weiter aus match.events', () => {
    const legacyMatch: Match = {
      ...ENGINE_MATCH,
      events: [
        {
          id: 'e1', matchId: 'm', timestampSeconds: 10, type: 'GOAL',
          payload: { teamId: 'teamB', playerNumber: 4 }, scoreAfter: { home: 0, away: 1 },
        },
      ],
    };
    const scorers = calculateScorers(tournamentWith([legacyMatch]));
    expect(scorers.map((s) => [s.playerName, s.goals])).toEqual([['#4', 1]]);
    expect(eventsForMatch(legacyMatch, new Map())).toHaveLength(1);
  });
});
