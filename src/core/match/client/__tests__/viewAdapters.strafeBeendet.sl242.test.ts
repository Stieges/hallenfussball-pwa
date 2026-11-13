/**
 * @SL-242 Das Ereignisprotokoll sagt an der Zeitstrafe, dass ein Tor sie beendet hat: Ableitung der Zeile aus den Ereignissen
 * (`toRuntimeEvents` -> `endedByGoalSeconds` an der Strafzeile). Testwerte aus dem Gherkin: SV Süd (Team B) hat seit 2:00 eine
 * Zeitstrafe von 2 Minuten gegen die Nummer 6, FC Nord (Team A) trifft bei 2:40. Zusammenspiel @SL-030, @SL-044, @SL-200, @SL-092, @SL-094.
 * Kein eigenes Ereignis: alle Fälle laufen über dieselben Ereignisse wie das Cockpit.
 */
import { describe, expect, it } from 'vitest';
import { toLiveMatchView, toRetractedEvents, toRuntimeEvents, type LiveMatchMeta } from '../viewAdapters';
import { reduceMatch, type EngineEvent, type MatchContext } from '../../';
import { RULES } from './fixtures';
import type { RuntimeMatchEvent } from '../../../../types/tournament';
import { toPublicRuntimeEvents } from '../../../repositories/publicPayload';

const NORD = 'fc-nord';
const SUED = 'sv-sued';
const CTX: MatchContext = { matchId: 'spiel-11', teamAId: NORD, teamBId: SUED };
const mmss = (m: number, s: number, ms = 0): number => m * 60_000 + s * 1_000 + ms;

let zaehler = 0;
function ev(type: EngineEvent['type'], clockMs: number | null, teamId: string | null, payload: Record<string, unknown> = {}, extra: Partial<EngineEvent> = {}): EngineEvent {
  zaehler += 1;
  return { id: `e${zaehler}`, type, actor: 'helper', at: 1_000 + (clockMs ?? 0), section: 1, clockMs, teamId, targetId: null, payload, ...extra };
}
const anpfiff = (): EngineEvent => ev('MATCH_START', 0, null, { rules: RULES });
const strafe = (clockMs: number, team: string, nummer: number, regel?: boolean): EngineEvent =>
  ev('TIME_PENALTY', clockMs, team, { playerNumber: nummer, durationSeconds: 120, ...(regel === undefined ? {} : { endsOnGoal: regel }) });
const tor = (clockMs: number, team: string): EngineEvent => ev('GOAL', clockMs, team);
const eigentor = (clockMs: number, team: string): EngineEvent => ev('OWN_GOAL', clockMs, team, { playerNumber: 4 });
const zurueck = (clockMs: number, ziel: EngineEvent): EngineEvent => ev('RETRACT', clockMs, null, {}, { targetId: ziel.id });

/** Zusatz je Zeitstrafe (ID) -> Sekunde des beendenden Tores oder `undefined`. */
function zusaetze(log: EngineEvent[]): Record<string, number | undefined> {
  const state = reduceMatch(log, CTX).state;
  const result: Record<string, number | undefined> = {};
  for (const event of toRuntimeEvents(state, log, CTX)) {
    if (event.type === 'TIME_PENALTY') {
      result[event.id] = event.endedByGoalSeconds;
    }
  }
  return result;
}

describe('@SL-242 Zusatz „beendet durch Tor“ an der Zeitstrafe', () => {
  it('Gegentor von FC Nord bei 2:40 beendet die Strafe von SV Süd (seit 2:00): Zusatz mit 2:40', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    expect(zusaetze([anpfiff(), s, tor(mmss(2, 40), NORD)])[s.id]).toBe(160);
  });

  it('nimmt Tom das Tor zurück, verschwindet der Zusatz (@SL-044), und die Strafe läuft weiter', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    const t = tor(mmss(2, 40), NORD);
    const log = [anpfiff(), s, t, zurueck(mmss(2, 50), t)];
    expect(zusaetze(log)[s.id]).toBeUndefined();
    expect(zusaetze(log.slice(0, 3))[s.id]).toBe(160);
  });

  it('eine abgelaufene Strafe trägt keinen Zusatz, auch wenn danach ein Tor fällt', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    expect(zusaetze([anpfiff(), s, tor(mmss(4, 30), NORD)])[s.id]).toBeUndefined();
  });

  it('eine laufende Strafe trägt keinen Zusatz', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    expect(zusaetze([anpfiff(), s])[s.id]).toBeUndefined();
  });

  it('Tor fürs bestrafte Team beendet nichts', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    expect(zusaetze([anpfiff(), s, tor(mmss(2, 40), SUED)])[s.id]).toBeUndefined();
  });

  it('@SL-200 Tor in derselben Sekunde wie der Strafbeginn erzeugt keinen Zusatz; ein Tor danach schon', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    expect(zusaetze([anpfiff(), s, tor(mmss(2, 0, 400), NORD)])[s.id]).toBeUndefined();
    expect(zusaetze([anpfiff(), s, tor(mmss(2, 0, 400), NORD), tor(mmss(2, 30), NORD)])[s.id]).toBe(150);
  });

  it('Regel „endet bei Gegentor“ ausgeschaltet: kein Zusatz', () => {
    const s = strafe(mmss(2, 0), SUED, 6, false);
    expect(zusaetze([anpfiff(), s, tor(mmss(2, 40), NORD)])[s.id]).toBeUndefined();
  });

  it('zwei Strafen und ein Tor: nur die mit der kürzesten Restzeit trägt den Zusatz', () => {
    const erste = strafe(mmss(2, 0), SUED, 6);
    const zweite = strafe(mmss(2, 20), SUED, 7);
    const z = zusaetze([anpfiff(), erste, zweite, tor(mmss(2, 40), NORD)]);
    expect(z[erste.id]).toBe(160);
    expect(z[zweite.id]).toBeUndefined();
  });

  it('@SL-092 ein Eigentor von SV Süd beendet deren Strafe (Zusatz); ein Eigentor von FC Nord nicht', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    expect(zusaetze([anpfiff(), s, eigentor(mmss(2, 40), SUED)])[s.id]).toBe(160);
    expect(zusaetze([anpfiff(), s, eigentor(mmss(2, 40), NORD)])[s.id]).toBeUndefined();
  });

  it('@SL-094 bei gleicher Unterzahl beendet ein Tor keine Strafe: kein Zusatz', () => {
    const nord = strafe(mmss(2, 0), NORD, 3);
    const sued = strafe(mmss(2, 0), SUED, 6);
    const z = zusaetze([anpfiff(), nord, sued, tor(mmss(2, 40), NORD)]);
    expect(z[nord.id]).toBeUndefined();
    expect(z[sued.id]).toBeUndefined();
  });

  it('Gegenbeispiel: nur Zeitstrafen tragen den Zusatz, nie das beendende Tor selbst', () => {
    const log = [anpfiff(), strafe(mmss(2, 0), SUED, 6), tor(mmss(2, 40), NORD)];
    const events = toRuntimeEvents(reduceMatch(log, CTX).state, log, CTX);
    expect(events.filter((e) => e.endedByGoalSeconds !== undefined).map((e) => e.type)).toEqual(['TIME_PENALTY']);
  });

  it('eine zurückgenommene Strafe erscheint in der Rücknahme-Liste ohne Zusatz', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    const log = [anpfiff(), s, tor(mmss(2, 40), NORD), zurueck(mmss(3, 0), s)];
    const state = reduceMatch(log, CTX).state;
    expect(toRetractedEvents(state, log, CTX).find((e) => e.id === s.id)?.endedByGoalSeconds).toBeUndefined();
  });

  it('Gegenbeispiel Monitor und Zuschauer-Seite: die öffentlichen Ereignisse tragen den Zusatz nie, auch wenn ein Gegentor die Strafe beendet', () => {
    const [strafeOeffentlich, torOeffentlich] = toPublicRuntimeEvents('spiel-11', [
      { id: 'p', type: 'TIME_PENALTY', team_id: SUED, section: 1, clock_ms: mmss(2, 0), number: 6, duration_seconds: 120 },
      { id: 't', type: 'GOAL', team_id: NORD, section: 1, clock_ms: mmss(2, 40) },
    ], { sideA: NORD, sideB: SUED, goalsA: 1, goalsB: 0 });
    expect(strafeOeffentlich).not.toHaveProperty('endedByGoalSeconds');
    expect(torOeffentlich).not.toHaveProperty('endedByGoalSeconds');
  });

  it('Tor mit Millisekunden (2:40,700): der Zusatz zeigt dieselbe Sekunde wie die Zeile des Tores (abgerundet, nicht aufgerundet)', () => {
    const s = strafe(mmss(2, 0, 900), SUED, 6);
    const log = [anpfiff(), s, tor(mmss(2, 40, 700), NORD)];
    const events = toRuntimeEvents(reduceMatch(log, CTX).state, log, CTX);
    const torZeile = events.find((e) => e.type === 'GOAL')!;
    const strafZeile = events.find((e) => e.type === 'TIME_PENALTY')!;
    expect(torZeile.timestampSeconds).toBe(160);
    expect(strafZeile.endedByGoalSeconds).toBe(torZeile.timestampSeconds);
  });

  it('Tor zurück und danach ein neues Tor: der Zusatz nennt die Zeit des neuen Tores', () => {
    const s = strafe(mmss(2, 0), SUED, 6);
    const erstes = tor(mmss(2, 40), NORD);
    const log = [anpfiff(), s, erstes, zurueck(mmss(2, 50), erstes), tor(mmss(3, 10), NORD)];
    expect(zusaetze(log)[s.id]).toBe(190);
  });

  describe('2. Halbzeit und Verlängerung (Spieluhr kumulativ)', () => {
    const halbzeit = (): EngineEvent[] => [
      ev('SECTION_END', 600_000, null, {}),
      ev('SECTION_START', 600_000, null, {}, { section: 2, at: 661_000 }),
    ];
    const inHz2 = (clockMs: number, ev2: (c: number) => EngineEvent): EngineEvent => ({ ...ev2(clockMs), section: 2 });

    it('Strafe und Tor in der 2. Halbzeit: Zusatz „11:30“ (Zeit der Tor-Zeile)', () => {
      const s = inHz2(mmss(11, 0), (c) => strafe(c, SUED, 6));
      const log = [anpfiff(), ...halbzeit(), s, inHz2(mmss(11, 30), (c) => tor(c, NORD))];
      expect(zusaetze(log)[s.id]).toBe(690);
    });

    it('Strafe aus der 1. Halbzeit (9:30) wird in der 2. Halbzeit (11:00) durch ein Tor beendet', () => {
      const s = strafe(mmss(9, 30), SUED, 6);
      const log = [anpfiff(), s, ...halbzeit(), inHz2(mmss(11, 0), (c) => tor(c, NORD))];
      expect(zusaetze(log)[s.id]).toBe(660);
    });

    it('Tor in der Verlängerung beendet die Strafe aus der 2. Halbzeit', () => {
      const knockout = ev('MATCH_START', 0, null, { rules: { ...RULES, knockout: true, tiebreak: 'overtime-then-shootout', overtimeSeconds: 300 } });
      const s = inHz2(mmss(19, 30), (c) => strafe(c, SUED, 6));
      const log = [
        knockout, ...halbzeit(), s,
        ev('MATCH_END', 1_200_000, null, {}, { section: 2, at: 1_261_000 }),
        ev('SECTION_START', 1_200_000, null, {}, { section: 3, at: 1_321_000 }),
        ev('GOAL', mmss(20, 20), NORD, {}, { section: 3, at: 1_371_000 }),
      ];
      const state = reduceMatch(log, CTX).state;
      const penalty = toRuntimeEvents(state, log, CTX).find((e) => e.type === 'TIME_PENALTY')!;
      expect(penalty.endedByGoalSeconds).toBe(1220);
    });
  });

  describe('Uhrkorrektur: Tafel und Protokoll sagen dasselbe', () => {
    const meta: LiveMatchMeta = {
      id: 'spiel-11', number: 11, phaseLabel: 'Gruppe A', fieldId: 'f1', scheduledKickoff: '2026-11-13T10:00:00.000Z', version: 1,
      homeTeam: { id: NORD, name: 'FC Nord' }, awayTeam: { id: SUED, name: 'SV Süd' },
    };
    // `LiveMatch.events` ist als älterer Draht-Typ deklariert, zur Laufzeit sind es die Runtime-Ereignisse des Adapters
    const mitUhr = (log: EngineEvent[], serverNow: number): RuntimeMatchEvent =>
      (toLiveMatchView(reduceMatch(log, CTX).state, meta, { serverNow, offsetMs: 0 }, log).events as unknown as RuntimeMatchEvent[])
        .find((e) => e.type === 'TIME_PENALTY')!;
    const grundlage = (): EngineEvent[] => [anpfiff(), strafe(mmss(2, 0), SUED, 6), tor(mmss(2, 40), NORD)];

    it('ohne Korrektur: Tor liegt hinter uns, Zusatz steht', () => {
      expect(mitUhr(grundlage(), 1_000 + mmss(2, 50)).endedByGoalSeconds).toBe(160);
    });

    it('Uhr nach dem Tor auf 2:10 zurückgestellt: die Tafel sieht die Strafe wieder laufen, das Protokoll trägt keinen Zusatz', () => {
      const log = [...grundlage(), ev('CLOCK_ADJUST', mmss(2, 10), null, { previousClockMs: mmss(2, 49) }, { at: 1_000 + mmss(2, 49) })];
      expect(mitUhr(log, 1_000 + mmss(2, 49)).endedByGoalSeconds).toBeUndefined();
    });

    it('Gegenbeispiel: Uhr wieder hinter das Tor gestellt (3:00): der Zusatz steht wieder da', () => {
      const zurueckGestellt = ev('CLOCK_ADJUST', mmss(2, 10), null, { previousClockMs: mmss(2, 49) }, { at: 1_000 + mmss(2, 49) });
      const vor = ev('CLOCK_ADJUST', mmss(3, 0), null, { previousClockMs: mmss(2, 10) }, { at: 1_000 + mmss(2, 49) });
      expect(mitUhr([...grundlage(), zurueckGestellt, vor], 1_000 + mmss(2, 49)).endedByGoalSeconds).toBe(160);
    });
  });
});
