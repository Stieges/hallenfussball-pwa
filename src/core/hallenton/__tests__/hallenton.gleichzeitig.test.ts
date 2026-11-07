/**
 * Mehrere Felder an einem Gerät, Enden innerhalb von 1 Sekunde und kein Nachholen: @HT-002, @HT-032, @HT-013 und die
 * Gegenbeispiele „Korrektur über die Grenze“. Testskelett aus dem Gherkin des Records.
 * Rechner der Turnierleitung = Hallen-Lautsprecher für Feld 1 und Feld 2; beide Felder leitet ein Handy (Stand am Server).
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent, MatchContext } from '../../match';
import { LEERES_GEDAECHTNIS, planeHallToene, type FeldStand } from '..';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A1, ENDE_A2, PAUSE_MS, T0, TAKT_VERSAETZE, anpfiff, ev, lauf, laufImTakt, server, stand,
  stateAus, zweiterAbschnitt,
} from './hallentonFixtures';

const LAUFZEIT_MS = 300;
const SPIELDAUER_MS = 2 * ABSCHNITT_MS + PAUSE_MS;

/** Feld mit Stand am Server: vor `endeAt + Laufzeit` der laufende Stand, danach der beendete. */
function feld(feldId: string, ctx: MatchContext, laufend: EngineEvent[], beendet: EngineEvent[], endeAt: number) {
  const vorher = stateAus(laufend, ctx);
  const nachher = stateAus(beendet, ctx);
  return (jetzt: number): FeldStand => jetzt < endeAt + LAUFZEIT_MS
    ? stand(vorher, ctx, server(0), T0 - 600_000, feldId)
    : stand(nachher, ctx, server(0), endeAt + LAUFZEIT_MS, feldId);
}

/** Spiel 12 auf Feld 2 endet von selbst um `ende` (Anpfiff entsprechend früher). */
function spiel12EndetUm(ende: number) {
  const log = zweiterAbschnitt(ende - SPIELDAUER_MS);
  return feld('feld-2', CTX_12, log, [...log, ev('MATCH_END', ende, 2, 2 * ABSCHNITT_MS)], ende);
}

const log11 = zweiterAbschnitt();
const spiel11Endet = feld('feld-1', CTX_11, log11, [...log11, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)], ENDE_A2);

describe('@HT-002 Ein Gerät übernimmt mehrere Felder', () => {
  it('@HT-002 endet Spiel 11 auf Feld 1 und 3 Sekunden später Spiel 12 auf Feld 2, ertönt für jedes Spiel einmal der Abpfiff-Ton', () => {
    const spiel12 = spiel12EndetUm(ENDE_A2 + 3000);
    const { gespielt } = lauf((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 10_000);
    expect(gespielt.map((t) => [t.art, t.felder])).toEqual([['abpfiff', ['feld-1']], ['abpfiff', ['feld-2']]]);
  });
});

describe('@HT-032 Zwei Enden innerhalb von 1 Sekunde ergeben an einem Gerät einen Ton', () => {
  it('@HT-032 Spiel 11 endet, 0,5 Sekunden danach Spiel 12 → am Rechner einmal der Abpfiff-Ton', () => {
    const spiel12 = spiel12EndetUm(ENDE_A2 + 500);
    const { gespielt } = lauf((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 10_000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    expect(gespielt[0].felder).toEqual(['feld-1', 'feld-2']);
  });

  it('@HT-032 Spiel 11 endet, 2 Sekunden danach Spiel 12 → am Rechner für jedes Spiel einmal der Abpfiff-Ton', () => {
    const spiel12 = spiel12EndetUm(ENDE_A2 + 2000);
    const { gespielt } = lauf((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 10_000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff', 'abpfiff']);
  });

  it('@HT-032 die Spielzeit des ersten Abschnitts von Spiel 11 läuft ab, 0,5 Sekunden danach endet Spiel 12 → einmal der Abpfiff-Ton', () => {
    const erster = anpfiff();
    const spiel11 = feld('feld-1', CTX_11, erster, [...erster, ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS)], ENDE_A1);
    const spiel12 = spiel12EndetUm(ENDE_A1 + 500);
    const { gespielt } = lauf((jetzt) => [spiel11(jetzt), spiel12(jetzt)], ENDE_A1 - 3000, ENDE_A1 + 10_000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-032 Spiel 11 endet von selbst, 0,5 Sekunden danach wird Spiel 12 von Hand abgepfiffen → am Rechner einmal der Abpfiff-Ton', () => {
    const start12 = ENDE_A2 + 60_000 - SPIELDAUER_MS;
    const log12 = zweiterAbschnitt(start12);
    const vonHand = ENDE_A2 + 500;
    const spiel12 = feld('feld-2', CTX_12, log12, [...log12, ev('MATCH_END', vonHand, 2, 2 * ABSCHNITT_MS - 59_500)], vonHand);
    const { gespielt } = lauf((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 10_000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-032 Gegenbeispiel: Spiel 12 sollte 0,8 s nach Spiel 11 enden, Tom hält vorher an – sein späteres Ende tönt eigens', () => {
    const start12 = ENDE_A2 + 800 - SPIELDAUER_MS;
    const log12 = zweiterAbschnitt(start12);
    const halt = ENDE_A2 + 300;
    const angehalten = [...log12, ev('PAUSE', halt, 2, null)];
    const weiter = [...angehalten, ev('RESUME', halt + 20_000, 2, null)];
    const ende12 = halt + 20_000 + 500;
    const beendet = [...weiter, ev('MATCH_END', ende12, 2, 2 * ABSCHNITT_MS)];
    const stufen = [
      { ab: T0, state: stateAus(log12, CTX_12) },
      { ab: halt, state: stateAus(angehalten, CTX_12) },
      { ab: halt + 20_000, state: stateAus(weiter, CTX_12) },
      { ab: ende12, state: stateAus(beendet, CTX_12) },
    ];
    const spiel12 = (jetzt: number): FeldStand => {
      const stufe = [...stufen].reverse().find((s) => jetzt >= s.ab + LAUFZEIT_MS) ?? stufen[0];
      return stand(stufe.state, CTX_12, server(0), stufe.ab + LAUFZEIT_MS, 'feld-2');
    };
    const { gespielt } = lauf((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ende12 + 5000);
    expect(gespielt.map((t) => t.felder)).toEqual([['feld-1', 'feld-2'], ['feld-2']]);
    expect(Math.abs(gespielt[1].at - ende12)).toBeLessThanOrEqual(1000);
  });

  it('@HT-032 Tom beendet den ersten Abschnitt von Spiel 11 von Hand, 0,5 Sekunden danach endet Spiel 12 → am Rechner einmal der Abpfiff-Ton, und kein zweiter Ton (Wortlaut 07.11.)', () => {
    const vonHand = T0 + 200_000;
    const erster = anpfiff();
    const spiel11 = feld('feld-1', CTX_11, erster, [...erster, ev('SECTION_END', vonHand, 1, 200_000)], vonHand);
    const spiel12 = spiel12EndetUm(vonHand + 500);
    const { gespielt } = lauf((jetzt) => [spiel11(jetzt), spiel12(jetzt)], vonHand - 3000, vonHand + 10_000);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
  });
});

describe('@HT-013 Nach dem Neuladen holt der Lautsprecher kein altes Ende nach', () => {
  const beendet = stateAus([...log11, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)]);

  it('@HT-013 ist Spiel 11 inzwischen seit mehr als 5 Sekunden zu Ende, ertönt dafür kein Ton', () => {
    const jetzt = ENDE_A2 + 5001;
    const plan = planeHallToene({ felder: [stand(beendet, CTX_11, server(0), jetzt)], serverNow: jetzt }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toEqual([]);
  });

  it('@HT-013 Gegenprobe: liegt das Ende erst 4 Sekunden zurück, ertönt es sofort', () => {
    const jetzt = ENDE_A2 + 4000;
    const plan = planeHallToene({ felder: [stand(beendet, CTX_11, server(0), jetzt)], serverNow: jetzt }, LEERES_GEDAECHTNIS);
    expect(plan.toene.map((t) => [t.art, t.at])).toEqual([['abpfiff', jetzt]]);
  });

  it('@HT-013 das nächste Ende auf Feld 1 ertönt wieder', () => {
    const neuGeladen = ENDE_A2 + 60_000;
    const naechstes = zweiterAbschnitt(neuGeladen + 120_000);
    const naechstesEnde = neuGeladen + 120_000 + SPIELDAUER_MS;
    const ctx13: MatchContext = { matchId: 'spiel-13', teamAId: 'sv-sued', teamBId: 'tsv-ost' };
    const spiel13 = feld('feld-1', ctx13, naechstes, [...naechstes, ev('MATCH_END', naechstesEnde, 2, 2 * ABSCHNITT_MS)], naechstesEnde);
    const felder = (jetzt: number) => [jetzt < neuGeladen + 120_000 ? stand(beendet, CTX_11, server(0), neuGeladen) : spiel13(jetzt)];
    // nach dem Neuladen: leeres Gedächtnis; das alte Ende bleibt still, das nächste tönt
    const vorher = lauf(felder, neuGeladen, neuGeladen + 5000, 500);
    expect(vorher.gespielt).toEqual([]);
    const { gespielt } = lauf(felder, naechstesEnde - 3000, naechstesEnde + 5000, 50, vorher.gedaechtnis);
    expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
  });
});

describe('Gegenbeispiel: Korrektur über die Grenze', () => {
  it('@HT-006 Tom stellt die Uhr kurz vor Ablauf zurück: kein Ton zur alten Zeit, genau einer zur neuen', () => {
    const zurueck = ENDE_A2 - 2000;
    const korrigiert = [...log11, ev('CLOCK_ADJUST', zurueck, 2, ABSCHNITT_MS + 300_000)];
    const neuesEnde = zurueck + 60_000;
    const felder = (jetzt: number): FeldStand[] => [
      jetzt < zurueck + LAUFZEIT_MS
        ? stand(stateAus(log11), CTX_11, server(0), T0)
        : stand(stateAus(korrigiert), CTX_11, server(0), zurueck + LAUFZEIT_MS),
    ];
    const { gespielt } = lauf(felder, ENDE_A2 - 3000, neuesEnde + 5000, 100);
    expect(gespielt).toHaveLength(1);
    expect(Math.abs(gespielt[0].at - neuesEnde)).toBeLessThanOrEqual(1000);
  });

  it('@HT-006 Tom stellt die Uhr 3 s über die Grenze: das Ende ist sofort erreicht, genau ein Ton', () => {
    const vor = ENDE_A2 - 60_000;
    const ueber = [...log11, ev('CLOCK_ADJUST', vor, 2, 2 * ABSCHNITT_MS + 3000)];
    const felder = (jetzt: number): FeldStand[] => [
      jetzt < vor + LAUFZEIT_MS
        ? stand(stateAus(log11), CTX_11, server(0), T0)
        : stand(stateAus(ueber), CTX_11, server(0), vor + LAUFZEIT_MS),
    ];
    const { gespielt } = lauf(felder, vor - 1000, vor + 10_000, 100);
    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].at - vor).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-032 im 1-s-Takt des Einbaus (Ton genau zu seinem Zeitpunkt, Plan nur jede Sekunde)', () => {
  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-032 Zeile 1, Versatz ${versatzMs} ms: Spiel 11 endet, 0,5 s danach Spiel 12 → einmal der Abpfiff-Ton`, () => {
      const spiel12 = spiel12EndetUm(ENDE_A2 + 500);
      const gespielt = laufImTakt((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 10_000, { versatzMs });
      expect(gespielt.map((t) => t.art)).toEqual(['abpfiff']);
    });

    const zeile4 = () => {
      const vonHand = T0 + 200_000;
      const erster = anpfiff();
      const spiel11 = feld('feld-1', CTX_11, erster, [...erster, ev('SECTION_END', vonHand, 1, 200_000)], vonHand);
      const spiel12 = spiel12EndetUm(vonHand + 500);
      return laufImTakt((jetzt) => [spiel11(jetzt), spiel12(jetzt)], vonHand - 3000, vonHand + 10_000, { versatzMs });
    };

    it(`@HT-032 Zeile 4, Versatz ${versatzMs} ms: erster Abschnitt von Spiel 11 von Hand beendet, 0,5 s danach endet Spiel 12 → genau ein Ton`, () => {
      expect(zeile4()).toHaveLength(1);
    });

    it(`@HT-032 Zeile 4, Versatz ${versatzMs} ms: … → am Rechner einmal der Abpfiff-Ton, und kein zweiter Ton`, () => {
      expect(zeile4().map((t) => t.art)).toEqual(['abpfiff']);
    });

    it(`@HT-032 Zeile 2, Versatz ${versatzMs} ms: 2 Sekunden Abstand → für jedes Spiel einmal der Abpfiff-Ton`, () => {
      const spiel12 = spiel12EndetUm(ENDE_A2 + 2000);
      const gespielt = laufImTakt((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ENDE_A2 + 10_000, { versatzMs });
      expect(gespielt.map((t) => t.art)).toEqual(['abpfiff', 'abpfiff']);
    });
  }
});

describe('Bedenken 1 (Controller 07.11.): die 5 s zählen ab dem Moment, in dem der Lautsprecher das Ende kennt', () => {
  it('@HT-006 Tom stellt die Uhr 20 s über die Grenze: genau ein Ton, sobald die Korrektur bekannt ist', () => {
    const korrektur = ENDE_A2 - 60_000;
    const ueber = [...log11, ev('CLOCK_ADJUST', korrektur, 2, 2 * ABSCHNITT_MS + 20_000)];
    const felder = (jetzt: number): FeldStand[] => [
      jetzt < korrektur + LAUFZEIT_MS
        ? stand(stateAus(log11), CTX_11, server(0), T0)
        : stand(stateAus(ueber), CTX_11, server(0), korrektur + LAUFZEIT_MS),
    ];
    const gespielt = laufImTakt(felder, korrektur - 2000, ENDE_A2 + 5000, { versatzMs: 300 });
    expect(gespielt).toHaveLength(1);
    expect(gespielt[0].at - korrektur).toBeLessThanOrEqual(1300);
  });

  it('@HT-006 Uhr 20 s über die Grenze, am Lautsprecher kommt gleich das beendete Spiel an: genau ein Ton', () => {
    const korrektur = ENDE_A2 - 60_000;
    const ueber = [...log11, ev('CLOCK_ADJUST', korrektur, 2, 2 * ABSCHNITT_MS + 20_000)];
    // das Cockpit beendet sofort mit der Grenze als Zeitpunkt (20 s vor der Korrektur)
    const beendet = [...ueber, ev('MATCH_END', korrektur - 20_000, 2, 2 * ABSCHNITT_MS)];
    const felder = (jetzt: number): FeldStand[] => [
      jetzt < korrektur + LAUFZEIT_MS
        ? stand(stateAus(log11), CTX_11, server(0), T0)
        : stand(stateAus(beendet), CTX_11, server(0), korrektur + LAUFZEIT_MS),
    ];
    const gespielt = laufImTakt(felder, korrektur - 2000, ENDE_A2 + 5000, { versatzMs: 300 });
    expect(gespielt).toHaveLength(1);
  });

  it('@HT-013 ein Ende, 4 s danach bekannt und erst 5,5 s nach dem Ende geplant, tönt noch (5 s ab Bekanntwerden)', () => {
    const beendet = stateAus([...log11, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)]);
    const plan = planeHallToene({ felder: [stand(beendet, CTX_11, server(0), ENDE_A2 + 4000)], serverNow: ENDE_A2 + 5500 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toHaveLength(1);
  });

  it('@HT-013 ein Ende, erst 5,5 s danach bekannt, tönt nicht', () => {
    const beendet = stateAus([...log11, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)]);
    const plan = planeHallToene({ felder: [stand(beendet, CTX_11, server(0), ENDE_A2 + 5500)], serverNow: ENDE_A2 + 5500 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toEqual([]);
  });

  it('@HT-013 ein bekanntes Ende, das mehr als 5 s nach Bekanntwerden noch nicht gespielt ist, tönt nicht mehr', () => {
    const beendet = stateAus([...log11, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)]);
    const plan = planeHallToene({ felder: [stand(beendet, CTX_11, server(0), ENDE_A2 + 1000)], serverNow: ENDE_A2 + 6500 }, LEERES_GEDAECHTNIS);
    expect(plan.toene).toEqual([]);
  });
});

describe('@HT-032 Gegenbeispiel im 1-s-Takt des Einbaus', () => {
  for (const versatzMs of TAKT_VERSAETZE) {
    it(`@HT-032 Versatz ${versatzMs} ms: Spiel 12 sollte 0,8 s nach Spiel 11 enden, Tom hält vorher an – sein späteres Ende tönt eigens`, () => {
      const start12 = ENDE_A2 + 800 - SPIELDAUER_MS;
      const log12 = zweiterAbschnitt(start12);
      const halt = ENDE_A2 + 300;
      const angehalten = [...log12, ev('PAUSE', halt, 2, null)];
      const weiter = [...angehalten, ev('RESUME', halt + 20_000, 2, null)];
      const ende12 = halt + 20_500;
      const stufen = [
        { ab: T0, state: stateAus(log12, CTX_12) },
        { ab: halt, state: stateAus(angehalten, CTX_12) },
        { ab: halt + 20_000, state: stateAus(weiter, CTX_12) },
        { ab: ende12, state: stateAus([...weiter, ev('MATCH_END', ende12, 2, 2 * ABSCHNITT_MS)], CTX_12) },
      ];
      const spiel12 = (jetzt: number): FeldStand => {
        const stufe = [...stufen].reverse().find((s) => jetzt >= s.ab + LAUFZEIT_MS) ?? stufen[0];
        return stand(stufe.state, CTX_12, server(0), stufe.ab + LAUFZEIT_MS, 'feld-2');
      };
      const gespielt = laufImTakt((jetzt) => [spiel11Endet(jetzt), spiel12(jetzt)], ENDE_A2 - 3000, ende12 + 5000, { versatzMs });
      expect(gespielt.map((t) => t.felder)).toEqual([['feld-1', 'feld-2'], ['feld-2']]);
    });
  }
});
