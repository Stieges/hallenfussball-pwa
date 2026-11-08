/**
 * Zeitstrafe endet beim Gegentor (Befund C-ZEITSTRAFE-GEGENTOR-FEHLT): das Ende wird aus den Ereignissen abgeleitet.
 * Testwerte aus dem Gherkin: Record Regelinhalte @W2A-013, @W2A-014, @W2A-015, @W2A-018; Record Spiel leiten @SL-030, @SL-044,
 * @SL-092, @SL-094, @SL-095, @SL-200, @SL-203, @SL-204, @SL-205; @W2A-079. FC Nord (Team A) – SV Süd (Team B); Zeiten in Spielzeit, Anpfiff bei at = 1000.
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../reduceMatch';
import { phaseViewOf } from '../client/phaseView';
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
    expect(stand(lauf, mmss(2, 45))).toMatchObject({ aktiv: [], ergaenzen: [SUED] });
    expect(stand([...lauf], mmss(2, 45))).toMatchObject({ aktiv: [], ergaenzen: [SUED] });
  });

  it('ein Tor des bestraften Teams selbst beendet seine Strafe nicht', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    expect(stand([start(), s, tor(mmss(2, 40), SUED)], mmss(2, 50)).aktiv).toEqual([s.id]);
  });

  it('ein Gegentor VOR der Strafe beendet sie nicht', () => {
    const s = strafe(mmss(2, 0), SUED, 5);
    expect(stand([start(), tor(mmss(1, 0), NORD), s], mmss(2, 30)).aktiv).toEqual([s.id]);
  });
});

describe('@SL-204 Der Hinweis „darf sich ergänzen“ steht nach dem Gegentor 10 Sekunden Spielzeit', () => {
  const lauf = () => [start(), strafe(mmss(2, 0), SUED, 5), tor(mmss(2, 40), NORD)];

  it('@SL-204 die Strafe von SV Süd endete bei 2:40 durch ein Tor: bis 2:49 steht der Hinweis, bei 2:50 nicht mehr', () => {
    expect(stand(lauf(), mmss(2, 49, 999)).ergaenzen).toEqual([SUED]);
    expect(stand(lauf(), mmss(2, 50)).ergaenzen).toEqual([]);
  });

  it('@SL-204 bekommt SV Süd vorher eine neue Zeitstrafe, verschwindet der Hinweis sofort', () => {
    expect(stand([...lauf(), strafe(mmss(2, 44), SUED, 8)], mmss(2, 45)).ergaenzen).toEqual([]);
  });

  it('@SL-204 Gegenbeispiel: eine neue Strafe des ANDEREN Teams lässt den Hinweis stehen', () => {
    expect(stand([...lauf(), strafe(mmss(2, 44), NORD, 3)], mmss(2, 45)).ergaenzen).toEqual([SUED]);
  });

  it('@SL-204 eine zweite, noch laufende Strafe von SV Süd, die schon vor dem Tor lief, zählt nicht als „neu“', () => {
    const vorher = strafe(mmss(2, 10), SUED, 8, false);
    expect(stand([start(), strafe(mmss(2, 0), SUED, 5), vorher, tor(mmss(2, 40), NORD)], mmss(2, 45)).ergaenzen).toEqual([SUED]);
  });

  const mitHalbzeit = () => {
    const s = strafe(mmss(9, 30), SUED, 5);
    const t = tor(mmss(9, 55), NORD);
    const ende = ev('SECTION_END', mmss(10, 0), null, {}, { at: 601_000 });
    return { s, t, ende };
  };

  it('@SL-204 in der Halbzeitpause steht der Hinweis nicht (Tor 9:55, Pause ab 10:00)', () => {
    const { s, t, ende } = mitHalbzeit();
    const { state } = reduceMatch([start(), s, t, ende], ctx);
    expect(state.status).toBe('section_break');
    expect(phaseViewOf(state, ctx, 601_000).ergaenzenTeamIds).toEqual([]);
  });

  it('@SL-204 Gegenbeispiel: im laufenden Abschnitt zeigt phaseViewOf den Hinweis', () => {
    const { s, t } = mitHalbzeit();
    const { state } = reduceMatch([start(), s, t], ctx);
    expect(phaseViewOf(state, ctx, 1000 + mmss(9, 57)).ergaenzenTeamIds).toEqual([SUED]);
  });

  it('@SL-204 nach der Pause (2. Halbzeit läuft) kommt der Hinweis eines Tores aus der 1. Halbzeit nicht zurück', () => {
    const { s, t, ende } = mitHalbzeit();
    const weiter = ev('SECTION_START', 600_000, null, {}, { at: 661_000, section: 2 });
    const { state } = reduceMatch([start(), s, t, ende, weiter], ctx);
    expect(state.status).toBe('running');
    expect(phaseViewOf(state, ctx, 661_000 + 2_000).ergaenzenTeamIds).toEqual([]);
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
});

describe('@W2A-079 Die Gegentor-Regel gilt für Zeitstrafen ab ihrem Eintrag', () => {
  it('@W2A-079 Strafe seit 3:00 mit Regel an; die Regel wird bei 3:30 ausgeschaltet, eine Strafe bei 3:35 trägt „aus“; Tor bei 3:40 beendet nur die ältere', () => {
    const alt = strafe(mmss(3, 0), SUED, 5, true);
    const neu = strafe(mmss(3, 35), SUED, 8, false);
    const s = stand([start(), alt, neu, tor(mmss(3, 40), NORD)], mmss(3, 41));
    expect(s.aktiv).toEqual([neu.id]);
  });

  it('@W2A-079 umgekehrt: Regel aus beim Eintrag der älteren, an bei der neueren: das Tor beendet die neuere (kürzeste Restzeit unter den beendbaren)', () => {
    const alt = strafe(mmss(3, 0), SUED, 5, false);
    const neu = strafe(mmss(3, 35), SUED, 8, true);
    expect(stand([start(), alt, neu, tor(mmss(3, 40), NORD)], mmss(3, 41)).aktiv).toEqual([alt.id]);
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

  it('@SL-094 Strafen mit Regel „aus“ zählen mit: je eine laufende Strafe, eine davon „aus“, beendet nichts', () => {
    const nord = strafe(mmss(2, 0), NORD, 3, false);
    const sued = strafe(mmss(2, 10), SUED, 5);
    expect(stand([start(), nord, sued, tor(mmss(2, 40), NORD)], mmss(2, 41)).aktiv).toEqual([nord.id, sued.id]);
  });
});

describe('@SL-203 Bei ungleicher Unterzahl beendet ein Tor die kürzeste Zeitstrafe des Teams mit mehr Strafen', () => {
  // FC Nord: zwei Strafen, die bei 6:10 und 7:00 enden; SV Süd: eine Strafe; SV Süd trifft bei 5:30
  const aufbau = () => {
    const nord1 = strafe(mmss(4, 10), NORD, 3); // endet 6:10
    const nord2 = strafe(mmss(5, 0), NORD, 4); // endet 7:00
    const sued = strafe(mmss(5, 0), SUED, 5);
    return { nord1, nord2, sued, lauf: [start(), nord1, nord2, sued] };
  };

  it('@SL-203 Tor für SV Süd bei 5:30: die Strafe von FC Nord, die bei 6:10 endete, endet; die zweite und die von SV Süd laufen weiter', () => {
    const { nord1, nord2, sued, lauf } = aufbau();
    const s = stand([...lauf, tor(mmss(5, 30), SUED)], mmss(5, 31));
    expect(s.aktiv).toEqual([nord2.id, sued.id]);
    expect(s.aktiv).not.toContain(nord1.id);
    expect(s.ergaenzen).toEqual([NORD]);
  });

  it('@SL-203 erzielt SV Süd danach ein weiteres Tor, endet nichts mehr (beide in gleicher Unterzahl)', () => {
    const { nord2, sued, lauf } = aufbau();
    expect(stand([...lauf, tor(mmss(5, 30), SUED), tor(mmss(5, 45), SUED)], mmss(5, 46)).aktiv).toEqual([nord2.id, sued.id]);
  });

  it('@SL-203 Gegenbeispiel: trifft das Team mit den MEISTEN Strafen (FC Nord, 2 gegen 1), endet nichts', () => {
    const { nord1, nord2, sued, lauf } = aufbau();
    expect(stand([...lauf, tor(mmss(5, 30), NORD)], mmss(5, 31)).aktiv).toEqual([nord1.id, nord2.id, sued.id]);
  });

  it('@SL-203 Strafen mit Regel „aus“ zählen beim Zählen mit: FC Nord 2 (eine „aus“) gegen SV Süd 1, Tor SV Süd beendet die beendbare', () => {
    const nord1 = strafe(mmss(4, 10), NORD, 3, false);
    const nord2 = strafe(mmss(5, 0), NORD, 4, true);
    const sued = strafe(mmss(5, 0), SUED, 5);
    expect(stand([start(), nord1, nord2, sued, tor(mmss(5, 30), SUED)], mmss(5, 31)).aktiv).toEqual([nord1.id, sued.id]);
  });

  it('@SL-203 sind alle Strafen des Gegners mit Regel „aus“ und mehr als die eigenen, beendet das Tor nichts', () => {
    const nord1 = strafe(mmss(4, 10), NORD, 3, false);
    const nord2 = strafe(mmss(5, 0), NORD, 4, false);
    const sued = strafe(mmss(5, 0), SUED, 5);
    expect(stand([start(), nord1, nord2, sued, tor(mmss(5, 30), SUED)], mmss(5, 31)).aktiv).toEqual([nord1.id, nord2.id, sued.id]);
  });
});

describe('@SL-205 Haben zwei Zeitstrafen dieselbe Restzeit, beendet ein Gegentor die zuerst eingetragene', () => {
  it('@SL-205 SV Süd hat zwei Strafen, die beide bei 6:00 enden, Nr. 5 wurde zuerst eingetragen; Tor FC Nord bei 5:00 beendet Nr. 5', () => {
    const nr5 = strafe(mmss(4, 0), SUED, 5);
    const nr8 = strafe(mmss(4, 0), SUED, 8);
    const s = stand([start(), nr5, nr8, tor(mmss(5, 0), NORD)], mmss(5, 1));
    expect(s.aktiv).toEqual([nr8.id]);
  });

  it('@SL-205 die Reihenfolge des Eintrags entscheidet, nicht die Nummer: Nr. 8 zuerst eingetragen, dann endet Nr. 8', () => {
    const nr8 = strafe(mmss(4, 0), SUED, 8);
    const nr5 = strafe(mmss(4, 0), SUED, 5);
    expect(stand([start(), nr8, nr5, tor(mmss(5, 0), NORD)], mmss(5, 1)).aktiv).toEqual([nr5.id]);
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

describe('Tor nach einer Strafe über die Halbzeit und in der Verlängerung (die Spieluhr zählt kumulativ, @FU-074)', () => {
  const abschnitt = (type: 'SECTION_END' | 'SECTION_START' | 'MATCH_END', clockMs: number, section: number) =>
    ev(type, clockMs, null, {}, { section, at: 1000 + clockMs + (type === 'SECTION_START' ? 60_000 : 0) });

  it('Strafe bei 9:30 (1. Halbzeit), Pause, Tor bei 10:30 (2. Halbzeit): die Strafe ist beendet', () => {
    const s = strafe(mmss(9, 30), SUED, 5);
    const lauf = [start(), s, abschnitt('SECTION_END', mmss(10, 0), 1), abschnitt('SECTION_START', mmss(10, 0), 2)];
    expect(stand(lauf, mmss(10, 20)).rest(s.id)).toBe(mmss(1, 10));
    const ende = stand([...lauf, ev('GOAL', mmss(10, 30), NORD, {}, { section: 2, at: 1000 + mmss(10, 30) + 60_000 })], mmss(10, 31));
    expect(ende.aktiv).toEqual([]);
    expect(ende.ergaenzen).toEqual([SUED]);
  });

  it('Gegenbeispiel: ohne Tor läuft dieselbe Strafe über die Pause weiter (Rest 1:00 bei 10:30)', () => {
    const s = strafe(mmss(9, 30), SUED, 5);
    const lauf = [start(), s, abschnitt('SECTION_END', mmss(10, 0), 1), abschnitt('SECTION_START', mmss(10, 0), 2)];
    expect(stand(lauf, mmss(10, 30)).rest(s.id)).toBe(mmss(1, 0));
  });

  it('Strafe kurz vor dem Ende der regulären Zeit, Verlängerung, Tor in der Verlängerung: die Strafe ist beendet', () => {
    const rules = { sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: true, tiebreak: 'overtime-then-shootout', overtimeSeconds: 300, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120 };
    const anpfiff = ev('MATCH_START', null, null, { rules });
    const s = ev('TIME_PENALTY', mmss(19, 30), SUED, { playerNumber: 5, durationSeconds: 120 }, { section: 2 });
    const lauf = [
      anpfiff, abschnitt('SECTION_END', mmss(10, 0), 1), abschnitt('SECTION_START', mmss(10, 0), 2), s,
      abschnitt('MATCH_END', mmss(20, 0), 2), abschnitt('SECTION_START', mmss(20, 0), 3),
    ];
    expect(stand(lauf, mmss(20, 30)).rest(s.id)).toBe(mmss(1, 0));
    const ende = stand([...lauf, ev('GOAL', mmss(20, 30), NORD, {}, { section: 3, at: 1000 + mmss(20, 30) + 120_000 })], mmss(20, 31));
    expect(ende.aktiv).toEqual([]);
  });
});
