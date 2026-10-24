import { describe, it, expect } from 'vitest';
import { toTeamColumnModel, teamKnoepfe, type TeamColumnInput } from '../toTeamColumnModel';
import { KASTEN_GAST, makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';
import type { CockpitPhase, CockpitZustand } from '../cockpitPhase';

const ARTEN = { yellow: true, yellowRed: true, red: true, timePenalty: true };
const input = (extra: Partial<TeamColumnInput> = {}): TeamColumnInput => ({
  match: makeLiveMatch(), seite: 'away', view: makePhaseView(), zustand: 'laeuft',
  fouls: 3, foulGrenze: 5, sperrHinweise: [], zeitstrafeSekunden: 120, unterzahl: null, darfErgaenzen: false, kartenArten: ARTEN, kasten: KASTEN_GAST, ...extra,
});
const phase = (zustand: CockpitZustand): CockpitPhase => ({ zustand, abschnittArt: 'regulaer', abschnitt: 1, abschnitte: 2, letzterAbschnitt: false });

describe('toTeamColumnModel', () => {
  it('@SL-099 Zähler gegen die Grenze; @SL-102 ohne Grenze nur die Zahl', () => {
    expect(toTeamColumnModel(input()).fouls).toEqual({ zaehlt: 3, grenze: 5 });
    expect(toTeamColumnModel(input({ foulGrenze: null })).fouls).toEqual({ zaehlt: 3, grenze: null });
  });

  it('@SL-031 nur die Strafen des eigenen Teams, mit Restzeit; @SL-086 stehend, wenn die Uhr nicht läuft', () => {
    const view = makePhaseView({ penalties: [
      { id: 'p1', teamId: 'sv-sued', playerNumber: 5, remainingMs: 72_000 },
      { id: 'p2', teamId: 'fc-nord', playerNumber: 9, remainingMs: 40_000 },
    ] });
    expect(toTeamColumnModel(input({ view })).strafen).toEqual([{ id: 'p1', rest: '1:12', nummer: 5, steht: false }]);
    expect(toTeamColumnModel(input({ view, zustand: 'pausiert' })).strafen[0]?.steht).toBe(true);
    expect(toTeamColumnModel(input({ view, zustand: 'halbzeitpause' })).strafen[0]?.steht).toBe(true);
  });

  it('@SL-029 Dauer der Zeitstrafe aus der Regel in Minuten', () => {
    expect(toTeamColumnModel(input({ zeitstrafeSekunden: 60 })).zeitstrafeMinuten).toBe(1);
    expect(toTeamColumnModel(input({ zeitstrafeSekunden: 120 })).zeitstrafeMinuten).toBe(2);
  });

  it('@SL-089 Sperr-Hinweise nur für das eigene Team', () => {
    const sperrHinweise = [{ teamId: 'sv-sued', playerNumber: 7, ausSpielNummer: 8 }, { teamId: 'fc-nord', playerNumber: 3, ausSpielNummer: 8 }];
    expect(toTeamColumnModel(input({ sperrHinweise })).gesperrt).toEqual([7]);
  });

  it('Name und Seite kommen aus dem Spiel der Seite, der Kasten (getragene Farbe, @SL-176) aus dem Aufruf – nicht aus der Teamfarbe', () => {
    const match = makeLiveMatch({ awayTeam: { id: 'sv-sued', name: 'SV Süd', colors: { primary: 'var(--c)' } } });
    const m = toTeamColumnModel(input({ match }));
    expect([m.seite, m.teamId, m.name, m.kasten]).toEqual(['away', 'sv-sued', 'SV Süd', KASTEN_GAST]);
    expect(toTeamColumnModel(input({ seite: 'home' })).name).toBe('FC Nord');
  });

  it('@SL-093 Unterzahl mit Restzeit, @SL-092 Ergänzen werden durchgereicht', () => {
    const m = toTeamColumnModel(input({ unterzahl: { restMs: 90_000 }, darfErgaenzen: true }));
    expect(m.unterzahl).toEqual({ rest: '1:30' });
    expect(m.darfErgaenzen).toBe(true);
    expect(toTeamColumnModel(input()).unterzahl).toBeNull();
  });
});

describe('teamKnoepfe', () => {
  it('@SL-085 laufend und angehalten: alle vier Knöpfe', () => {
    expect(teamKnoepfe(phase('laeuft'), true)).toEqual({ tor: true, foul: true, zeitstrafe: true, karte: true });
    expect(teamKnoepfe(phase('pausiert'), true)).toEqual({ tor: true, foul: true, zeitstrafe: true, karte: true });
  });
  it('@SL-087 Halbzeitpause: nur Zeitstrafe und Karte', () => {
    expect(teamKnoepfe(phase('halbzeitpause'), true)).toEqual({ tor: false, foul: false, zeitstrafe: true, karte: true });
  });
  it('@SL-018 ohne Steuer keine Knöpfe', () => {
    expect(teamKnoepfe(phase('laeuft'), false)).toEqual({ tor: false, foul: false, zeitstrafe: false, karte: false });
  });
  it('nach dem Abpfiff keine Knöpfe', () => {
    expect(teamKnoepfe(phase('abgepfiffen'), true)).toEqual({ tor: false, foul: false, zeitstrafe: false, karte: false });
  });
});
