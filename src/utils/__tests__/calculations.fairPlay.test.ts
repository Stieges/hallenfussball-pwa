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

  // Fixrunde Aufgabe 3: Altspiele (match.events statt engineEventsById) koennen `playerNumber:
  // null` persistiert haben -- `typeof playerNumber === 'number'` darf solche Eintraege NICHT
  // unter demselben Spieler-Schluessel zusammenfuehren (sonst greift secondYellowReplacesFirst
  // faelschlich zwischen zwei verschiedenen Spielern ohne erfasste Rueckennummer).
  it('Altspiel mit playerNumber: null (Legacy, match.events direkt): Gelb + Gelb-Rot = 4, keine Zusammenfuehrung', () => {
    const legacyMatch: Match = {
      ...MATCH,
      events: [
        {
          id: 'y1',
          matchId: 'm',
          timestampSeconds: 10,
          type: 'YELLOW_CARD',
          payload: { teamId: 'teamA', playerNumber: null },
          scoreAfter: { home: 0, away: 0 },
        },
        {
          id: 'yr1',
          matchId: 'm',
          timestampSeconds: 20,
          type: 'RED_CARD',
          payload: { teamId: 'teamA', playerNumber: null, cardType: 'YELLOW_RED' },
          scoreAfter: { home: 0, away: 0 },
        },
      ],
    } as unknown as Match;
    const fairPlay = calculateFairPlay(tournamentWith([legacyMatch]), undefined, UEFA_PROFILE);
    expect(fairPlay.find((e) => e.teamName === 'FC Alpha')?.points).toBe(4);
  });

  // Fixrunde Aufgabe 4a: synthetisches `yellowPlusRed` (7, weder DFBNET-Summe=4 noch UEFA-fest=4)
  // toetet eine Mutation, die den Kombi-Zweig ignoriert oder mit einem anderen Profilwert
  // verwechselt -- UEFA als Basis liefert yellow=1/red=3, die hier NICHT addiert werden duerfen.
  it('synthetisches Profil { ...UEFA, yellowPlusRed: 7 }: Gelb + direktes Rot gleicher Spieler = 7', () => {
    const synthetic: FairPlayProfile = { ...UEFA_PROFILE, name: 'TEST-A', yellowPlusRed: 7 };
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'rc1', type: 'RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, synthetic)).toBe(7);
  });

  it('synthetisches Profil { ...UEFA, yellowPlusRed: 7 }: Gelb + direktes Rot, verschiedene Spieler = 1 + 3 = 4', () => {
    const synthetic: FairPlayProfile = { ...UEFA_PROFILE, name: 'TEST-A', yellowPlusRed: 7 };
    const log = [
      start(),
      ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ev({ id: 'rc1', type: 'RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 9 } }),
    ];
    expect(pointsFor(log, synthetic)).toBe(4);
  });

  // Fixrunde Aufgabe 4b: synthetisches Profil mit Werten, die zu keinem der drei echten Profile
  // passen (Gelb 2, Gelb-Rot 4, Rot 6, Zeitstrafe 1) -- toetet Mutationen, die feste Punktwerte
  // (z.B. DFBNET 1/3/5) statt der Profil-Felder verwenden.
  describe('synthetisches Profil (Gelb 2, Gelb-Rot 4, Rot 6, Zeitstrafe 1)', () => {
    const syntheticB: FairPlayProfile = {
      name: 'TEST-B',
      yellow: 2,
      yellowRed: 4,
      red: 6,
      timePenalty: 1,
      secondYellowReplacesFirst: true,
      yellowPlusRed: 'SUM',
    };

    it('Fall 1 -- Gelb-Rot allein = 4', () => {
      const log = [
        start(),
        ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ];
      expect(pointsFor(log, syntheticB)).toBe(4);
    });

    it('Fall 2 -- Gelb + spaeteres Gelb-Rot, gleicher Spieler (ersetzt) = 4', () => {
      const log = [
        start(),
        ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
        ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 4 } }),
      ];
      expect(pointsFor(log, syntheticB)).toBe(4);
    });

    it('Fall 3 -- Gelb + Gelb-Rot, verschiedene Spieler = 2 + 4 = 6', () => {
      const log = [
        start(),
        ev({ id: 'y1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
        ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 3000, teamId: 'teamA', clockMs: 20_000, payload: { playerNumber: 9 } }),
      ];
      expect(pointsFor(log, syntheticB)).toBe(6);
    });

    it('direktes Rot allein = 6', () => {
      const log = [
        start(),
        ev({ id: 'rc1', type: 'RED_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
      ];
      expect(pointsFor(log, syntheticB)).toBe(6);
    });
  });

  // Fixrunde Aufgabe 4c: direktes Rot allein je echtem Profil -- bisher nur in Kombination mit
  // Gelb getestet, nie isoliert; toetet eine Mutation, die `profile.red` durch einen festen Wert
  // ersetzt.
  it.each(PROFILES)('direktes Rot allein = profile.red (%s)', (_name, profile) => {
    const log = [
      start(),
      ev({ id: 'rc1', type: 'RED_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, profile)).toBe(profile.red);
  });

  it('direktes Rot allein: DFBNET 5, UEFA 3, FIFA 4 (feste Erwartungswerte laut Profil)', () => {
    const log = [
      start(),
      ev({ id: 'rc1', type: 'RED_CARD', at: 2000, teamId: 'teamA', clockMs: 10_000, payload: { playerNumber: 4 } }),
    ];
    expect(pointsFor(log, DFBNET_PROFILE)).toBe(5);
    expect(pointsFor(log, UEFA_PROFILE)).toBe(3);
    expect(pointsFor(log, FIFA_PROFILE)).toBe(4);
  });

  // Fixrunde Aufgabe 4d: Kombinationen gelten nur je Spiel -- derselbe Spieler (Team+Rueckennummer)
  // ueber zwei verschiedene Spiele hinweg darf NICHT kombiniert werden (keine Zusammenfuehrung
  // ueber Spiele). Direkte match.events (wie Aufgabe-3-Test), nicht ueber die Engine-Kette.
  it('zwei Spiele: Gelb in Spiel 1 + Gelb-Rot in Spiel 2 desselben Spielers -- keine Zusammenfuehrung, Summe 1 + 3 = 4', () => {
    const match1: Match = {
      id: 'm1', round: 1, field: 1, teamA: 'teamA', teamB: 'teamB',
      events: [
        { id: 'y1', matchId: 'm1', timestampSeconds: 10, type: 'YELLOW_CARD', payload: { teamId: 'teamA', playerNumber: 4 }, scoreAfter: { home: 0, away: 0 } },
      ],
    } as unknown as Match;
    const match2: Match = {
      id: 'm2', round: 2, field: 1, teamA: 'teamA', teamB: 'teamB',
      events: [
        { id: 'yr1', matchId: 'm2', timestampSeconds: 10, type: 'RED_CARD', payload: { teamId: 'teamA', playerNumber: 4, cardType: 'YELLOW_RED' }, scoreAfter: { home: 0, away: 0 } },
      ],
    } as unknown as Match;
    const fairPlay = calculateFairPlay(tournamentWith([match1, match2]), undefined, UEFA_PROFILE);
    expect(fairPlay.find((e) => e.teamName === 'FC Alpha')?.points).toBe(4);
  });

  // Fixrunde Aufgabe 4d: dieselbe Rueckennummer in BEIDEN Teams im selben Spiel darf ebenfalls
  // nicht teamuebergreifend kombiniert werden -- der Schluessel enthaelt die teamId.
  it('dieselbe Rueckennummer in beiden Teams im selben Spiel: Team A 1, Team B 3 (keine teamuebergreifende Zusammenfuehrung)', () => {
    const match: Match = {
      id: 'm', round: 1, field: 1, teamA: 'teamA', teamB: 'teamB',
      events: [
        { id: 'y1', matchId: 'm', timestampSeconds: 10, type: 'YELLOW_CARD', payload: { teamId: 'teamA', playerNumber: 4 }, scoreAfter: { home: 0, away: 0 } },
        { id: 'yr1', matchId: 'm', timestampSeconds: 20, type: 'RED_CARD', payload: { teamId: 'teamB', playerNumber: 4, cardType: 'YELLOW_RED' }, scoreAfter: { home: 0, away: 0 } },
      ],
    } as unknown as Match;
    const fairPlay = calculateFairPlay(tournamentWith([match]), undefined, UEFA_PROFILE);
    expect(fairPlay.find((e) => e.teamName === 'FC Alpha')?.points).toBe(1);
    expect(fairPlay.find((e) => e.teamName === 'SV Beta')?.points).toBe(3);
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
