/**
 * H3b-2b Fixrunde 3 (Nachprüfung Fixrunde 2): k3-neu-1 Erneuern und Bewerten der Meldung mit derselben Uhr, k3-neu-2 die
 * Freigabe richtet sich nach dem hörbaren Beginn, k3-neu-3 eigene Toleranz des Reload-Tors (Ruling: 15 s, Regel 3: 2 s).
 * Werte aus `docs/anforderungen/2026-10-15_hallenton.md` (Regel 3, Regel 4, @HT-011, @HT-013).
 */
import { describe, expect, it } from 'vitest';
import { cockpitTonSchweigt } from '../../../../core/hallenton';
import { ENDE_A2, T0, anpfiff, server, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { bereiteLautsprecherFeldIds, erzeugeLautsprecherKanal, leseLautsprecherFelder } from '../lautsprecherKanal';
import { verbindeLautsprecherReloadTor } from '../lautsprecherReloadTor';
import { Tab, feldAus } from './laufzeitTestlage';

describe('k3-neu-1 – ein Abgleich der Uhr verschiebt die Frische der Meldung nicht (Regel 3)', () => {
  it('Regel 3: der Versatz der Serveruhr sinkt um 1,5 s → die Meldung bleibt frisch (nie älter als 2 s)', async () => {
    let versatz = 0;
    const tab = new Tab({ start: T0, serverVersatz: () => versatz });
    const feld = feldAus([{ ab: T0, log: anpfiff() }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt + versatz)];
    await tab.starte();
    await tab.vor(5000);
    versatz = -1500;
    for (let i = 0; i < 24; i += 1) {
      await tab.vor(250);
      expect(bereiteLautsprecherFeldIds(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt()))).toEqual(['field-1']);
    }
  });
});

describe('k3-neu-2 – die Freigabe vor dem hörbaren Beginn, danach läuft der Ton durch (@HT-011, Regel 4)', () => {
  const letzteAntwort = ENDE_A2 - 5100;
  const quelle = (jetzt: number) => server(jetzt - Math.min(jetzt, letzteAntwort));

  it('@HT-011 Ausgabe 200 ms verzögert, die Antwort fehlt zum Ton → abgebrochen vor dem hörbaren Beginn, nichts klingt an', async () => {
    // Takte bei ENDE − 400 ms und ENDE − 150 ms; hörbar ab ENDE − 200 ms
    const tab = new Tab({ start: ENDE_A2 - 5900 });
    tab.kontext.outputLatency = 0.2;
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }], undefined, 'field-1', quelle);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(10_000, [{ um: letzteAntwort, tu: () => { tab.ffs.haengt = true; } }]);
    expect(tab.toene()).toEqual([]);
    expect(tab.abgebrochen()).toBe(1);
  });

  it('Regel 4: der erste Takt nach einem Aussetzer liegt nach dem hörbaren Beginn → der Ton läuft durch, nicht abgeschnitten', async () => {
    const tab = new Tab({ start: ENDE_A2 - 5900 });
    tab.kontext.outputLatency = 0.2;
    const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }], undefined, 'field-1', quelle);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(10_000, [
      { um: letzteAntwort, tu: () => { tab.ffs.haengt = true; } },
      { um: ENDE_A2 - 500, tu: () => tab.takt.workerAussetzen() },
      { um: ENDE_A2 - 180, tu: () => tab.takt.workerWeiter() },
    ]);
    expect(tab.toene()).toHaveLength(1);
    const q = tab.kontext.quellen[0];
    expect(Math.min(...q.stops.map((s) => s ?? Infinity)) - q.starts[0]).toBeGreaterThanOrEqual(4.99);
  });
});

describe('k3-neu-3 – das Reload-Tor hat eine eigene Toleranz von 15 s (Ruling), Regel 3 bleibt bei 2 s', () => {
  it('Eintrag 5 s alt → das Tor ist zu, das Cockpit tönt; 20 s alt → das Tor ist offen', () => {
    const geraet = new FalschesGeraet();
    const uhr = new ManuelleUhr(T0);
    const lautsprecher = erzeugeLautsprecherKanal({ speicher: geraet.speicher, kanal: geraet.kanal(), tabId: 'A', jetzt: () => T0 });
    const andererTab = erzeugeLautsprecherKanal({ speicher: geraet.speicher, kanal: geraet.kanal(), tabId: 'B', jetzt: () => uhr.jetzt() });
    const tor = { offen: 0, halter: null as null | { allowsReload: () => boolean } };
    const loesen = verbindeLautsprecherReloadTor({
      kanal: andererTab,
      zeitgeber: uhr.gruppe('hauptB'),
      halteTor: (gate) => {
        tor.halter = gate;
        return () => { tor.halter = null; tor.offen += 1; };
      },
    });
    lautsprecher.melden({ turnierId: 'hallencup-nord', felder: [{ feld: 1, bereit: true }] }); // danach nie erneuert
    expect(tor.halter?.allowsReload()).toBe(false);
    uhr.vorruecken(5000);
    const schweigt = cockpitTonSchweigt('field-1', bereiteLautsprecherFeldIds(andererTab.lesen(), 'hallencup-nord'));
    expect(schweigt).toBe(false);
    expect(tor.halter?.allowsReload()).toBe(false);
    uhr.vorruecken(15_000);
    expect(tor.halter).toBeNull();
    expect(tor.offen).toBe(1);
    loesen();
  });
});
