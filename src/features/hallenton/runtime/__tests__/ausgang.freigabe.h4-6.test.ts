/**
 * H4-6 Fixrunde 1, Nachtrag: @HT-054 Zeile 5 (Freigabe fällt mitten im Betrieb weg: der in dieser Sitzung gesetzte Ausgang gilt, bis
 * er nachweislich fehlt oder die Ausgabe stehen bleibt) und Zeile 6 (Ausgang wechseln, während ein Ton läuft – heutiges Verhalten).
 * Nach dem Neuladen gilt weiter @HT-055. Uhr von Hand, keine festen Wartezeiten.
 */
import { describe, expect, it } from 'vitest';
import { ABSCHNITT_MS, ENDE_A2, T0, ev, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { AUSGAENGE, FalscheMedienGeraete, type FalscherAusgang } from '../../../../test/hallenton/falscheMedienGeraete';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { AUSGANG_SCHLUESSEL } from '../ausgang/ausgangWahl';
import { feldAus } from './laufzeitTestlage';
import { LzTab } from './lebenszeichenTestlage';

const DOCK: FalscherAusgang = AUSGAENGE.find((a) => a.id === 'dock')!;
const LG: FalscherAusgang = AUSGAENGE.find((a) => a.id === 'lg')!;
const BEENDET = [...zweiterAbschnitt(), ev('MATCH_END', ENDE_A2, 2, 2 * ABSCHNITT_MS)];
const wahlVon = (a: FalscherAusgang) => ({ id: a.id, name: a.name, gruppe: a.gruppe });

function lage(o: { gespeichert?: FalscherAusgang } = {}) {
  const uhr = new ManuelleUhr(ENDE_A2 - 30_000);
  const medien = new FalscheMedienGeraete();
  medien.erlaubt = true;
  medien.dauerhaft = true;
  const server = new FalscherHallServer(() => uhr.jetzt(), (fn, ms) => { uhr.gruppe('netz').spaeter(fn, ms); });
  server.zuordnen(1, 'laptop');
  const geraet = new FalschesGeraet();
  if (o.gespeichert) {
    geraet.speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify(wahlVon(o.gespeichert)));
  }
  return { uhr, medien, server, geraet };
}
type Lage = ReturnType<typeof lage>;

function tab(l: Lage, name = 'A', mitMedien = true): LzTab {
  const t = new LzTab({ start: l.uhr.jetzt(), uhr: l.uhr, geraet: l.geraet, server: l.server, name, medien: mitMedien ? l.medien : undefined });
  const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }, { ab: ENDE_A2, log: BEENDET }]);
  t.tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  t.tab.kontext.vorhandeneAusgaenge = new Set(l.medien.ausgaenge.map((a) => a.id));
  return t;
}

const zustand = (t: LzTab) => t.tab.laufzeit.getSnapshot().geraeteZustand;


async function dockLaeuft() {
  const l = lage({ gespeichert: DOCK });
  const a = tab(l);
  await a.starte();
  await a.vor(3000);
  expect(zustand(a)).toBe('ready');
  return { l, a };
}

/** Der Browser gibt mitten im Betrieb keine Kennungen mehr heraus (Mikrofon nur „dieses Mal“, Freigabe weg). */
function freigabeWeg(l: Lage): void {
  l.medien.erlaubt = false;
  l.medien.geraeteWechsel();
}

describe('@HT-054 Zeile 5 Freigabe fällt mitten im Betrieb weg', () => {
  it('(a) Ausgang gesetzt, Ausgabe läuft, das Lesen liefert leere Kennungen → bleibt bereit, Sperre bleibt, das Ende tönt pünktlich über das Dock, Lebenszeichen weiter „ready“', async () => {
    const { l, a } = await dockLaeuft();
    freigabeWeg(l);
    await a.vor(2000);
    expect(l.medien.erlaubnisAbfragen).toBeGreaterThan(0);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(l.geraet.sperren.gehalten()).toBe(true);
    const nachher = l.server.lebenszeichen.length;
    await a.vor(30_000);
    const toene = a.tab.toene();
    expect(toene.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(toene[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
    expect(a.tab.kontext.sinkId).toBe('dock');
    expect(l.server.lebenszeichen.slice(nachher).every((z) => z.state === 'ready')).toBe(true);
    expect(l.server.lebenszeichen.length).toBeGreaterThan(nachher);
  });

  it('(a) auch wenn das Lesen in die Zeitgrenze läuft (B1) → bleibt bereit', async () => {
    const { l, a } = await dockLaeuft();
    l.medien.leseHaengt = true;
    l.medien.geraeteWechsel();
    await a.vor(3000);
    expect(a.tab.waechter?.gelesen()).toBe(true);
    expect(zustand(a)).toBe('ready');
  });

  it('(b) Gegenbeispiel: gleiche Lage, dann bleibt die Ausgabe stehen → nicht bereit, kein Ton über „Standard“', async () => {
    const { l, a } = await dockLaeuft();
    freigabeWeg(l);
    await a.vor(1000);
    a.tab.kontext.resumeErlaubt = false;
    a.tab.kontext.zustandSetzen('suspended');
    await a.vor(5000); // nach der Gnadenfrist
    expect(zustand(a)).toBe('not_activated');
    await a.vor(30_000);
    expect(a.tab.toene()).toEqual([]);
    expect(a.tab.kontext.sinkId).toBe('dock');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
  });

  it('(c) Gegenbeispiel: gleiche Lage nach dem Neuladen → output_unconfirmed wie bisher (@HT-055), nie still „Standard“', async () => {
    const { l, a } = await dockLaeuft();
    freigabeWeg(l);
    await a.vor(1000);
    a.schliessen();
    const neu = tab(l, 'B');
    await neu.starte();
    await neu.vor(40_000);
    expect(zustand(neu)).toBe('output_unconfirmed');
    expect(neu.tab.toene()).toEqual([]);
    expect(neu.tab.kontext.setSinkIdAufrufe).toEqual([]);
    expect(neu.tab.kontext.sinkId).toBe('');
  });

  it('(d) die Kennungen werden wieder lesbar und das Dock fehlt → output_lost, kein Ton', async () => {
    const { l, a } = await dockLaeuft();
    freigabeWeg(l);
    await a.vor(1000);
    expect(zustand(a)).toBe('ready');
    l.medien.erlaubt = true;
    l.medien.abziehen('dock');
    await a.vor(1500);
    expect(zustand(a)).toBe('output_lost');
    await a.vor(30_000);
    expect(a.tab.toene()).toEqual([]);
  });

  it('nach einem verlorenen Ausgang gilt die Sitzung nicht mehr: Freigabe weg und das Dock wieder da → unbestätigt statt bereit', async () => {
    const { l, a } = await dockLaeuft();
    l.medien.abziehen('dock');
    await a.vor(1500);
    expect(zustand(a)).toBe('output_lost');
    freigabeWeg(l); // Kennungen nicht mehr lesbar: nach dem Verlust nicht „einfach bereit“
    await a.vor(1500);
    expect(zustand(a)).toBe('output_unconfirmed');
  });
});

describe('@HT-054 Zeile 6 Ausgang wechseln, während ein Ton läuft (heutiges Verhalten, hier nur festgehalten)', () => {
  it('der Wechsel wirkt sofort (setSinkId), die App bricht den laufenden Ton nicht selbst ab, die Sperre bleibt, der nächste Ton kommt über den neuen Ausgang', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(27_000 + 1000); // der Abpfiff-Ton (2 s) läuft
    expect(a.tab.toene()).toHaveLength(1);
    const laufend = a.tab.kontext.quellen[0];
    a.tab.wahl.setzen(wahlVon(LG));
    await a.vor(300);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'lg']);
    expect(a.tab.kontext.sinkId).toBe('lg');
    // Heutiger Stand: die App selbst bricht den laufenden Ton nicht ab (nur der harte Stopp nach 5 s steht); dass er mit dem Wechsel
    // des Ausgangs endet, ist Sache des Browsers (`setSinkId` am laufenden Kontext) und nur am echten Gerät prüfbar.
    expect(laufend.stops).toEqual([laufend.starts[0] + 5]);
    await a.vor(2000);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(l.geraet.sperren.gehalten()).toBe(true);
    expect(a.tab.spieler.jetztSpielen('abpfiff')).toBe(true);
    expect(a.tab.kontext.sinkId).toBe('lg');
    expect(a.tab.kontext.quellen).toHaveLength(2);
  });
});
