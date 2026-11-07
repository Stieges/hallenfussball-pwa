/**
 * Laufende Zeitstrafen für Monitor und Zuschauer-Seite – reine Regel, Testwerte aus dem Gherkin
 * (Record zuschauer-und-monitor): @ZM-182 (Kreis mit Restzeit), @ZM-192 (folgt dem Spielverlauf), @ZM-183 (Gegenbeispiel Karte),
 * @ZM-184 (Zuschauer-Seite „Zeitstrafe #5 · 1:23“). Spiel 7 „FC Nord – SV Süd“, SV Süd bekommt in der 4. Minute eine Zeitstrafe
 * von 2 Minuten für die Rückennummer 5. Die Uhr kommt aus `live_state` (Serverzeit), die Ereignisse aus der öffentlichen Antwort.
 */
import { describe, expect, it } from 'vitest';
import { laufendeZeitstrafen, zeitstrafeRestText } from '../zeitstrafen';
import type { RuntimeMatchEvent } from '../../../types/tournament';

const T0 = Date.UTC(2026, 10, 28, 14, 0, 0);
const NORD = 'team-nord';
const SUED = 'team-sued';
/** 4. Minute: Spielzeit 3:20 (kumulativ, ms) */
const START_5 = 200_000;
const ZWEI_MIN = 120;

let laufend = 0;
function strafe(teamId: string, nummer: number | undefined, clockMs: number, dauer: number | undefined = ZWEI_MIN): RuntimeMatchEvent {
  laufend += 1;
  return {
    id: `ev-${laufend}`,
    type: 'TIME_PENALTY',
    timestampSeconds: Math.floor(clockMs / 1000),
    clockMs,
    payload: {
      teamId,
      ...(nummer === undefined ? {} : { playerNumber: nummer }),
      ...(dauer === undefined ? {} : { durationSeconds: dauer, penaltyDuration: dauer }),
    },
    scoreAfter: { home: 1, away: 0 },
  };
}

function gelb(teamId: string, nummer: number, clockMs: number): RuntimeMatchEvent {
  return { id: 'gelb', type: 'YELLOW_CARD', timestampSeconds: clockMs / 1000, clockMs, payload: { teamId, playerNumber: nummer, cardType: 'YELLOW' }, scoreAfter: { home: 1, away: 0 } };
}

/** `live_state` von Spiel 7: Spielzeit `gespieltMs` (kumulativ), läuft seit T0 (oder steht). */
function uhr(gespieltMs: number, status = 'running', phase = 'regular', laeuft = status === 'running') {
  return { status, phase, section: phase === 'overtime' ? 3 : 1, sections: 2, sectionSeconds: 600, overtimeSeconds: 120, sectionStartMs: 0, elapsedMs: gespieltMs, anchorAt: laeuft ? T0 : null };
}

function rechne(events: RuntimeMatchEvent[], liveState: unknown, nowMs = T0) {
  return laufendeZeitstrafen({ events, liveState, homeId: NORD, awayId: SUED, nowMs });
}

const nummern = (liste: ReadonlyArray<{ nummer: number | null }>) => liste.map((s) => s.nummer);

describe('@ZM-182 Eine laufende Zeitstrafe zeigt der Monitor als ablaufenden Kreis an der Ecke des Kastens', () => {
  const nr5 = strafe(SUED, 5, START_5);

  it('@ZM-182 die Strafe läuft 30 Sekunden: Kreis mit „5“ beim Kasten von SV Süd, Ring zu drei Vierteln voll', () => {
    const z = rechne([nr5], uhr(START_5 + 30_000));
    expect(nummern(z.away)).toEqual([5]);
    expect(z.home).toEqual([]);
    expect(z.away[0].anteil).toBeCloseTo(0.75, 5);
    expect(z.away[0].restMs).toBe(90_000);
  });

  it('@ZM-182 die Uhr läuft weiter: der Ring nimmt mit der Spielzeit (Serverzeit) ab', () => {
    const z = rechne([nr5], uhr(START_5 + 30_000), T0 + 30_000);
    expect(z.away[0].anteil).toBeCloseTo(0.5, 5);
    expect(z.steht).toBe(false);
  });

  it('@ZM-182 die Strafe ist abgelaufen: kein Kreis mehr am Kasten von SV Süd', () => {
    const z = rechne([nr5], uhr(START_5 + 120_000));
    expect(z.away).toEqual([]);
  });

  it('@ZM-182 zweite Zeitstrafe für Nr. 8, während die erste läuft: zwei Kreise „5“ und „8“, jeder mit eigener Restzeit', () => {
    const z = rechne([nr5, strafe(SUED, 8, START_5 + 60_000)], uhr(START_5 + 90_000));
    expect(nummern(z.away)).toEqual([5, 8]);
    expect(z.away.map((s) => s.restMs)).toEqual([30_000, 90_000]);
  });

  it('@ZM-182 die Uhr steht in der Halbzeitpause: Kreis mit „5“ grau (steht), der Ring läuft erst mit der Spielzeit weiter', () => {
    const pause = uhr(START_5 + 30_000, 'section_break');
    const jetzt = rechne([nr5], pause, T0);
    const spaeter = rechne([nr5], pause, T0 + 45_000);
    expect(nummern(jetzt.away)).toEqual([5]);
    expect(jetzt.steht).toBe(true);
    expect(spaeter.away[0].restMs).toBe(jetzt.away[0].restMs);
  });
});

describe('@ZM-183 Ohne laufende Zeitstrafe zeigt der Monitor keinen Kreis', () => {
  it('@ZM-183 SV Süd hat in der 4. Minute eine Gelbe Karte bekommen: kein Kreis', () => {
    const z = rechne([gelb(SUED, 5, START_5)], uhr(START_5 + 30_000));
    expect([...z.home, ...z.away]).toEqual([]);
  });

  it('@ZM-183 ohne Ereignisse (Schalter „Ereignisse je Spiel“ aus oder Kindermodus: der Server liefert keine): kein Kreis', () => {
    const z = rechne([], uhr(START_5 + 30_000));
    expect([...z.home, ...z.away]).toEqual([]);
  });
});

describe('@ZM-192 Der Zeitstrafen-Kreis folgt dem Spielverlauf', () => {
  const nr5 = strafe(SUED, 5, START_5);
  const nr8 = strafe(SUED, 8, START_5 + 10_000);
  const nr3 = strafe(SUED, 3, START_5 + 20_000);

  it('@ZM-192 Zeitstrafen für Nr. 8 und Nr. 3 danach: drei Kreise, „5“ in der Ecke, rechts daneben „8“, dann „3“', () => {
    expect(nummern(rechne([nr5, nr8, nr3], uhr(START_5 + 30_000)).away)).toEqual([5, 8, 3]);
  });

  it('@ZM-192 die Strafe für Nr. 5 läuft ab, während „8“ und „3“ laufen: „8“ rückt in die Ecke, „3“ rechts daneben', () => {
    expect(nummern(rechne([nr5, nr8, nr3], uhr(START_5 + 120_000)).away)).toEqual([8, 3]);
  });

  it('@ZM-192 die Strafe läuft ab: der Kreis ist sofort weg', () => {
    expect(rechne([nr5], uhr(START_5 + 119_999)).away).toHaveLength(1);
    expect(rechne([nr5], uhr(START_5 + 120_000)).away).toEqual([]);
  });

  it('@ZM-192 die Strafe wurde ohne Rückennummer eingetragen: ein Kreis mit leerer Scheibe', () => {
    const z = rechne([strafe(SUED, undefined, START_5)], uhr(START_5 + 30_000));
    expect(nummern(z.away)).toEqual([null]);
  });

  it('@ZM-192 die Uhr wird im laufenden Spiel angehalten: grauer Ring (steht), die Restzeit bleibt', () => {
    const angehalten = uhr(START_5 + 30_000, 'paused');
    expect(rechne([nr5], angehalten).steht).toBe(true);
    expect(rechne([nr5], angehalten, T0 + 60_000).away[0].restMs).toBe(90_000);
  });

  it('@ZM-192 das Spiel geht in die Verlängerung, während die Strafe läuft: der Ring läuft mit der Spielzeit der Verlängerung weiter', () => {
    const regulaerEnde = 1_200_000;
    const spaet = strafe(SUED, 5, regulaerEnde - 30_000);
    const z = rechne([spaet], uhr(regulaerEnde + 30_000, 'running', 'overtime'));
    expect(nummern(z.away)).toEqual([5]);
    expect(z.away[0].restMs).toBe(60_000);
    expect(z.steht).toBe(false);
  });

  it('@ZM-192 das Spiel wird abgepfiffen, während die Strafe läuft: kein Kreis mehr, auch nicht auf dem Endstand', () => {
    expect(rechne([nr5], uhr(START_5 + 30_000, 'finished', 'regular', false)).away).toEqual([]);
  });

  it('@ZM-192 Gegenbeispiel: im Strafstoßschießen gibt es keine Spielzeit und keinen Kreis', () => {
    expect(rechne([nr5], uhr(START_5 + 30_000, 'running', 'shootout')).away).toEqual([]);
  });

  it('@ZM-192 Gegenbeispiel: die Strafe von FC Nord steht beim Heim-Kasten, nicht bei SV Süd', () => {
    const z = rechne([strafe(NORD, 9, START_5)], uhr(START_5 + 30_000));
    expect(nummern(z.home)).toEqual([9]);
    expect(z.away).toEqual([]);
  });

  it('@ZM-192 ohne gültige Uhr (kein live_state) zeigt die Anzeige nichts statt einer erfundenen Restzeit', () => {
    expect(rechne([nr5], undefined).away).toEqual([]);
  });

  it('@ZM-192 ohne mitgelieferte Dauer gilt die Vorgabe der Spielregel (2 Minuten)', () => {
    const ohneDauer = strafe(SUED, 5, START_5, undefined);
    expect(rechne([ohneDauer], uhr(START_5 + 30_000)).away[0].restMs).toBe(90_000);
  });

  it('@ZM-192 eine Strafe von 1 Minute (Turnierregel) läuft nach 60 Sekunden ab', () => {
    const kurz = strafe(SUED, 5, START_5, 60);
    expect(rechne([kurz], uhr(START_5 + 30_000)).away[0].anteil).toBeCloseTo(0.5, 5);
    expect(rechne([kurz], uhr(START_5 + 60_000)).away).toEqual([]);
  });
});

describe('@ZM-184 Auf der Zuschauer-Seite steht eine laufende Zeitstrafe mit Restzeit beim Team', () => {
  it('@ZM-184 die Strafe läuft seit 37 Sekunden: „1:23“', () => {
    const z = rechne([strafe(SUED, 5, START_5)], uhr(START_5 + 37_000));
    expect(zeitstrafeRestText(z.away[0])).toBe('1:23');
  });

  it('@ZM-184 die Restzeit steht in ganzen Sekunden wie im Cockpit (abgerundet, m:ss)', () => {
    const z = rechne([strafe(SUED, 5, START_5)], uhr(START_5 + 37_400));
    expect(zeitstrafeRestText(z.away[0])).toBe('1:22');
  });
});
