/**
 * toTeamSummaryModel (B-10a2): Zusammenfassung je Team nach dem Abpfiff – Tore, Karten, Zeitstrafen, Fouls im ganzen Spiel
 * (@SL-048, @SL-099 „Gesamtzahl in der Zusammenfassung“). Testwerte aus dem Mockup „Laptop, abgepfiffen“ (Spiel 11, FC Nord – SV Süd 2:1,
 * Spielzeit 12:00). Der Code wurde erst danach gelesen.
 */
import { describe, it, expect } from 'vitest';
import { toTeamSummaryModel } from '../toTeamSummaryModel';
import { KASTEN_GAST, KASTEN_HEIM, makeLiveMatch } from '../../__tests__/cockpitFixtures';
import type { RuntimeMatchEvent } from '../../../../types/tournament';

/** `makeLiveMatch` baut das Kern-Spiel (Draht-Ereignisse); das Cockpit liest dieselben Einträge im Laufzeitformat. */
const alsKern = (liste: RuntimeMatchEvent[]): ReturnType<typeof makeLiveMatch>['events'] => liste as unknown as ReturnType<typeof makeLiveMatch>['events'];
const NORD = 'fc-nord';
const SUED = 'sv-sued';
let zaehler = 0;
function ereignis(type: RuntimeMatchEvent['type'], teamId: string, sekunden: number, payload: Partial<RuntimeMatchEvent['payload']> = {}): RuntimeMatchEvent {
  zaehler += 1;
  return { id: `e${zaehler}`, matchId: 'match-11', type, timestampSeconds: sekunden, payload: { teamId, ...payload } } as RuntimeMatchEvent;
}

/** Spiel des Mockups: Nord 2:1 Süd; Nord Tore Nr. 9 (1:50) und ohne Nr. (7:10), Zeitstrafe Nr. 4 (7:40), Fouls 2:20, 5:10; Süd Tor Nr. 3 (6:35), Gelb Nr. 7 (1:15), Fouls 3:05, 4:30. */
const events: RuntimeMatchEvent[] = [
  ereignis('GOAL', NORD, 110, { playerNumber: 9 }),
  ereignis('GOAL', NORD, 430),
  ereignis('GOAL', SUED, 395, { playerNumber: 3 }),
  ereignis('YELLOW_CARD', SUED, 75, { playerNumber: 7, cardType: 'YELLOW' }),
  ereignis('TIME_PENALTY', NORD, 460, { playerNumber: 4 }),
  ereignis('FOUL', NORD, 140), ereignis('FOUL', NORD, 310),
  ereignis('FOUL', SUED, 185), ereignis('FOUL', SUED, 270),
];
const match = makeLiveMatch({ status: 'FINISHED', homeScore: 2, awayScore: 1, events: alsKern(events) });
const nord = (m = match) => toTeamSummaryModel({ match: m, seite: 'home', fouls: 3, kasten: KASTEN_HEIM });
const sued = (m = match) => toTeamSummaryModel({ match: m, seite: 'away', fouls: 3, kasten: KASTEN_GAST });

describe('toTeamSummaryModel (@SL-048)', () => {
  it('FC Nord: zwei Tore mit Nummer und Zeit, keine Karten, eine Zeitstrafe, 3 Fouls', () => {
    expect(nord()).toMatchObject({
      seite: 'home', name: 'FC Nord',
      tore: [{ nummer: 9, zeit: '1:50', eigentor: false }, { nummer: null, zeit: '7:10', eigentor: false }],
      karten: [], zeitstrafen: [{ nummer: 4, zeit: '7:40' }], fouls: 3,
    });
  });

  it('SV Süd: ein Tor, eine Gelbe Karte Nr. 7 bei 1:15, keine Zeitstrafe', () => {
    expect(sued()).toMatchObject({
      name: 'SV Süd', tore: [{ nummer: 3, zeit: '6:35', eigentor: false }], karten: [{ art: 'YELLOW', nummer: 7, zeit: '1:15' }], zeitstrafen: [], fouls: 3,
    });
  });

  it('Gegenbeispiel: ein Ereignis des anderen Teams steht nicht in dieser Zusammenfassung', () => {
    expect(nord().tore).toHaveLength(2);
    expect(nord().karten).toHaveLength(0);
    expect(sued().zeitstrafen).toHaveLength(0);
  });

  it('die Fouls sind die übergebene Gesamtzahl im Spiel, nicht die Zahl der Foul-Ereignisse (Karten und Zeitstrafen zählen mit)', () => {
    expect(toTeamSummaryModel({ match, seite: 'home', fouls: 7, kasten: KASTEN_HEIM }).fouls).toBe(7);
  });

  it('Tore, Karten und Zeitstrafen stehen nach Spielzeit aufsteigend, auch wenn die Eintragsreihenfolge anders ist', () => {
    const m = makeLiveMatch({ events: alsKern([ereignis('GOAL', NORD, 500, { playerNumber: 2 }), ereignis('GOAL', NORD, 60, { playerNumber: 8 })]) });
    expect(nord(m).tore.map((tor) => tor.nummer)).toEqual([8, 2]);
  });

  it('Gelb-Rot und Rot behalten ihre Art', () => {
    const m = makeLiveMatch({ events: alsKern([
      ereignis('RED_CARD', SUED, 100, { playerNumber: 5, cardType: 'YELLOW_RED' }), ereignis('RED_CARD', SUED, 200, { playerNumber: 6, cardType: 'RED' }),
    ]) });
    expect(sued(m).karten.map((k) => k.art)).toEqual(['YELLOW_RED', 'RED']);
  });

  it('ein Eigentor zählt dem begünstigten Team (teamId) und ist als Eigentor gekennzeichnet', () => {
    const m = makeLiveMatch({ events: alsKern([ereignis('GOAL', NORD, 90, { playerNumber: 12, ownGoal: true, ownGoalTeamId: SUED })]) });
    expect(nord(m).tore).toEqual([{ id: expect.any(String), nummer: 12, zeit: '1:30', eigentor: true }]);
    expect(sued(m).tore).toEqual([]);
  });

  it('@SL-176 der Kasten der Seite kommt für den Kopf mit, die Teamfarbe zählt nicht (Gegenbeispiel)', () => {
    const m = makeLiveMatch({ homeTeam: { id: NORD, name: 'FC Nord', colors: { primary: 'red' } } });
    expect(nord(m).kasten).toBe(KASTEN_HEIM);
    expect(sued(m).kasten).toBe(KASTEN_GAST);
  });

  it('ein Spiel ohne Einträge: leere Listen und 0 Fouls', () => {
    expect(toTeamSummaryModel({ match: makeLiveMatch({ events: alsKern([]) }), seite: 'home', fouls: 0, kasten: KASTEN_HEIM })).toMatchObject({ tore: [], karten: [], zeitstrafen: [], fouls: 0 });
  });

  it('ein Spiel ohne Ereignisliste (älteres Spiel) ergibt leere Listen', () => {
    const m = makeLiveMatch();
    Reflect.deleteProperty(m, 'events');
    expect(nord(m)).toMatchObject({ tore: [], karten: [], zeitstrafen: [] });
  });
});
