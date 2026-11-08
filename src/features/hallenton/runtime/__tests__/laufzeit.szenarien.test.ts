/**
 * H3b-2b Tonlaufzeit: Szenarien aus `docs/anforderungen/2026-10-15_hallenton.md` (Gherkin-Wortlaut) mit echtem Takt-Adapter,
 * echtem Spieler und gefälschtem Feldstand – @HT-003, @HT-008, @HT-012, @HT-013, @HT-031, @HT-032 und @HT-033 Zeilen 2, 7.
 * Rechner der Turnierleitung = Hallen-Lautsprecher. Regel 2 (07.11.): gleich wer leitet, gilt der Stand am Server (Antwort
 * 200 ms alt). Ein Ereignis um `ab` ist 300 ms später am Rechner bekannt.
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent, MatchContext } from '../../../../core/match';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, CTX_HF, ENDE_A1, ENDE_A2, PAUSE_MS, T0, anpfiff, ev, gruppenRegeln, koRegeln, server,
  zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { Tab, feldAus, type Stufe } from './laufzeitTestlage';

async function hoere(stufen: Stufe[], von: number, bis: number, ctx: MatchContext = CTX_11) {
  const tab = new Tab({ start: von });
  const feld = feldAus(stufen, ctx);
  tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  await tab.starte();
  await tab.vor(bis - von);
  return tab.toene();
}

describe('@HT-003 Der Hallen-Lautsprecher tönt bei jedem Ende, nicht beim Anpfiff', () => {
  const log = zweiterAbschnitt();

  it('@HT-003 2 Abschnitte: die Spielzeit des zweiten Abschnitts abläuft → ertönt einmal der Abpfiff-Ton', async () => {
    const toene = await hoere([{ ab: T0, log }, { ab: ENDE_A2, log: [...log, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)] }], ENDE_A2 - 10_000, ENDE_A2 + 8000);
    expect(toene.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(toene[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 2 Abschnitte: Tom im zweiten Abschnitt von Hand abpfeift und die Rückfrage bestätigt → ertönt einmal der Abpfiff-Ton', async () => {
    const abpfiff = ENDE_A2 - 100_000;
    const toene = await hoere([{ ab: T0, log }, { ab: abpfiff, log: [...log, ev('MATCH_END', abpfiff, 2, 2 * ABSCHNITT_MS - 100_000)] }], abpfiff - 5000, ENDE_A2 + 3000);
    expect(toene.map((t) => t.art)).toEqual(['abpfiff']);
    expect(toene[0].at - abpfiff).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 2 Abschnitte: die Spielzeit des ersten Abschnitts abläuft → ertönt einmal der kürzere Halbzeit-Ton', async () => {
    const a1 = anpfiff();
    const toene = await hoere([{ ab: T0, log: a1 }, { ab: ENDE_A1, log: [...a1, ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS)] }], ENDE_A1 - 8000, ENDE_A1 + 8000);
    expect(toene.map((t) => t.art)).toEqual(['halbzeit']);
    expect(Math.abs(toene[0].at - ENDE_A1)).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 2 Abschnitte: Tom im ersten Abschnitt „Halbzeit“ wählt und die Rückfrage bestätigt → ertönt einmal der kürzere Halbzeit-Ton', async () => {
    const a1 = anpfiff();
    const halbzeit = T0 + 200_000;
    const toene = await hoere([{ ab: T0, log: a1 }, { ab: halbzeit, log: [...a1, ev('SECTION_END', halbzeit, 1, 200_000)] }], halbzeit - 4000, ENDE_A1 + 4000);
    expect(toene.map((t) => t.art)).toEqual(['halbzeit']);
    expect(toene[0].at - halbzeit).toBeLessThanOrEqual(1000);
  });

  it('@HT-003 3 Abschnitte: die Spielzeit des ersten Abschnitts abläuft → ertönt einmal der kürzere Halbzeit-Ton', async () => {
    const a1 = anpfiff(T0, gruppenRegeln(3));
    const toene = await hoere([{ ab: T0, log: a1 }, { ab: ENDE_A1, log: [...a1, ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS)] }], ENDE_A1 - 6000, ENDE_A1 + 6000);
    expect(toene.map((t) => t.art)).toEqual(['halbzeit']);
  });

  it('@HT-003 2 Abschnitte: Tom anpfeift → ertönt kein Ton', async () => {
    const toene = await hoere([{ ab: T0 - 60_000, log: [] }, { ab: T0, log: anpfiff() }], T0 - 5000, T0 + 10_000);
    expect(toene).toEqual([]);
  });

  it('@HT-003 2 Abschnitte: Tom nach der Halbzeitpause wieder anpfeift → ertönt kein Ton', async () => {
    const imPause = [...anpfiff(), ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS)];
    const wieder = ENDE_A1 + PAUSE_MS;
    const toene = await hoere([{ ab: ENDE_A1, log: imPause }, { ab: wieder, log: [...imPause, ev('SECTION_START', wieder, 2, null)] }], ENDE_A1 + 20_000, wieder + 10_000);
    expect(toene).toEqual([]);
  });
});

describe('@HT-008 Jedes Ende ertönt genau einmal, ein fortgesetztes Spiel endet erneut mit Ton', () => {
  it('@HT-008 Spiel 11 ist auf Toms Handy und in Ollis Cockpit offen, die Spielzeit läuft ab → genau einmal der Abpfiff-Ton; fortgesetzt → beim neuen Ende wieder genau einmal', async () => {
    const log = zweiterAbschnitt();
    const beendet = [...log, ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)];
    const doppelt = [...beendet, ev('MATCH_END', ENDE_A2 + 400, 2, 2 * ABSCHNITT_MS)];
    const fortgesetzt = ENDE_A2 + 30_000;
    const weiter = [...doppelt, ev('REOPEN', fortgesetzt, 2, 2 * ABSCHNITT_MS - 20_000)];
    const neuesEnde = fortgesetzt + 20_000;
    const toene = await hoere([
      { ab: T0, log }, { ab: ENDE_A2, log: beendet }, { ab: ENDE_A2 + 400, log: doppelt }, { ab: fortgesetzt, log: weiter },
      { ab: neuesEnde, log: [...weiter, ev('MATCH_END', neuesEnde, 2, 2 * ABSCHNITT_MS)] },
    ], ENDE_A2 - 5000, neuesEnde + 8000);
    expect(toene.map((t) => t.art)).toEqual(['abpfiff', 'abpfiff']);
    expect(Math.abs(toene[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    expect(Math.abs(toene[1].at - neuesEnde)).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-031 Verlängerung, Golden Goal und Strafstoßschießen haben feste Töne in der Halle', () => {
  const ENDE_REG = T0 + 660_000;
  const regulaer = (tiebreak: Parameters<typeof koRegeln>[0]): EngineEvent[] => [
    ev('MATCH_START', T0, 1, null, { payload: { rules: koRegeln(tiebreak) } }),
    ev('GOAL', T0 + 100_000, 1, 100_000, { teamId: CTX_HF.teamAId }),
    ev('SECTION_END', T0 + 300_000, 1, 300_000),
    ev('SECTION_START', T0 + 360_000, 2, null),
    ev('GOAL', T0 + 500_000, 2, 440_000, { teamId: CTX_HF.teamBId }),
  ];

  it('@HT-031 „Verlängerung, dann Strafstoßschießen“: die reguläre Spielzeit läuft bei 1:1 ab und die Verlängerung folgt → einmal der kürzere Halbzeit-Ton', async () => {
    const vor = regulaer('overtime-then-shootout');
    const toene = await hoere([{ ab: T0, log: vor }, { ab: ENDE_REG, log: [...vor, ev('MATCH_END', ENDE_REG, 2, 600_000)] }], ENDE_REG - 6000, ENDE_REG + 8000, CTX_HF);
    expect(toene.map((t) => t.art)).toEqual(['halbzeit']);
    expect(Math.abs(toene[0].at - ENDE_REG)).toBeLessThanOrEqual(1000);
  });

  it('@HT-031 „Strafstoßschießen“: die reguläre Spielzeit läuft bei 1:1 ab und das Strafstoßschießen folgt → einmal der Abpfiff-Ton', async () => {
    const vor = regulaer('shootout');
    const toene = await hoere([{ ab: T0, log: vor }, { ab: ENDE_REG, log: [...vor, ev('MATCH_END', ENDE_REG, 2, 600_000)] }], ENDE_REG - 6000, ENDE_REG + 8000, CTX_HF);
    expect(toene.map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-031 „Strafstoßschießen“: im Strafstoßschießen wird geschossen, bis es entschieden ist → kein Ton', async () => {
    let log = [...regulaer('shootout'), ev('MATCH_END', ENDE_REG, 2, 600_000)];
    const stufen: Stufe[] = [{ ab: ENDE_REG, log }];
    for (let i = 0; i < 3; i += 1) {
      const at = ENDE_REG + 20_000 + i * 10_000;
      log = [...log, ev('SHOOTOUT_KICK', at, 2, null, { teamId: CTX_HF.teamAId, payload: { scored: true } })];
      stufen.push({ ab: at, log });
      log = [...log, ev('SHOOTOUT_KICK', at + 5000, 2, null, { teamId: CTX_HF.teamBId, payload: { scored: false } })];
      stufen.push({ ab: at + 5000, log });
    }
    const entschieden = ENDE_REG + 55_000;
    stufen.push({ ab: entschieden, log: [...log, ev('SHOOTOUT_END', entschieden, 2, null)] });
    const toene = await hoere(stufen, ENDE_REG + 10_000, entschieden + 8000, CTX_HF);
    expect(toene).toEqual([]);
  });
});

async function zweiFelder(abstandMs: number, alterF2: number = server(200)) {
  const tab = new Tab({ start: ENDE_A2 - 8000, felder: [1, 2] });
  const f1 = feldAus([{ ab: T0, log: zweiterAbschnitt() }], CTX_11, 'field-1');
  const f2Start = T0 + abstandMs;
  const f2 = feldAus([{ ab: f2Start, log: zweiterAbschnitt(f2Start) }], CTX_12, 'field-2', alterF2);
  tab.ffs.staendeZu = (jetzt) => [f1(jetzt), f2(jetzt)];
  await tab.starte();
  await tab.vor(16_000);
  return tab.toene();
}

describe('@HT-032 Zwei Enden innerhalb von 1 Sekunde ergeben an einem Gerät einen Ton', () => {
  it('@HT-032 Spiel 11 endet und 0,5 Sekunden danach Spiel 12 auf Feld 2 → am Rechner einmal der Abpfiff-Ton', async () => {
    expect((await zweiFelder(500)).map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-032 Spiel 11 endet und 2 Sekunden danach Spiel 12 → für jedes Spiel einmal der Abpfiff-Ton', async () => {
    const toene = await zweiFelder(2000);
    expect(toene.map((t) => t.art)).toEqual(['abpfiff', 'abpfiff']);
    expect(Math.abs(toene[1].at - toene[0].at - 2000)).toBeLessThanOrEqual(100);
  });
});

describe('@HT-033 Die vier Regeln – Zeilen 2 und 7 an der Laufzeit', () => {
  it('@HT-033 Zeile 2: Laptop leitet und ist Lautsprecher → Laptop, einmal, nach dem Stand am Server wie der Monitor', async () => {
    const tab = new Tab({ start: ENDE_A2 - 8000 });
    const eigen = feldAus([{ ab: T0, log: zweiterAbschnitt() }], CTX_11, 'field-1', server(200));
    tab.ffs.staendeZu = (jetzt) => [eigen(jetzt)];
    await tab.starte();
    await tab.vor(14_000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
  });

  it('@HT-033 Zeile 7: F1 Handy, F2 Laptop, Laptop für beide → beide nach dem Stand am Server; gleichzeitig = ein Ton', async () => {
    expect((await zweiFelder(300, server(400))).map((t) => t.art)).toEqual(['abpfiff']);
  });
});

describe('@HT-012 Ohne „Ton aktivieren“ ist der Lautsprecher nicht bereit', () => {
  it('@HT-012 Schalter umgelegt, „Ton aktivieren“ nicht geklickt → nicht bereit („Ton nicht aktiviert“), kein Ton; der Klick aktiviert', async () => {
    const tab = new Tab({ start: ENDE_A2 - 20_000 });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte({ aktivieren: false });
    await tab.vor(2000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld).toEqual({ 'field-1': 'not_activated' });
    await tab.laufzeit.tonAktivieren();
    await tab.vor(500);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld).toEqual({ 'field-1': 'ready' });
    await tab.vor(25_000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('@HT-012 ohne Klick ertönt auch zum Ende kein Ton', async () => {
    const tab = new Tab({ start: ENDE_A2 - 6000 });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte({ aktivieren: false });
    await tab.vor(12_000);
    expect(tab.toene()).toEqual([]);
  });
});

describe('@HT-013 Nach dem Neuladen braucht der Lautsprecher wieder „Ton aktivieren“ und holt kein altes Ende nach', () => {
  it('@HT-013 neu geladen: nicht bereit bis „Ton aktivieren“; Spiel 11 seit mehr als 5 s zu Ende → kein Ton; das nächste Ende ertönt', async () => {
    const tab = new Tab({ start: ENDE_A2 + 1000 }); // die neu geladene App: leeres Gedächtnis
    const beendet = [...zweiterAbschnitt(), ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)];
    const start12 = ENDE_A2 + 60_000;
    const f1 = feldAus([{ ab: ENDE_A2, log: beendet }]);
    const f12 = feldAus([{ ab: start12, log: anpfiff(start12) }], CTX_12, 'field-1');
    tab.ffs.staendeZu = (jetzt) => [jetzt < start12 ? f1(jetzt) : f12(jetzt)];
    await tab.starte({ aktivieren: false });
    await tab.vor(1000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('not_activated');
    await tab.vor(5000); // jetzt seit 7 s zu Ende
    await tab.laufzeit.tonAktivieren();
    await tab.vor(10_000);
    expect(tab.toene()).toEqual([]);
    await tab.vor(start12 + ABSCHNITT_MS + 5000 - tab.uhr.jetzt());
    expect(tab.toene().map((t) => t.art)).toEqual(['halbzeit']);
    expect(Math.abs(tab.toene()[0].at - (start12 + ABSCHNITT_MS))).toBeLessThanOrEqual(1000);
  });
});
