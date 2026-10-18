/**
 * Aufgabe 5.1a (Spielanzeige): Restzeit für Zuschauer (@ZM-162, @ZM-139, @ZM-040, @ZM-039, @ZM-044, @OB-066).
 * Werte und Wortlaut aus dem Gherkin; die Form des Feinstatus aus den Engine-Fixtures 57a/57c/57e (live_state).
 */
import { describe, expect, it } from 'vitest';
import { badgeDetailFromEngineState, badgeDetailFromLiveState, type MatchBadgeEngineDetail } from '../badge';
import { spectatorClockForMatch, spectatorClockOf } from '../spectatorClock';
import type { MatchView } from '../types';
import { initialState } from '../../match/applyEvent';
import fx57a from '../../match/__fixtures__/57a-halbzeit-pause.json';
import fx57c from '../../match/__fixtures__/57c-pause-vor-verlaengerung.json';
import fx57e from '../../match/__fixtures__/57e-verlaengerung-laeuft.json';

type LiveStateFixture = { expect: { liveState: unknown } };
const E = (status: MatchBadgeEngineDetail['status'], phase: MatchBadgeEngineDetail['phase'], section: number, sections: number, extra: Partial<MatchBadgeEngineDetail> = {}): MatchBadgeEngineDetail =>
  ({ status, phase, section, sections, ...extra });

describe('Zwischenspeicher ohne Feinstatus (Gespielte Zeit seit Anpfiff)', () => {
  it('@ZM-162 2 × 6 min, im zweiten Abschnitt 4:10 gespielt (insgesamt 10:10): Restzeit 1:50, Abschnitt „2. Halbzeit“', () => {
    const clock = spectatorClockOf({ totalElapsedSec: 610, sectionSec: 360, sections: 2, stopped: false });
    expect(clock).toMatchObject({ remaining: '1:50', sectionKey: 'secondHalf', section: 2, sections: 2, expired: false });
  });

  it('@ZM-040 angehalten bei Restzeit 2:20 in der 1. Halbzeit (10 min): „2:20“, „1. Halbzeit“, stopped', () => {
    const clock = spectatorClockOf({ totalElapsedSec: 460, sectionSec: 600, sections: 2, stopped: true });
    expect(clock).toMatchObject({ remaining: '2:20', sectionKey: 'firstHalf', stopped: true, expired: false });
  });

  it('@ZM-162 Gegenbeispiel: remaining ist nie die gespielte Zeit (4:10 oder 10:10)', () => {
    const clock = spectatorClockOf({ totalElapsedSec: 610, sectionSec: 360, sections: 2, stopped: false });
    expect(clock.remaining).not.toBe('4:10');
    expect(clock.remaining).not.toBe('10:10');
  });

  it('@ZM-139 ein Abschnitt (K.-o.-Spiel 10 min): Restzeit herunterzählend, kein Abschnittswort', () => {
    expect(spectatorClockOf({ totalElapsedSec: 320, sectionSec: 600, sections: 1, stopped: false })).toMatchObject({ remaining: '4:40', sectionKey: null });
  });

  it('@OB-066 vier Abschnitte: „Abschnitt 3 von 4“ statt Halbzeit-Wort', () => {
    expect(spectatorClockOf({ totalElapsedSec: 2 * 300 + 100, sectionSec: 300, sections: 4, stopped: false })).toMatchObject({ remaining: '3:20', sectionKey: 'sectionOfN', section: 3, sections: 4 });
  });

  it('@OB-066 Halbzeit: keine „Spielzeit abgelaufen“ zwischen den Abschnitten, ohne Pausen-Daten keine Uhr', () => {
    const clock = spectatorClockOf({ totalElapsedSec: 360, sectionSec: 360, sections: 2, stopped: true });
    expect(clock).toMatchObject({ remaining: null, expired: false, sectionKey: 'halftimeBreak' });
  });

  it('@OB-066 Spielzeit abgelaufen, noch nicht abgepfiffen (Übergang): Restzeit 0:00 und expired', () => {
    expect(spectatorClockOf({ totalElapsedSec: 720, sectionSec: 360, sections: 2, stopped: false })).toMatchObject({ remaining: '0:00', expired: true });
  });

  it('@OB-066 Gegenbeispiel: eine angehaltene Uhr am Ende der Spielzeit ist nicht „abgelaufen – Ergebnis folgt“', () => {
    expect(spectatorClockOf({ totalElapsedSec: 720, sectionSec: 360, sections: 2, stopped: true }).expired).toBe(false);
  });

  it('@OB-066 Verlängerung ohne Feinstatus: keine Uhr (der Zwischenspeicher kennt die Phase nicht), nie eine falsche Restzeit', () => {
    expect(spectatorClockOf({ totalElapsedSec: 700, sectionSec: 600, sections: 1, stopped: false })).toMatchObject({ remaining: null, sectionKey: 'overtime' });
  });

  it('@ZM-162 Gegenbeispiel: die Restzeit wird nie negativ', () => {
    const ueberzogen = E('running', 'regular', 2, 2, { sectionSeconds: 360, sectionElapsedSec: 999 });
    expect(spectatorClockOf({ totalElapsedSec: 1400, sectionSec: 360, sections: 2, stopped: false, engine: ueberzogen }).remaining).toBe('0:00');
    expect(spectatorClockOf({ totalElapsedSec: 720, sectionSec: 360, sections: 2, stopped: false }).remaining).toBe('0:00');
  });
});

describe('Feinstatus (Engine bzw. live_state hat Vorrang)', () => {
  it('@OB-066 Halbzeitpause (57a): Pausen-Restzeit aus breakStartedAt/breakSeconds, Phase „Halbzeit“', () => {
    const engine = badgeDetailFromLiveState((fx57a as LiveStateFixture).expect.liveState, 601_000 + 30_000);
    expect(spectatorClockOf({ totalElapsedSec: 600, sectionSec: 600, sections: 2, stopped: true, engine })).toMatchObject({ remaining: '0:30', sectionKey: 'halftimeBreak', expired: false });
  });

  it('@ZM-044 Pause vor der Verlängerung (57c), 20 s nach dem Abpfiff: Restzeit 0:40, Phase „Pause vor der Verlängerung“', () => {
    const engine = badgeDetailFromLiveState((fx57c as LiveStateFixture).expect.liveState, 601_000 + 20_000);
    expect(spectatorClockOf({ totalElapsedSec: 600, sectionSec: 600, sections: 1, stopped: true, engine })).toMatchObject({ remaining: '0:40', sectionKey: 'breakBeforeOvertime' });
  });

  it('@ZM-039 Verlängerung von 5 Minuten läuft seit 1:20 (57e): Restzeit 3:40, herunterzählend', () => {
    const engine = badgeDetailFromLiveState((fx57e as LiveStateFixture).expect.liveState, 661_000 + 80_000);
    expect(engine).toMatchObject({ overtimeSeconds: 300, sectionElapsedSec: 80 });
    expect(spectatorClockOf({ totalElapsedSec: 680, sectionSec: 600, sections: 1, stopped: false, engine })).toMatchObject({ remaining: '3:40', sectionKey: 'overtime' });
  });

  it('@ZM-039 Gegenbeispiel: in der Verlängerung ohne Länge der Verlängerung keine Uhr', () => {
    const engine = E('running', 'overtime', 2, 1, { sectionElapsedSec: 80 });
    expect(spectatorClockOf({ totalElapsedSec: 680, sectionSec: 600, sections: 1, stopped: false, engine }).remaining).toBeNull();
  });

  it('@ZM-040 laufende Uhr zählt seit dem Abruf weiter (asOfMs), eine stehende Uhr nicht', () => {
    const laufend = E('running', 'regular', 1, 2, { sectionSeconds: 600, sectionElapsedSec: 460, running: true, asOfMs: 1_000_000 });
    expect(spectatorClockOf({ totalElapsedSec: 460, sectionSec: 600, sections: 2, stopped: false, engine: laufend, nowMs: 1_010_000 }).remaining).toBe('2:10');
    const steht = E('paused', 'regular', 1, 2, { sectionSeconds: 600, sectionElapsedSec: 460, running: false, asOfMs: 1_000_000 });
    expect(spectatorClockOf({ totalElapsedSec: 460, sectionSec: 600, sections: 2, stopped: true, engine: steht, nowMs: 1_010_000 }).remaining).toBe('2:20');
  });

  it('@OB-066 die Pausen-Restzeit zählt seit dem Abruf herunter und wird nie negativ', () => {
    const pause = E('section_break', 'regular', 1, 2, { breakRemainingSec: 30, asOfMs: 1_000_000 });
    expect(spectatorClockOf({ totalElapsedSec: 600, sectionSec: 600, sections: 2, stopped: true, engine: pause, nowMs: 1_020_000 }).remaining).toBe('0:10');
    expect(spectatorClockOf({ totalElapsedSec: 600, sectionSec: 600, sections: 2, stopped: true, engine: pause, nowMs: 1_999_000 }).remaining).toBe('0:00');
  });

  it('@OB-066 Gegenbeispiel: Ende des 1. von 2 Abschnitten (Uhr schon bei 0:00, Pause noch nicht gesetzt) ist nicht „Spielzeit abgelaufen“', () => {
    const engine = E('running', 'regular', 1, 2, { sectionSeconds: 600, sectionElapsedSec: 600, running: true });
    expect(spectatorClockOf({ totalElapsedSec: 600, sectionSec: 600, sections: 2, stopped: false, engine })).toMatchObject({ remaining: '0:00', expired: false });
  });

  it('@OB-066 Gegenbeispiel: im letzten Abschnitt bei 0:00 angehaltene Uhr (Feinstatus paused) ist nicht „Spielzeit abgelaufen – Ergebnis folgt“', () => {
    const engine = E('paused', 'regular', 2, 2, { sectionSeconds: 600, sectionElapsedSec: 600, running: false });
    const clock = spectatorClockOf({ totalElapsedSec: 1200, sectionSec: 600, sections: 2, stopped: true, engine });
    expect(clock).toMatchObject({ remaining: '0:00', expired: false, stopped: true });
  });

  it('@OB-066 Pause nach dem 1. von 4 Abschnitten: Phase „Pause nach dem 1. von 4 Abschnitten“ (nicht Halbzeit)', () => {
    const pause = E('section_break', 'regular', 1, 4, { breakRemainingSec: 45 });
    expect(spectatorClockOf({ totalElapsedSec: 300, sectionSec: 300, sections: 4, stopped: true, engine: pause })).toMatchObject({ remaining: '0:45', sectionKey: 'sectionBreak', section: 1, sections: 4 });
  });

  it('@OB-066 Pause ohne Pausen-Daten: keine Uhr; Entscheidung offen und Strafstoßschießen: keine Uhr', () => {
    expect(spectatorClockOf({ totalElapsedSec: 300, sectionSec: 300, sections: 2, stopped: true, engine: E('section_break', 'regular', 1, 2) }).remaining).toBeNull();
    expect(spectatorClockOf({ totalElapsedSec: 600, sectionSec: 600, sections: 1, stopped: true, engine: E('decision_pending', 'regular', 1, 1) }).remaining).toBeNull();
    expect(spectatorClockOf({ totalElapsedSec: 600, sectionSec: 600, sections: 1, stopped: true, engine: E('shootout', 'shootout', 1, 1) }).remaining).toBeNull();
  });

  it('@ZM-162 Engine in der 2. Halbzeit: Restzeit aus dem Abschnitt (nicht der gesamten Spielzeit)', () => {
    const engine = E('running', 'regular', 2, 2, { sectionSeconds: 360, sectionElapsedSec: 250, running: false, asOfMs: 5 });
    expect(spectatorClockOf({ totalElapsedSec: 610, sectionSec: 360, sections: 2, stopped: false, engine })).toMatchObject({ remaining: '1:50', sectionKey: 'secondHalf' });
  });

  it('@OB-066 Verwaltung: aus dem Stand der Engine (MatchState) Abschnitt, Rest und Pause, laufende Uhr mitgerechnet', () => {
    const rules = { sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: false, tiebreak: null, overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120 } as const;
    const base = { ...initialState({ matchId: 'm', teamAId: 'a', teamBId: 'b' }), rules, status: 'running' as const, section: 1 };
    const laufend = badgeDetailFromEngineState({ ...base, clock: { running: true, elapsedMs: 100_000, anchorAt: 1_000_000 }, sectionStartMs: 0, breakStartedAt: null }, 1_000_000 + 360_000);
    expect(laufend).toMatchObject({ sectionElapsedSec: 460, sectionSeconds: 600, running: true });
    expect(spectatorClockOf({ totalElapsedSec: 460, sectionSec: 600, sections: 2, stopped: false, engine: laufend })).toMatchObject({ remaining: '2:20', sectionKey: 'firstHalf' });
    const pause = badgeDetailFromEngineState({ ...base, status: 'section_break', clock: { running: false, elapsedMs: 600_000, anchorAt: null }, sectionStartMs: 0, breakStartedAt: 2_000_000 }, 2_000_000 + 25_000);
    expect(pause.breakRemainingSec).toBe(35);
  });
});

describe('spectatorClockForMatch (Spiel der Ansicht)', () => {
  const rules = { sections: 2, sectionSeconds: 360, overtimeSeconds: 300, clockMode: 'durchlaufend-letzte-minute-angehalten' as const };
  const ansicht = (over: Partial<MatchView>): MatchView => ({ isLive: true, status: 'running', clockRules: rules, ...over } as MatchView);

  it('@ZM-162 laufendes Spiel 11 aus dem Zwischenspeicher (gespielt 10:10): 1:50', () => {
    expect(spectatorClockForMatch(ansicht({}), 610, 0)?.remaining).toBe('1:50');
  });

  it('@ZM-040 ein unterbrochenes Spiel der Ansicht (status paused) hat eine stehende Uhr: zählt nicht weiter, stopped', () => {
    const engine = E('paused', 'regular', 1, 2, { sectionSeconds: 360, sectionElapsedSec: 220, running: true, asOfMs: 1_000_000 });
    const gleich = spectatorClockForMatch(ansicht({ status: 'paused', engine }), 220, 1_000_000);
    const spaeter = spectatorClockForMatch(ansicht({ status: 'paused', engine }), 220, 1_030_000);
    expect(spaeter?.remaining).toBe(gleich?.remaining);
    expect(spaeter).toMatchObject({ remaining: '2:20', stopped: true });
    // Gegenbeispiel: dasselbe Spiel läuft (status running) und zählt in 30 s weiter
    expect(spectatorClockForMatch(ansicht({ status: 'running', engine }), 220, 1_030_000)).toMatchObject({ remaining: '1:50', stopped: false });
  });

  it('@ZM-162 Gegenbeispiel: ein geplantes oder beendetes Spiel trägt keine Uhr', () => {
    expect(spectatorClockForMatch(ansicht({ isLive: false, status: 'finished' }), 610, 0)).toBeNull();
    expect(spectatorClockForMatch(ansicht({ isLive: false, status: 'scheduled' }), 0, 0)).toBeNull();
  });

  it('@ZM-162 Gegenbeispiel: ohne gespielte Zeit und ohne Feinstatus keine Uhr (keine volle Restzeit aus fehlenden Daten)', () => {
    expect(spectatorClockForMatch(ansicht({}), undefined, 0)).toBeNull();
  });
});
