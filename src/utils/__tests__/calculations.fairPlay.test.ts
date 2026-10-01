/**
 * C3b-2 F3b1 (PO 30.09.): Fair-Play als austauschbares Profil. `calculateFairPlay` nutzt nur das
 * Profil (DFBNET/UEFA/FIFA) -- keine festen Punktwerte im Code. Gelb-Rot ist ein eigener Zaehler
 * (`yellowRedCards`) und zaehlt je Profil 3 Punkte; "Gelb-Rot ersetzt die fruehere Gelbe" gilt nur
 * hier (Profil-Feld `secondYellowReplacesFirst`), ueber den transienten Schluessel Team+Rueckennummer
 * je Spiel (ohne Nummer keine Zusammenfuehrung).
 *
 * Events kommen ueber die echte Kette (reduceMatch -> toRuntimeEvents), damit auch der F3b1-
 * Adapter-Fix (Gelb-Rot -> payload.cardType 'YELLOW_RED') end-to-end mitgeprueft ist.
 */
import { describe, it, expect } from 'vitest';
import { reduceMatch, type EngineEvent } from '../../core/match';
import { toRuntimeEvents } from '../../core/match/client';
import { ctx, ev, start } from '../../core/match/client/__tests__/fixtures';
import { calculateFairPlay } from '../calculations';
import { DFBNET_PROFILE, UEFA_PROFILE, FIFA_PROFILE, type FairPlayProfile } from '../../core/stats/fairPlayProfiles';
import type { Match, RuntimeMatchEvent, Team, Tournament } from '../../types/tournament';

function engineEvents(log: EngineEvent[]): RuntimeMatchEvent[] {
  const { state } = reduceMatch(log, ctx);
  return toRuntimeEvents(state, log, ctx);
}

function tournamentWith(matches: Match[], teams?: Team[]): Tournament {
  return {
    id: 'tour-fair-play',
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

const MATCH: Match = { id: 'm', round: 1, field: 1, teamA: 'teamA', teamB: 'teamB' };

function pointsFor(log: EngineEvent[], profile: FairPlayProfile, teamName = 'FC Alpha'): number {
  const map = new Map([['m', engineEvents(log)]]);
  const fairPlay = calculateFairPlay(tournamentWith([MATCH]), map, profile);
  return fairPlay.find((e) => e.teamName === teamName)?.points ?? -1;
}

const PROFILES: [string, FairPlayProfile][] = [
  ['DFBNET', DFBNET_PROFILE],
  ['UEFA', UEFA_PROFILE],
  ['FIFA', FIFA_PROFILE],
];

describe('calculateFairPlay (Profil, F3b1)', () => {
  it.each(PROFILES)('Fall 1 -- Gelb-Rot allein = 3 (%s)', (_name, profile) => {
    const log = [
      start(),
      ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, profile)).toBe(3);
  });

  it.each(PROFILES)('Fall 2 -- Gelb + spaeteres Gelb-Rot, gleicher Spieler (ersetzt) = 3 (%s)', (_name, profile) => {
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, profile)).toBe(3);
  });

  it.each(PROFILES)('Fall 3 -- Gelb + Gelb-Rot, verschiedene Spieler = 4 (%s)', (_name, profile) => {
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 9 } }),
    ];
    expect(pointsFor(log, profile)).toBe(4);
  });

  it.each(PROFILES)('Fall 4 -- ohne Rueckennummer (Gelb + Gelb-Rot) = 4, keine Zusammenfuehrung (%s)', (_name, profile) => {
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: {} }),
      ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: {} }),
    ];
    expect(pointsFor(log, profile)).toBe(4);
  });

  it('Fall 5 -- Gelb + direktes Rot, gleicher Spieler: DFBNET Summe = 6', () => {
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'rc1', type: 'RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, DFBNET_PROFILE)).toBe(6);
  });

  it('Fall 5 -- Gelb + direktes Rot, gleicher Spieler: UEFA fest = 4', () => {
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'rc1', type: 'RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, UEFA_PROFILE)).toBe(4);
  });

  it('Fall 5 -- Gelb + direktes Rot, gleicher Spieler: FIFA fest = 5', () => {
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'rc1', type: 'RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, FIFA_PROFILE)).toBe(5);
  });

  it('Fall 6 -- Zeitstrafe: DFBNET 3, UEFA 0, FIFA 0', () => {
    const log = [
      start(),
      ev({ id: 'p1', type: 'TIME_PENALTY', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { durationSeconds: 120 } }),
    ];
    expect(pointsFor(log, DFBNET_PROFILE)).toBe(3);
    expect(pointsFor(log, UEFA_PROFILE)).toBe(0);
    expect(pointsFor(log, FIFA_PROFILE)).toBe(0);
  });

  it('Gegenbeispiele: Tor und Wechsel geben 0 Punkte', () => {
    const log = [
      start(),
      ev({ id: 'g1', type: 'GOAL', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 7 } }),
      ev({ id: 's1', type: 'SUBSTITUTION', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playersIn: [11], playersOut: [7] } }),
    ];
    expect(pointsFor(log, DFBNET_PROFILE)).toBe(0);
  });

  it('synthetisches Profil secondYellowReplacesFirst=false: Gelb + Gelb-Rot gleicher Spieler = 1 + 3 = 4', () => {
    const synthetic: FairPlayProfile = { ...DFBNET_PROFILE, name: 'TEST', secondYellowReplacesFirst: false };
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, synthetic)).toBe(4);
  });

  it('Gelb-Rot zaehlt im eigenen Zaehler yellowRedCards, nicht in redCards', () => {
    const log = [
      start(),
      ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
    ];
    const map = new Map([['m', engineEvents(log)]]);
    const fairPlay = calculateFairPlay(tournamentWith([MATCH]), map);
    const entry = fairPlay.find((e) => e.teamName === 'FC Alpha');
    expect(entry).toMatchObject({ yellowRedCards: 1, redCards: 0, yellowCards: 0 });
  });

  it('ohne Profil-Parameter nutzt Produktivcode den Standard DFBNET', () => {
    const log = [
      start(),
      ev({ id: 'p1', type: 'TIME_PENALTY', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { durationSeconds: 120 } }),
    ];
    const map = new Map([['m', engineEvents(log)]]);
    const fairPlay = calculateFairPlay(tournamentWith([MATCH]), map);
    expect(fairPlay.find((e) => e.teamName === 'FC Alpha')?.points).toBe(3);
  });
});
