/**
 * H3b-2b Fixrunde 2 (Nachprüfung Fixrunde 1): k-neu-1 ein klingender Ton wird nie abgeschnitten oder neu gestartet,
 * k-neu-4 eine stehende Ausgabe gibt die Sperre frei. Werte aus `docs/anforderungen/2026-10-15_hallenton.md`
 * (Regel 4 „jedes Ende genau einmal“, @HT-033 Zeile 8, @HT-012).
 */
import { describe, expect, it } from 'vitest';
import { ENDE_A2, T0, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { Tab, feldAus } from './laufzeitTestlage';

describe('k-neu-1 – ein Ton, der schon klingt, wird nie abgeschnitten oder neu gestartet (Regel 4)', () => {
  it('Regel 4: Ausgabe mit 200 ms Verzögerung (Bluetooth), der Uhr-Abgleich verschiebt die Abbildung, nachdem der Ton hörbar begonnen hat → ein Ton, nicht neu gestartet', async () => {
    let versatz = 0;
    // Takte bei ENDE − 150 ms und ENDE + 100 ms: der Takt um ENDE − 150 ms liegt nach dem hörbaren Beginn (ENDE − 200 ms)
    const tab = new Tab({ start: ENDE_A2 - 5900, serverVersatz: () => versatz });
    tab.kontext.outputLatency = 0.2;
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt + versatz)];
    await tab.starte();
    await tab.vor(10_000, [{ um: ENDE_A2 - 170, tu: () => { versatz = 60; } }]);
    expect(tab.kontext.quellen).toHaveLength(1);
    expect(tab.abgebrochen()).toBe(0);
    const quelle = tab.kontext.quellen[0];
    expect(Math.min(...quelle.stops.map((s) => s ?? Infinity)) - quelle.starts[0]).toBeGreaterThanOrEqual(4.99);
  });
});

describe('k-neu-4 – steht die Ausgabe des Halters, gibt er die Sperre frei (@HT-033 Zeile 8, @HT-012)', () => {
  it('@HT-033 Zeile 8: Tab A hält die Sperre, seine Ausgabe fällt auf „nicht aktiviert“ → der aktivierte Tab B übernimmt und tönt', async () => {
    const geraet = new FalschesGeraet();
    const uhr = new ManuelleUhr(ENDE_A2 - 10_000);
    const a = new Tab({ start: 0, geraet, uhr, name: 'A' });
    const b = new Tab({ start: 0, geraet, uhr, name: 'B' });
    for (const tab of [a, b]) {
      const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
      tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    }
    await a.starte();
    await b.starte();
    expect(a.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(b.laufzeit.getSnapshot().rolle).toBe('andererTab');
    a.kontext.zustandSetzen('interrupted'); // z. B. Safari unterbricht die Ausgabe
    await b.vor(500);
    expect(a.laufzeit.getSnapshot().rolle).toBe('wartet');
    expect(b.laufzeit.getSnapshot().rolle).toBe('toent');
    await b.vor(12_000);
    expect(b.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(a.toene()).toEqual([]);
  });

  it('läuft die Ausgabe von A wieder, stellt A sich hinten an (andererTab), B tönt weiter – nie beide', async () => {
    const geraet = new FalschesGeraet();
    const uhr = new ManuelleUhr(ENDE_A2 - 10_000);
    const a = new Tab({ start: 0, geraet, uhr, name: 'A' });
    const b = new Tab({ start: 0, geraet, uhr, name: 'B' });
    for (const tab of [a, b]) {
      const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }]);
      tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    }
    await a.starte();
    await b.starte();
    a.kontext.zustandSetzen('interrupted');
    await b.vor(300);
    a.kontext.zustandSetzen('running');
    await b.vor(12_000);
    expect(a.laufzeit.getSnapshot().rolle).toBe('andererTab');
    expect(b.toene()).toHaveLength(1);
    expect(a.toene()).toEqual([]);
  });
});
