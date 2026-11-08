/**
 * H3b-2b Fixrunde 1 (Review `task-h3b2b-review.md`): W1 Uhrsprung nach dem
 * Beginn, W2 Gedächtnis über Tabs und Neuladen, W3 Sperre erst nach „Ton aktivieren“, k3 Mehrfeld-Ton, k4 neuer Uhr-Versatz.
 * Werte aus `docs/anforderungen/2026-10-15_hallenton.md` (Regeln 2 und 4, @HT-010, @HT-013, @HT-033 Zeile 8). K1 (eigenes Cockpit)
 * entfällt mit Regel 2 vom 07.11.; seine Lagen prüft `laufzeit.serverstand.test.ts` nach dem neuen Wortlaut.
 */
import { describe, expect, it } from 'vitest';
import {
  ABSCHNITT_MS, CTX_11, CTX_12, ENDE_A2, T0, ev, server, zweiterAbschnitt,
} from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { Tab, feldAus } from './laufzeitTestlage';

describe('W1 – ein Uhrsprung bricht einen begonnenen Ton nicht ab (@HT-010, Regel 4)', () => {
  it('@HT-010 Sprung 100 ms nach dem Ton → genau ein Ton, nicht abgeschnitten', async () => {
    let versatz = 0;
    // Takte bei ENDE − 100 ms und ENDE + 150 ms: der Sprung fällt in den ersten Takt nach dem Beginn, vor dessen Bestätigung
    const tab = new Tab({ start: ENDE_A2 - 5850, serverVersatz: () => versatz, beiSync: () => { versatz = 0; } });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(14_000, [{ um: ENDE_A2 + 100, tu: () => { versatz = 2000; tab.wandVersatz = 2000; } }]);
    expect(tab.syncAufrufe).toBe(1);
    expect(tab.toene()).toHaveLength(1);
    const quelle = tab.kontext.quellen[0];
    expect(Math.min(...quelle.stops.map((s) => s ?? Infinity)) - quelle.starts[0]).toBeGreaterThanOrEqual(4.99);
  });
});

describe('W2 – jedes Ende genau einmal je Gerät, auch über Tabs und Neuladen (Regel 4)', () => {
  const beendet = [...zweiterAbschnitt(), ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)];
  const lage = [{ ab: T0, log: zweiterAbschnitt() }, { ab: ENDE_A2, log: beendet }];

  it('@HT-033 Zeile 8: Tab A tönt das Ende und schließt 2 s danach, der aktivierte Tab B übernimmt → kein zweiter Ton', async () => {
    const geraet = new FalschesGeraet();
    const uhr = new ManuelleUhr(ENDE_A2 - 6000);
    const a = new Tab({ start: 0, geraet, uhr, name: 'A' });
    const b = new Tab({ start: 0, geraet, uhr, name: 'B' });
    for (const tab of [a, b]) {
      const feld = feldAus(lage);
      tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    }
    await a.starte();
    await b.starte();
    await a.vor(8000);
    expect(a.toene()).toHaveLength(1);
    a.laufzeit.stop();
    await b.vor(6000);
    expect(b.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(b.toene()).toEqual([]);
  });

  it('@HT-013 neu geladen und innerhalb von 5 s aktiviert → das schon gespielte Ende tönt nicht noch einmal', async () => {
    const geraet = new FalschesGeraet();
    const vorher = new Tab({ start: ENDE_A2 - 5000, geraet });
    const feld = feldAus(lage);
    vorher.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await vorher.starte();
    await vorher.vor(6000);
    expect(vorher.toene()).toHaveLength(1);
    vorher.laufzeit.stop();
    const neu = new Tab({ start: ENDE_A2 + 1000, geraet });
    neu.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await neu.starte({ aktivieren: false });
    await neu.vor(1000);
    await neu.laufzeit.tonAktivieren();
    await neu.vor(8000);
    expect(neu.toene()).toEqual([]);
  });
});

describe('W3 – die Sperre gehört dem Tab, in dem „Ton aktivieren“ geklickt wurde (@HT-033 Zeile 8, @HT-012)', () => {
  it('@HT-033 Zeile 8: A (Cockpit-Tab, nicht aktiviert) und B (aktiviert) → B tönt, A tönt nicht und wartet ohne Last', async () => {
    const geraet = new FalschesGeraet();
    const uhr = new ManuelleUhr(ENDE_A2 - 6000);
    const a = new Tab({ start: 0, geraet, uhr, name: 'A' });
    const b = new Tab({ start: 0, geraet, uhr, name: 'B' });
    for (const tab of [a, b]) {
      const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
      tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    }
    await a.starte({ aktivieren: false });
    await b.starte();
    await b.vor(10_000);
    expect(b.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(b.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(a.laufzeit.getSnapshot().rolle).toBe('wartet');
    expect(a.toene()).toEqual([]);
    expect(a.takt.erzeugt()).toBe(0);
    expect(a.ffs.aufrufe).toBe(0);
  });
});

describe('k1 – steht die Ausgabe bei `at`, wird der Ton beim Spieler abgebrochen (@HT-013 kein Ton nach altem Stand)', () => {
  it('@HT-013 der AudioContext wird 1 s vor dem Ende unterbrochen → der eingeplante Ton bleibt nicht beim Spieler liegen', async () => {
    const tab = new Tab({ start: ENDE_A2 - 6000 });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(5000);
    expect(tab.spieler.geplant()).toHaveLength(1);
    tab.kontext.zustandSetzen('suspended');
    await tab.vor(1500);
    expect(tab.spieler.geplant()).toEqual([]);
  });
});

describe('k3 – ein Mehrfeld-Ton erledigt nur die Enden der freien Felder', () => {
  it('@HT-032 Feld 2 ohne frische Antwort tönt mit; war es in Wahrheit angehalten, tönt sein echtes Ende später', async () => {
    const tab = new Tab({ start: ENDE_A2 - 6000, felder: [1, 2] });
    const f1 = feldAus([{ ab: T0, log: zweiterAbschnitt() }], CTX_11, 'field-1', server(100));
    // Feld 2 endet 300 ms vor Feld 1 (ein gemeinsamer Ton zu ENDE − 300 ms); seine letzte Antwort ist 5,1 s älter als der Ton
    const start12 = T0 - 300;
    const log12 = zweiterAbschnitt(start12);
    const pause = ev('PAUSE', ENDE_A2 - 1300, 2, null);
    const weiter = ev('RESUME', ENDE_A2 + 5000, 2, null);
    const letzteAntwort = ENDE_A2 - 5400;
    const f2 = feldAus(
      [{ ab: start12, log: log12 }, { ab: ENDE_A2 + 1700, log: [...log12, pause] }, { ab: ENDE_A2 + 5000, log: [...log12, pause, weiter] }],
      CTX_12, 'field-2', (jetzt) => (jetzt < ENDE_A2 + 2000 ? server(jetzt - Math.min(jetzt, letzteAntwort)) : server(100)),
    );
    tab.ffs.staendeZu = (jetzt) => [f1(jetzt), f2(jetzt)];
    await tab.starte();
    await tab.vor(20_000);
    const toene = tab.toene();
    expect(toene).toHaveLength(2);
    expect(Math.abs(toene[0].at - (ENDE_A2 - 300))).toBeLessThanOrEqual(300);
    expect(Math.abs(toene[1].at - (ENDE_A2 + 6000))).toBeLessThanOrEqual(1000);
  });
});

describe('k4 – ändert der Abgleich den Versatz der Uhr, wird ein übergebener Ton neu abgebildet (@HT-010)', () => {
  it('@HT-010 der Server liegt nach dem Abgleich 500 ms vor → der schon geplante Ton erklingt zur Serverzeit des Endes', async () => {
    let versatz = 0;
    const tab = new Tab({ start: ENDE_A2 - 6000, serverVersatz: () => versatz });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt + versatz)];
    await tab.starte();
    await tab.vor(8000, [{ um: ENDE_A2 - 2000, tu: () => { versatz = 500; } }]);
    expect(tab.toene()).toHaveLength(1);
    // Uhr des Geräts: der Ton liegt 500 ms früher, also genau bei Serverzeit ENDE_A2
    expect(Math.abs(tab.toene()[0].at - (ENDE_A2 - 500))).toBeLessThanOrEqual(20);
  });
});
