/**
 * R5 PR 1 – Tor- und Karten-Einblendung aus dem Stand (rein, ohne React). Testwerte aus dem Gherkin:
 * @ZM-083 (Tor in Spiel 8 für DJK Berg: Feld 1 nichts, Eingang ja, Feld 2 ja), @ZM-178 (Gelbe Karte DJK Berg in
 * Spiel 8: Feld 1 nichts, Eingang ja), @ZM-119 (Karte für DJK Berg, nicht das Gastteam), @ZM-118 (ohne öffentlichen
 * Stand keine Einblendung) und Plan R5 Test 7 (Korrektur nach unten blendet nichts ein, Wiederholung idempotent).
 * Befund C-MONITOR-TOR-OHNE-RICHTUNG: Engine-Tore haben kein `delta` mehr – die Erkennung liest den Stand.
 */
import { describe, it, expect } from 'vitest';
import type { Match, RuntimeMatchEvent, Tournament } from '../../../types/tournament';
import type { MonitorSlide } from '../../../types/monitor';
import { boundFieldNumbers, cardIdsOf, detectOverlays } from '../monitorOverlays';
import { buildTournament, slide, withMatch } from './monitorFixture';
import { looseVs } from '../../../test/matchSlotFixtures';

/** Spiel 8 läuft (Feld 2): DJK Berg (Heim) – TuS Mitte. */
const spiel8Laeuft = (patch: Partial<Match> = {}): Tournament =>
  buildTournament({ matches: withMatch('match-8', { matchStatus: 'running', scoreA: 0, scoreB: 0, ...patch }) });

const gelb = (id: string, teamId: string, playerNumber?: number): RuntimeMatchEvent => ({
  id, matchId: 'match-8', timestampSeconds: 100, type: 'YELLOW_CARD',
  payload: { teamId, ...(playerNumber === undefined ? {} : { playerNumber }) }, scoreAfter: { home: 0, away: 0 },
});

const FELD_1: MonitorSlide[] = [slide('live', { fieldId: 'field-1' })];
const FELD_2: MonitorSlide[] = [slide('live', { fieldId: 'field-2' })];
const EINGANG: MonitorSlide[] = [slide('sponsor', { sponsorId: 'sp-1' })];

let clock = 1000;
const now = (): number => ++clock;

function detect(prev: Tournament, next: Tournament, slides: MonitorSlide[], seen = cardIdsOf(prev)) {
  return detectOverlays(prev, next, boundFieldNumbers(slides), seen, now);
}

describe('@ZM-083 Tor-Einblendung nach Feld', () => {
  // @ZM-083 wörtlich: „Clara trägt in Spiel 8 ein Tor für DJK Berg ein … der neue Stand 0:1“ – DJK Berg spielt als Gast.
  const bergGast = (patch: Partial<Match> = {}): Tournament => spiel8Laeuft({ ...looseVs('team-mitte', 'team-berg'), ...patch });
  const vorher = bergGast();
  const nachher = bergGast({ scoreB: 1 });

  it('Hallenmonitor Feld 1: keine Tor-Einblendung für dieses Tor', () => {
    expect(detect(vorher, nachher, FELD_1).goals).toEqual([]);
  });

  it('Hallenmonitor Eingang: Tor-Einblendung für DJK Berg in Spiel 8, Stand 0:1', () => {
    const { goals } = detect(vorher, nachher, EINGANG);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ matchId: 'match-8', teamId: 'team-berg', teamName: 'DJK Berg', side: 'away', newScore: { home: 0, away: 1 } });
  });

  it('Hallenmonitor Feld 2 (Live-Folie von Spiel 8): Tor-Einblendung für DJK Berg', () => {
    expect(detect(vorher, nachher, FELD_2).goals.map((g) => g.teamName)).toEqual(['DJK Berg']);
  });

  it('Gegenstück Heimseite: DJK Berg als Heim 0:0 -> 1:0 steht links', () => {
    const { goals } = detect(spiel8Laeuft(), spiel8Laeuft({ scoreA: 1 }), EINGANG);
    expect(goals[0]).toMatchObject({ teamName: 'DJK Berg', side: 'home', newScore: { home: 1, away: 0 } });
  });

  it('Tor des Gastteams: Einblendung für TuS Mitte auf der Gastseite', () => {
    const { goals } = detect(spiel8Laeuft(), spiel8Laeuft({ scoreB: 1 }), EINGANG);
    expect(goals[0]).toMatchObject({ teamId: 'team-mitte', teamName: 'TuS Mitte', side: 'away', newScore: { home: 0, away: 1 } });
  });

  it('Tor in der Sekunde vor dem Abpfiff (vorher laufend, jetzt beendet) kommt trotzdem', () => {
    expect(detect(vorher, bergGast({ scoreB: 1, matchStatus: 'finished' }), EINGANG).goals).toHaveLength(1);
  });

  it('Tor während der Unterbrechung (paused) kommt', () => {
    expect(detect(spiel8Laeuft({ matchStatus: 'paused' }), spiel8Laeuft({ matchStatus: 'paused', scoreA: 1 }), EINGANG).goals).toHaveLength(1);
  });
});

describe('Plan R5 Test 7: nur echte neue Tore', () => {
  it('Korrektur 2:0 -> 1:0: keine Tor-Einblendung', () => {
    expect(detect(spiel8Laeuft({ scoreA: 2 }), spiel8Laeuft({ scoreA: 1 }), EINGANG).goals).toEqual([]);
  });

  it('dieselbe Antwort zweimal (Server liefert ein geändertes Spiel bis 5 s erneut): kein zweites Tor', () => {
    const nachher = spiel8Laeuft({ scoreA: 1 });
    expect(detect(nachher, nachher, EINGANG).goals).toEqual([]);
  });

  it('beendetes Spiel wird nachträglich auf 3:1 korrigiert: keine Tor-Einblendung', () => {
    const vorher = buildTournament();
    const korrigiert = buildTournament({ matches: withMatch('match-1', { scoreA: 3 }) });
    expect(detect(vorher, korrigiert, EINGANG).goals).toEqual([]);
  });

  it('Stand vorher unbekannt (Live-Stand war aus) -> jetzt sichtbar: keine Einblendung', () => {
    expect(detect(spiel8Laeuft({ scoreA: undefined, scoreB: undefined }), spiel8Laeuft({ scoreA: 2 }), EINGANG).goals).toEqual([]);
  });
});

describe('@ZM-118 ohne öffentlichen Stand keine Einblendung', () => {
  it('Server liefert im Kindermodus keinen Stand und keine Ereignisse: weder Tor noch Karte', () => {
    const ohneStand = spiel8Laeuft({ scoreA: undefined, scoreB: undefined });
    const found = detect(ohneStand, spiel8Laeuft({ scoreA: undefined, scoreB: undefined }), EINGANG);
    expect(found).toEqual({ goals: [], cards: [] });
  });
});

describe('@ZM-178 / @ZM-119 Karten-Einblendung', () => {
  const vorher = spiel8Laeuft();
  const nachher = spiel8Laeuft({ events: [gelb('ev-gelb-4', 'team-berg', 4)] });

  it('@ZM-178 Hallenmonitor Feld 1: keine Karten-Einblendung für eine Karte in Spiel 8', () => {
    expect(detect(vorher, nachher, FELD_1).cards).toEqual([]);
  });

  it('@ZM-178 Hallenmonitor Eingang: Karten-Einblendung für DJK Berg', () => {
    const { cards } = detect(vorher, nachher, EINGANG);
    expect(cards).toEqual([expect.objectContaining({ matchId: 'match-8', teamId: 'team-berg', teamName: 'DJK Berg', cardType: 'YELLOW', playerNumber: 4 })]);
  });

  it('@ZM-119 Karte für DJK Berg steht auf DJK Bergs Seite (nicht immer beim Gastteam)', () => {
    expect(detect(vorher, nachher, EINGANG).cards[0].side).toBe('home');
    const mitte = spiel8Laeuft({ events: [gelb('ev-gelb-mitte', 'team-mitte')] });
    expect(detect(vorher, mitte, EINGANG).cards[0]).toMatchObject({ side: 'away', teamName: 'TuS Mitte' });
  });

  it('Gelb-Rot wird als Gelb-Rot eingeblendet (öffentliche Form: RED_CARD mit cardType YELLOW_RED)', () => {
    const gelbRot: RuntimeMatchEvent = { id: 'ev-gr', matchId: 'match-8', timestampSeconds: 200, type: 'RED_CARD', payload: { teamId: 'team-berg', cardType: 'YELLOW_RED' }, scoreAfter: { home: 0, away: 0 } };
    expect(detect(vorher, spiel8Laeuft({ events: [gelbRot] }), EINGANG).cards[0].cardType).toBe('YELLOW_RED');
  });

  it('dieselbe Karte in der nächsten Antwort: keine zweite Einblendung (Gesehen-Menge)', () => {
    const seen = cardIdsOf(vorher);
    expect(detect(vorher, nachher, EINGANG, seen).cards).toHaveLength(1);
    expect(detect(nachher, nachher, EINGANG, seen).cards).toEqual([]);
  });

  it('eine Karte, die ein Feld-Monitor wegen des Felds nicht zeigt, gilt trotzdem als gesehen', () => {
    const seen = cardIdsOf(vorher);
    detect(vorher, nachher, FELD_1, seen);
    expect(seen.has('ev-gelb-4')).toBe(true);
  });

  it('Zeitstrafe ist keine Karte', () => {
    const strafe: RuntimeMatchEvent = { id: 'ev-zs', matchId: 'match-8', timestampSeconds: 90, type: 'TIME_PENALTY', payload: { teamId: 'team-berg' }, scoreAfter: { home: 0, away: 0 } };
    expect(detect(vorher, spiel8Laeuft({ events: [strafe] }), EINGANG).cards).toEqual([]);
  });
});
