/**
 * H4-11b Nachzug 🟡A aus dem Review von H4-11 – zwei Tabs eines Geräts (@HT-053 „Standard folgt dem System“, @HT-055 „Ausgang bestätigen“): Der Fehler eines gescheiterten Wechsels auf „Standard“
 * lebt nur im Wächter des TÖNENDEN Tabs (A). Tippt jemand in einem ANDEREN Tab (B) „Ausgang bestätigen“ oder wählt dort „Standard“, muss A es erfahren: `removeItem` auf einen nicht vorhandenen
 * Schlüssel löst kein `storage`-Ereignis aus, darum stößt B A ausdrücklich an. Zwei Tabs auf einem gemeinsamen Gerät (gemeinsamer Speicher, `storage`-Ereignis nur an den jeweils anderen Tab),
 * Tab A mit echter Laufzeit, echtem Spieler und Wächter; Tab B mit dem echten Hook `useHallAusgang`. Dazu: ein Gerät OHNE gespeicherte Wahl verhält sich weiter wie auf main
 * (kein Lesen der Ausgänge, kein Mikrofon-Dialog, kein `setSinkId`) – auch nach dem Tipp.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUSGAENGE, FalscheMedienGeraete, type FalscherAusgang } from '../../../test/hallenton/falscheMedienGeraete';
import { FalschesGeraet } from '../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../test/hallenton/manuelleUhr';
import { T0 } from '../../../core/hallenton/__tests__/hallentonFixtures';
import { __setzeGeraetFuerTests } from '../lautsprecherGeraet';
import { erzeugeAusgangListe } from '../runtime/ausgang/ausgangListe';
import { erzeugeAusgangWaechter } from '../runtime/ausgang/ausgangWaechter';
import { AUSGANG_SCHLUESSEL, erzeugeAusgangWahl } from '../runtime/ausgang/ausgangWahl';
import { __setzeAusgangFuerTests } from '../runtime/ausgang/browserAusgang';
import type { HallTonSpieler } from '../runtime/hallTonSpieler';
import { Tab } from '../runtime/__tests__/laufzeitTestlage';
import { useHallAusgang } from '../useHallAusgang';

const DOCK: FalscherAusgang = AUSGAENGE.find((a) => a.id === 'dock')!;
const mitSetSinkId = class { setSinkId(): Promise<void> { return Promise.resolve(); } };

interface Zwei { uhr: ManuelleUhr; medien: FalscheMedienGeraete; a: Tab; aktivierungen: { n: number } }

/** Tab A tönt (echte Laufzeit); Tab B ist der Tab, in dem Olli tippt (echter Hook, eigener Wächter, eigene Wahl auf demselben Speicher). */
async function zweiTabs(o: { gespeichert?: FalscherAusgang } = {}): Promise<Zwei> {
  const uhr = new ManuelleUhr(T0);
  const medien = new FalscheMedienGeraete();
  medien.erlaubt = true;
  medien.dauerhaft = true;
  const geraet = new FalschesGeraet();
  if (o.gespeichert) {
    geraet.speicher.setItem(AUSGANG_SCHLUESSEL, JSON.stringify({ id: o.gespeichert.id, name: o.gespeichert.name, gruppe: o.gespeichert.gruppe }));
  }
  const a = new Tab({ start: T0, uhr, geraet, name: 'A', medien });
  a.kontext.vorhandeneAusgaenge = new Set(medien.ausgaenge.map((x) => x.id));
  const seiteB = geraet.neueSeite();
  const liste = erzeugeAusgangListe({ geraete: medien, berechtigungen: medien });
  const wahl = erzeugeAusgangWahl({ speicher: seiteB.speicher, seite: seiteB.seite });
  __setzeAusgangFuerTests({ liste, wahl, waechter: erzeugeAusgangWaechter({ liste, wahl, zeitgeber: uhr.gruppe('ausgangB') }) });
  const aktivierungen = { n: 0 };
  __setzeGeraetFuerTests({ spieler: { aktivieren: () => { aktivierungen.n += 1; return Promise.resolve(true); } } as unknown as HallTonSpieler });
  await a.starte();
  await a.vor(3000);
  return { uhr, medien, a, aktivierungen };
}

beforeEach(() => { vi.stubGlobal('AudioContext', mitSetSinkId); });
afterEach(() => {
  vi.unstubAllGlobals();
  __setzeAusgangFuerTests(null);
  __setzeGeraetFuerTests();
});

/** Wechsel von Dock auf „Standard“ hängt in A (Zeitgrenze) → A meldet „unbestätigt“; die Wahl hat Olli in Tab B getroffen. */
async function hängenderWechselAufStandard(z: Zwei, b: { waehle: (id: string | null) => boolean }): Promise<void> {
  z.a.kontext.setSinkIdHaengt = true;
  act(() => { b.waehle(null); }); // Olli wählt „Standard“ in Tab B; Tab A bekommt das `storage`-Ereignis
  await act(async () => { await z.a.vor(2600); });
  expect(z.a.laufzeit.getSnapshot().geraeteZustand).toBe('output_unconfirmed');
  z.a.kontext.setSinkIdHaengt = false; // der Browser kann wieder
}

describe('🟡A Tipp in einem ANDEREN Tab erreicht den tönenden Tab (@HT-055, @HT-053)', () => {
  it('„Ausgang bestätigen“ in Tab B (ohne Wahl) → Tab A versucht den Wechsel auf „Standard“ erneut und ist wieder bereit', async () => {
    const z = await zweiTabs({ gespeichert: DOCK });
    const { result } = renderHook(() => useHallAusgang());
    expect(z.a.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
    await hängenderWechselAufStandard(z, result.current);
    await act(async () => { await result.current.bestaetigen(); await z.a.vor(1500); });
    expect(z.a.kontext.sinkId).toBe('');
    expect(z.a.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
    expect(z.a.laufzeit.getSnapshot().rolle).toBe('toent');
  });

  it('„Standard“ wählen in Tab B („Oder ‚Standard‘ wählen“, die Wahl ist schon „Standard“) → Tab A versucht es erneut und ist wieder bereit', async () => {
    const z = await zweiTabs({ gespeichert: DOCK });
    const { result } = renderHook(() => useHallAusgang());
    await hängenderWechselAufStandard(z, result.current);
    await act(async () => { result.current.waehle(null); await z.a.vor(1500); });
    expect(z.a.kontext.sinkId).toBe('');
    expect(z.a.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
  });

  it('Gegenbeispiel: ohne Tipp in Tab B bleibt Tab A unbestätigt (der Test prüft wirklich den Tipp)', async () => {
    const z = await zweiTabs({ gespeichert: DOCK });
    const { result } = renderHook(() => useHallAusgang());
    await hängenderWechselAufStandard(z, result.current);
    await act(async () => { await z.a.vor(5000); });
    expect(z.a.laufzeit.getSnapshot().geraeteZustand).toBe('output_unconfirmed');
  });
});

describe('Gerät ohne gespeicherte Ausgangswahl verhält sich wie auf main (kein Lesen, kein Mikrofon-Dialog, kein setSinkId)', () => {
  const zaehler = (z: Zwei) => ({ lesen: z.medien.leseAufrufe, mikrofon: z.medien.mikrofonAnfragen, erlaubnis: z.medien.erlaubnisAbfragen, sinkId: z.a.kontext.setSinkIdAufrufe });
  const NICHTS = { lesen: 0, mikrofon: 0, erlaubnis: 0, sinkId: [] as string[] };

  it('zwei Tabs, keine Wahl: Hook einbinden und Zeit vergehen lassen → 0 Aufrufe von enumerateDevices, permissions.query, Mikrofon und setSinkId', async () => {
    const z = await zweiTabs();
    renderHook(() => useHallAusgang());
    await act(async () => { await z.a.vor(40_000); });
    expect(zaehler(z)).toEqual(NICHTS);
    expect(z.a.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
  });

  it('der Tipp „Standard wählen“ und „Ausgang bestätigen“ in Tab B stößt Tab A an, ohne dass irgendetwas gelesen, das Mikrofon gefragt oder setSinkId gerufen wird', async () => {
    const z = await zweiTabs();
    const { result } = renderHook(() => useHallAusgang());
    await act(async () => { result.current.waehle(null); await z.a.vor(2000); });
    await act(async () => { await result.current.bestaetigen(); await z.a.vor(2000); });
    expect(zaehler(z)).toEqual(NICHTS);
    expect(z.aktivierungen.n).toBe(1); // „Ausgang bestätigen“ ist die Geste für „Ton aktivieren“, mehr nicht
    expect(z.a.laufzeit.getSnapshot().geraeteZustand).toBe('ready');
  });
});
