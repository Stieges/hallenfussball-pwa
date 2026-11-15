/**
 * H4-11 Nachzüge aus dem Review von H4-6 (@HT-054 Zeile 6, @HT-053, @HT-055): ein Ton genau einmal beim Wechsel des Ausgangs, ein spätes `setSinkId`,
 * der Wechsel auf „Standard“ ohne Durchgang durch „Ton nicht aktiviert“, ein stehender Kontext rund um das Spielende. Erwartungen aus dem Gherkin
 * („jedes Ende genau einmal“, „bleibt bereit“, „Standard folgt dem System“); Uhr von Hand, keine festen Wartezeiten.
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

function tab(l: Lage, name = 'A'): LzTab {
  const t = new LzTab({ start: l.uhr.jetzt(), uhr: l.uhr, geraet: l.geraet, server: l.server, name, medien: l.medien });
  const feld = feldAus([{ ab: T0, log: zweiterAbschnitt() }, { ab: ENDE_A2, log: BEENDET }]);
  t.tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
  t.tab.kontext.vorhandeneAusgaenge = new Set(l.medien.ausgaenge.map((a) => a.id));
  return t;
}

const zustand = (t: LzTab) => t.tab.laufzeit.getSnapshot().geraeteZustand;

describe('N1 Wahlwechsel genau beim Tonbeginn → genau ein Ton (@HT-054 Zeile 6, „jedes Ende genau einmal“)', () => {
  it('der Ausgang wechselt 50 ms vor dem Ende, `setSinkId` antwortet erst nach 400 ms → der Abpfiff erklingt genau einmal, das Gerät bleibt bereit', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(29_950); // 50 ms vor dem Ende: der Ton ist beim Spieler eingeplant
    expect(a.tab.spieler.geplant().length).toBeGreaterThan(0);
    a.tab.kontext.setSinkIdHaengt = true;
    a.tab.wahl.setzen(wahlVon(LG));
    await a.vor(400, [{ um: l.uhr.jetzt() + 350, tu: () => a.tab.kontext.spaetAntworten() }]);
    await a.vor(8000);
    expect(a.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(a.tab.kontext.quellen.filter((q) => q.starts.length > 0)).toHaveLength(1); // nie ein zweiter Ton, auch kein nachgeholter
    expect(zustand(a)).toBe('ready');
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'lg']);
  });

  it('Gegenbeispiel: der Kontext steht, als der Ton fällig ist (nichts erklang) → er wird einmal nachgeholt, innerhalb von 5 s', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(29_000);
    a.tab.kontext.zustandSetzen('suspended'); // der Browser hält den Kontext an, vor dem Ende
    await a.vor(3000); // 2 s nach dem Ende
    expect(a.tab.toene()).toEqual([]);
    a.tab.kontext.zustandSetzen('running');
    await a.vor(6000);
    expect(a.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
  });

  it('Kontext steht 100 ms vor dem Spielende und läuft nach 1 s wieder → genau ein Ton', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(29_900);
    a.tab.kontext.zustandSetzen('suspended');
    await a.vor(1100); // 1 s nach dem Ende
    a.tab.kontext.zustandSetzen('running');
    await a.vor(8000);
    expect(a.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(a.tab.kontext.quellen.filter((q) => q.starts.length > 0 && q.stops.every((s) => s === undefined || s > q.starts[0]))).toHaveLength(1);
  });
});

describe('N2 ein `setSinkId`, das erst nach der Zeitgrenze antwortet (@HT-053 Zeile 3)', () => {
  it('Zeitgrenze überschritten → unbestätigt; kommt die Antwort doch (`sinkchange` auf die gewählte Kennung), ist der Ausgang bestätigt und das Gerät bereit', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    a.tab.kontext.setSinkIdHaengt = true;
    await a.starte({ aktivieren: false });
    const aktivierung = a.tab.laufzeit.tonAktivieren();
    await a.vor(2600);
    await aktivierung;
    expect(zustand(a)).toBe('output_unconfirmed');
    a.tab.kontext.spaetAntworten();
    await a.vor(1500);
    expect(a.tab.kontext.sinkId).toBe('dock');
    expect(zustand(a)).toBe('ready');
  });

  it('Gegenbeispiel: `sinkchange` auf einen anderen Ausgang als gewählt heilt den Fehler nicht', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    a.tab.kontext.setSinkIdHaengt = true;
    await a.starte({ aktivieren: false });
    const aktivierung = a.tab.laufzeit.tonAktivieren();
    await a.vor(2600);
    await aktivierung;
    a.tab.kontext.ausgangWechseltVonAussen('lg'); // der Browser springt von selbst auf einen anderen Ausgang
    await a.vor(1500);
    expect(zustand(a)).not.toBe('ready');
  });
});

describe('N3 Wechsel von einem gewählten Ausgang auf „Standard“ (@HT-053, @HT-054 „Standard folgt dem System“)', () => {
  it('kein Durchgang durch „Ton nicht aktiviert“, die Sperre bleibt, danach bereit über den Standard', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(3000);
    expect(zustand(a)).toBe('ready');
    const verlauf: string[] = [];
    const rollen: string[] = [];
    a.tab.spieler.onZustand((z) => { verlauf.push(z); rollen.push(a.tab.laufzeit.getSnapshot().rolle); });
    a.tab.wahl.setzen(null);
    await a.vor(3000);
    expect(verlauf).not.toContain('not_activated');
    expect(rollen.every((r) => r === 'toent')).toBe(true);
    expect(l.geraet.sperren.gehalten()).toBe(true);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', '']);
  });

  it('Gegenbeispiel: ein Gerät, das nie eine Wahl hatte, ruft `setSinkId` nie auf', async () => {
    const l = lage();
    const a = tab(l);
    await a.starte();
    await a.vor(40_000);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual([]);
  });
});
