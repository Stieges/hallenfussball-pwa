/**
 * Zeitstrafe endet beim Gegentor (Befund C-ZEITSTRAFE-GEGENTOR-FEHLT): das Ende wird aus den Ereignissen abgeleitet.
 * Testwerte aus dem Gherkin: Record Regelinhalte @W2A-013, @W2A-014, @W2A-015, @W2A-018; Record Spiel leiten @SL-030, @SL-044,
 * @SL-092, @SL-094, @SL-095, @SL-200. FC Nord (Team A) – SV Süd (Team B); Zeiten in Spielzeit, Anpfiff bei at = 1000.
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../reduceMatch';
import { activePenalties, ergaenzenTeams, penaltyRemainingMs, penaltyStatuses, resolvePenalties } from '../penalties';
import type { EngineEvent, MatchContext } from '../types';

const NORD = 'team-nord';
const SUED = 'team-sued';
const ctx: MatchContext = { matchId: 'spiel-11', teamAId: NORD, teamBId: SUED };
const MIN = 60_000;
const SEK = 1_000;
const mmss = (m: number, s: number, ms = 0) => m * MIN + s * SEK + ms;

let zaehler = 0;
function ev(type: EngineEvent['type'], clockMs: number | null, teamId: string | null, payload: Record<string, unknown> = {}, extra: Partial<EngineEvent> = {}): EngineEvent {
  zaehler += 1;
  return { id: `e${zaehler}`, type, actor: 'helper', at: 1000 + (clockMs ?? 0), section: 1, clockMs, teamId, payload, ...extra };
}

const start = () => ev('MATCH_START', null, null, {
  rules: { sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: false, tiebreak: null, overtimeSeconds: 300, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120 },
});
const strafe = (clockMs: number, team: string, nummer: number, regel?: boolean) =>
  ev('TIME_PENALTY', clockMs, team, { playerNumber: nummer, durationSeconds: 120, ...(regel === undefined ? {} : { endsOnGoal: regel }) });
const tor = (clockMs: number, team: string) => ev('GOAL', clockMs, team, {});
const eigentor = (clockMs: number, team: string) => ev('OWN_GOAL', clockMs, team, { playerNumber: 4 });
const retract = (clockMs: number, target: EngineEvent) => ev('RETRACT', clockMs, null, {}, { targetId: target.id });

function stand(events: EngineEvent[], spielzeitMs: number) {
  const { state } = reduceMatch(events, ctx);
  return {
    state,
    rest: (id: string) => {
      const aktiv = activePenalties(state, spielzeitMs).find((p) => p.id === id);
      return aktiv === undefined ? 0 : penaltyRemainingMs(aktiv, spielzeitMs);
    },
    aktiv: activePenalties(state, spielzeitMs).map((p) => p.id),
    ergaenzen: ergaenzenTeams(penaltyStatuses(state, spielzeitMs), spielzeitMs),
  };
}

describe('@W2A-013 / @SL-030 Zeitstrafe endet beim Gegentor', () => {
  it('Gegentor von FC Nord bei 2:40 beendet die Strafe von SV Süd (seit 2:00, 2 Minuten); SV Süd darf sich ergänzen', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    const lauf = [start(), s];
    expect(stand(lauf, mmss(2, 39)).aktiv).toEqual([s.id]);
    const ende = stand([...lauf, tor(mmss(2, 40), NORD)], mmss(2, 41));
    expect(ende.aktiv).toEqual([]);
    expect(ende.ergaenzen).toEqual([SUED]);
  });

  it('ohne Angabe im Eintrag gilt die Regel als eingeschaltet (ältere Strafen)', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    expect(stand([start(), s, tor(mmss(2, 40), NORD)], mmss(3, 0)).aktiv).toEqual([]);
  });

  it('das Neuladen ändert nichts: dasselbe Protokoll zweimal ergibt dieselbe Ableitung', () => {
    const lauf = [start(), strafe(mmss(2, 0), SUED, 5), tor(mmss(2, 40), NORD)];
    expect(stand(lauf, mmss(3, 0))).toMatchObject({ aktiv: [], ergaenzen: [SUED] });
    expect(stand([...lauf], mmss(3, 0))).toMatchObject({ aktiv: [], ergaenzen: [SUED] });
  });

  it('ein Tor des bestraften Teams selbst beendet seine Strafe nicht', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    expect(stand([start(), s, tor(mmss(2, 40), SUED)], mmss(2, 50)).aktiv).toEqual([s.id]);
  });

  it('ein Gegentor VOR der Strafe beendet sie nicht', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    expect(stand([start(), tor(mmss(1, 0), NORD), s], mmss(2, 30)).aktiv).toEqual([s.id]);
  });

  it('der Hinweis „darf sich ergänzen“ verschwindet, wenn die Strafe ohnehin abgelaufen wäre', () => {
    const lauf = [start(), strafe(mmss(2, 0), SUED, 5), tor(mmss(2, 40), NORD)];
    expect(stand(lauf, mmss(3, 59)).ergaenzen).toEqual([SUED]);
    expect(stand(lauf, mmss(4, 1)).ergaenzen).toEqual([]);
  });
});

describe('@SL-092 Ein Eigentor beendet die Zeitstrafe des Teams, das es geschossen hat', () => {
  it('Eigentor der Nummer 4 von SV Süd bei 2:40 beendet die Strafe von SV Süd', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    const ende = stand([start(), s, eigentor(mmss(2, 40), SUED)], mmss(2, 41));
    expect(ende.aktiv).toEqual([]);
    expect(ende.ergaenzen).toEqual([SUED]);
  });

  it('ein Eigentor von FC Nord ist ein Tor für SV Süd und beendet die Strafe von SV Süd nicht', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    expect(stand([start(), s, eigentor(mmss(2, 40), NORD)], mmss(2, 41)).aktiv).toEqual([s.id]);
  });
});

describe('@W2A-014 / @SL-095 Mehrere Zeitstrafen, ein Gegentor: es endet nur die mit der kürzesten Restzeit', () => {
  it('Strafe Nr. 5 seit 1:00 und Nr. 8 seit 1:30; Tor FC Nord bei 2:00 beendet Nr. 5, Nr. 8 läuft mit 1:30 weiter', () => {
    const nr5 = strafe(mmss(1, 0), SUED, 5);
    const nr8 = strafe(mmss(1, 30), SUED, 8);
    const s = stand([start(), nr5, nr8, tor(mmss(2, 0), NORD)], mmss(2, 0));
    expect(s.aktiv).toEqual([nr8.id]);
    expect(s.rest(nr8.id)).toBe(mmss(1, 30));
  });

  it('ein zweites Gegentor beendet dann auch die andere', () => {
    const nr5 = strafe(mmss(1, 0), SUED, 5);
    const nr8 = strafe(mmss(1, 30), SUED, 8);
    expect(stand([start(), nr5, nr8, tor(mmss(2, 0), NORD), tor(mmss(2, 20), NORD)], mmss(2, 30)).aktiv).toEqual([]);
  });
});

describe('@W2A-015 Zeitstrafe ohne Gegentor-Regel', () => {
  it('Regel aus: das Gegentor bei 2:40 ändert nichts, die Strafe läuft bis 4:00', () => {
    const s = strafe(mmss(2, 0), SUED, 5, false);
    const lauf = [start(), s, tor(mmss(2, 40), NORD)];
    const mitte = stand(lauf, mmss(3, 0));
    expect(mitte.aktiv).toEqual([s.id]);
    expect(mitte.rest(s.id)).toBe(mmss(1, 0));
    expect(mitte.ergaenzen).toEqual([]);
    expect(stand(lauf, mmss(4, 0)).aktiv).toEqual([]);
  });

  it('die Regel gilt je Strafe: eine ältere Strafe mit Regel an endet, die neuere mit Regel aus läuft', () => {
    const alt = strafe(mmss(1, 0), SUED, 5, true);
    const neu = strafe(mmss(1, 30), SUED, 8, false);
    expect(stand([start(), alt, neu, tor(mmss(2, 0), NORD)], mmss(2, 10)).aktiv).toEqual([neu.id]);
  });
});

describe('@SL-094 / @W2A-018 Bei gleicher Unterzahl beendet ein Tor keine Zeitstrafe', () => {
  it('FC Nord und SV Süd haben je eine laufende Strafe: ein Tor für FC Nord beendet nichts', () => {
    const nord = strafe(mmss(2, 0), NORD, 3);
    const sued = strafe(mmss(2, 10), SUED, 5);
    const s = stand([start(), nord, sued, tor(mmss(2, 40), NORD)], mmss(2, 41));
    expect(s.aktiv).toEqual([nord.id, sued.id]);
    expect(s.ergaenzen).toEqual([]);
  });

  it('läuft die Strafe des Torschützen-Teams schon nicht mehr, endet die des Gegners wieder beim Tor', () => {
    const nord = strafe(mmss(0, 0), NORD, 3);
    const sued = strafe(mmss(1, 50), SUED, 5);
    expect(stand([start(), nord, sued, tor(mmss(2, 30), NORD)], mmss(2, 31)).aktiv).toEqual([]);
  });
});

describe('@SL-044 Wird das Gegentor zurückgenommen, läuft die beendete Zeitstrafe weiter', () => {
  it('Strafe seit 2:00, Tor FC Nord bei 2:40, Rücknahme bei 2:50: Restzeit 1:10, kein Hinweis mehr', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    const t = tor(mmss(2, 40), NORD);
    expect(stand([start(), s, t], mmss(2, 49)).aktiv).toEqual([]);
    const zurueck = stand([start(), s, t, retract(mmss(2, 50), t)], mmss(2, 50));
    expect(zurueck.aktiv).toEqual([s.id]);
    expect(zurueck.rest(s.id)).toBe(mmss(1, 10));
    expect(zurueck.ergaenzen).toEqual([]);
  });

  it('ist ein weiteres Tor gefallen, beendet das die Strafe weiterhin', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    const erstes = tor(mmss(2, 40), NORD);
    const lauf = [start(), s, erstes, tor(mmss(3, 0), NORD), retract(mmss(3, 10), erstes)];
    expect(stand(lauf, mmss(3, 11)).aktiv).toEqual([]);
  });
});

describe('@SL-200 Ein Tor in derselben Sekunde wie der Strafbeginn beendet die Zeitstrafe nicht', () => {
  it('Strafe bei 2:00, Tor FC Nord ebenfalls bei 2:00: die Strafe läuft weiter bis 4:00', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    const lauf = [start(), s, tor(mmss(2, 0), NORD)];
    expect(stand(lauf, mmss(3, 59)).aktiv).toEqual([s.id]);
    expect(stand(lauf, mmss(4, 0)).aktiv).toEqual([]);
  });

  it('auch ein Tor am Ende derselben Sekunde (2:00,800 nach Strafe 2:00,200) zählt nicht', () => {
    const s = strafe(mmss(2, 0, 200), SUED, 5);
    expect(stand([start(), s, tor(mmss(2, 0, 800), NORD)], mmss(3, 0)).aktiv).toEqual([s.id]);
  });

  it('erst ein Tor von FC Nord nach 2:00 beendet sie', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    expect(stand([start(), s, tor(mmss(2, 0), NORD), tor(mmss(2, 1), NORD)], mmss(2, 2)).aktiv).toEqual([]);
  });
});

describe('Kern resolvePenalties (neutrale Eingabe, wie Monitor und Zuschauer sie liefern)', () => {
  const p = { id: 'p', teamId: SUED, startMs: mmss(2, 0), durationMs: mmss(2, 0) };
  it('Tore nach der betrachteten Spielzeit bleiben außen vor', () => {
    const tore = [{ id: 'g', scoringTeamId: NORD, atMs: mmss(2, 40) }];
    expect(resolvePenalties([p], tore, mmss(2, 30))[0]).toMatchObject({ endedByGoal: null, remainingMs: mmss(1, 30) });
    expect(resolvePenalties([p], tore, mmss(2, 40))[0]).toMatchObject({ endedByGoal: { id: 'g' }, remainingMs: 0 });
  });
});
