/**
 * H3b-4 Regel 2 neu („Hupe und Anzeige sagen dasselbe“, Daniel 07.11.): Die Tonlaufzeit tönt nur nach dem Stand am Server, die
 * Freigabe gilt bis 5 s Antwort-Alter (@HT-011), und der laufende Uhrabgleich verschiebt geplante Töne auf die neue Zeit, ohne
 * einen klingenden abzuschneiden (@HT-010, k4 aus H3b-2b). Echter Takt und Spieler, gefälschter Feldstand.
 * Werte aus `docs/anforderungen/2026-10-15_hallenton.md`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClockSync } from '../../../../core/match/client/ClockSync';
import { CTX_11, ENDE_A2, T0, server, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { Tab, feldAus } from './laufzeitTestlage';

/** Antworten laufend bis `netzWeg`, danach keine mehr (das Alter wächst). */
const antwortenBis = (netzWeg: number) => (jetzt: number): number => server(jetzt - Math.min(jetzt, netzWeg));

async function tabBisEnde(netzWeg: number): Promise<Tab> {
  const tab = new Tab({ start: ENDE_A2 - 12_000 });
  const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }], CTX_11, 'field-1', antwortenBis(netzWeg));
  tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  await tab.starte();
  return tab;
}

describe('@HT-011 Ohne Verbindung warnt der Lautsprecher und tönt nicht nach veraltetem Stand (5 s)', () => {
  it('@HT-011 letzte Antwort zum Ende 4,9 s alt → ein Ton, bis dahin keine Warnung', async () => {
    const tab = await tabBisEnde(ENDE_A2 - 4900);
    await tab.vor(ENDE_A2 - 100 - tab.uhr.jetzt());
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('ready');
    await tab.vor(6000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - ENDE_A2)).toBeLessThanOrEqual(20);
  });

  it('@HT-011 letzte Antwort zum Ende 5,1 s alt → kein Ton und die Warnung „keine Verbindung“', async () => {
    const tab = await tabBisEnde(ENDE_A2 - 5100);
    await tab.vor(ENDE_A2 + 6000 - tab.uhr.jetzt());
    expect(tab.toene()).toEqual([]);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('keineVerbindung');
  });
});

describe('@HT-010 laufender Uhrabgleich: maßgeblich bleibt nur die Serverzeit', () => {
  it('@HT-010 die Uhr des Rechners geht 20 s vor; der laufende Abgleich korrigiert den Versatz um 300 ms → das Ende tönt zur Serverzeit, genau einmal', async () => {
    let versatz = -20_000; // Serverzeit = Geräteuhr − 20 s
    const tab = new Tab({ start: ENDE_A2 + 20_000 - 15_000, serverVersatz: () => versatz });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt + versatz)];
    await tab.starte();
    // Abgleich 2 s vor dem Ende (der Ton ist schon beim Spieler): der Server liegt 300 ms weiter vor
    await tab.vor(22_000, [{ um: ENDE_A2 + 20_000 - 2000, tu: () => { versatz = -19_700; } }]);
    expect(tab.toene()).toHaveLength(1);
    // Geräteuhr des Tons = Serverzeit des Endes − Versatz nach dem Abgleich
    expect(Math.abs(tab.toene()[0].at - (ENDE_A2 + 19_700))).toBeLessThanOrEqual(20);
  });

  it('@HT-010 der Versatz ändert sich um 300 ms, während der Ton klingt → nicht abgeschnitten, kein zweiter Ton', async () => {
    let versatz = 0;
    const tab = new Tab({ start: ENDE_A2 - 6000, serverVersatz: () => versatz });
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt + versatz)];
    await tab.starte();
    await tab.vor(12_000, [{ um: ENDE_A2 + 100, tu: () => { versatz = 300; } }]);
    expect(tab.toene()).toHaveLength(1);
    const quelle = tab.kontext.quellen[0];
    expect(Math.min(...quelle.stops.map((s) => s ?? Infinity)) - quelle.starts[0]).toBeGreaterThanOrEqual(4.99);
  });
});

describe('@HT-010 laufender Abgleich der Engine-Uhr (die Laufzeit nutzt `engine.clock`)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('@HT-010 ohne Angabe misst die Uhr der Engine nach dem Start mindestens alle 5 Minuten neu', async () => {
    vi.useFakeTimers();
    const messen = vi.fn(() => Promise.resolve(T0));
    const uhr = new ClockSync(messen, () => Date.now(), { get: () => null, set: () => undefined });
    uhr.start();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    uhr.stop();
    expect(messen.mock.calls.length).toBeGreaterThanOrEqual(3); // eine Messreihe = 3 Versuche
  });
});
