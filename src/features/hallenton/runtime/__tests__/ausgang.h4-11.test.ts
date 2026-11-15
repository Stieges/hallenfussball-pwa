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

describe('Fixrunde 1 🟡1: der Wechsel auf „Standard“ hängt oder scheitert – ein Tipp ohne Neuladen genügt', () => {
  it('setSinkId(\'\') läuft in die Zeitgrenze → unbestätigt (Wächter und Spieler sagen dasselbe); „Ausgang bestätigen“ (standardErneut) versucht es erneut → bereit über Standard', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(3000);
    a.tab.kontext.setSinkIdHaengt = true;
    a.tab.wahl.setzen(null);
    await a.vor(2600);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(a.tab.waechter?.lage()).toBe('unconfirmed'); // Zeile (Taste), Karte und Cockpit lesen dieselbe Lage
    expect(l.geraet.sperren.gehalten()).toBe(true); // die Sperre bleibt, nie ein Ton über den alten Ausgang
    a.tab.kontext.setSinkIdHaengt = false;
    a.tab.waechter?.standardErneut(); // der eine Tipp
    await a.vor(1500);
    expect(a.tab.kontext.sinkId).toBe('');
    expect(zustand(a)).toBe('ready');
    expect(a.tab.waechter?.lage()).toBe('standard');
  });

  it('kommt die späte Antwort doch noch (sinkchange auf Standard), heilt sie ohne Tipp', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(3000);
    a.tab.kontext.setSinkIdHaengt = true;
    a.tab.wahl.setzen(null);
    await a.vor(2600);
    expect(zustand(a)).toBe('output_unconfirmed');
    a.tab.kontext.spaetAntworten();
    await a.vor(1500);
    expect(zustand(a)).toBe('ready');
  });

  it('steht der Kontext schon auf „Standard“ (die späte Antwort kam ohne sinkchange), genügt der Tipp ohne neuen setSinkId-Aufruf', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(3000);
    a.tab.kontext.setSinkIdHaengt = true;
    a.tab.wahl.setzen(null);
    await a.vor(2600);
    expect(zustand(a)).toBe('output_unconfirmed');
    a.tab.kontext.sinkId = ''; // der Browser hat umgeschaltet, ohne es zu melden
    a.tab.waechter?.standardErneut();
    await a.vor(1500);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', '']); // kein weiterer Aufruf
  });

  it('nach „Ausgang verloren“ „Standard“ wählen (@HT-054 Zeile 3, derselbe Weg wie „Oder ‚Standard‘ wählen“): setSinkId(\'\') hängt → weiter unbestätigt, ein Tipp → bereit', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(3000);
    l.medien.abziehen('dock');
    await a.vor(2000);
    expect(zustand(a)).toBe('output_lost');
    a.tab.kontext.setSinkIdHaengt = true;
    a.tab.wahl.setzen(null);
    await a.vor(2600);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(a.tab.waechter?.lage()).toBe('unconfirmed');
    a.tab.kontext.setSinkIdHaengt = false;
    a.tab.waechter?.standardErneut();
    await a.vor(1500);
    expect(zustand(a)).toBe('ready');
  });

  it('Gegenbeispiel: ein Gerät ohne Wahl ruft weder bei Start noch bei standardErneut setSinkId', async () => {
    const l = lage();
    const a = tab(l);
    await a.starte();
    await a.vor(5000);
    a.tab.waechter?.standardErneut();
    await a.vor(3000);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual([]);
    expect(zustand(a)).toBe('ready');
  });
});

describe('Fixrunde 1 🔵1: nach „Schließen“ liest ein Gerät ohne Wahl nicht mehr bei devicechange mit', () => {
  it('ohne Wahl: lesen, beenden, devicechange → kein weiteres Lesen; mit Wahl bleibt der Wächter wach (er bemerkt das Abziehen)', async () => {
    const ohne = lage();
    const a = tab(ohne);
    await a.starte();
    await a.tab.waechter!.neuLesen();
    const gelesen = ohne.medien.leseAufrufe;
    ohne.medien.geraeteWechsel();
    await a.vor(100);
    expect(ohne.medien.leseAufrufe).toBeGreaterThan(gelesen); // offen: liest mit
    a.tab.waechter!.lesenBeenden();
    const nachBeenden = ohne.medien.leseAufrufe;
    ohne.medien.geraeteWechsel();
    await a.vor(100);
    expect(ohne.medien.leseAufrufe).toBe(nachBeenden);

    const mit = lage({ gespeichert: DOCK });
    const b = tab(mit);
    await b.starte();
    await b.tab.waechter!.neuLesen();
    b.tab.waechter!.lesenBeenden();
    const vorher = mit.medien.leseAufrufe;
    mit.medien.abziehen('dock');
    await b.vor(2500);
    expect(mit.medien.leseAufrufe).toBeGreaterThan(vorher);
    expect(zustand(b)).toBe('output_lost');
  });
});

describe('Fixrunde 1 🟡2 (nur festgehalten, nicht geändert): Zwischenzustand im Lebenszeichen beim Wechsel (@HT-054 Zeile 6)', () => {
  it('Solange `setSinkId` für den Wechsel läuft, sendet das Lebenszeichen „output_unconfirmed“ (so lange wie `setSinkId` dauert, höchstens die Zeitgrenze von 2 s), danach „ready“; die Sperre bleibt, nie „not_activated“', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(10_000);
    const vorher = l.server.lebenszeichen.length;
    a.tab.kontext.setSinkIdHaengt = true;
    const t0 = l.uhr.jetzt();
    a.tab.wahl.setzen(wahlVon(LG));
    const gesehen: Array<{ nach: number; state: string }> = [];
    for (let i = 0; i < 40; i += 1) {
      await a.vor(100, i === 15 ? [{ um: l.uhr.jetzt() + 50, tu: () => a.tab.kontext.spaetAntworten() }] : []);
      for (const z of l.server.lebenszeichen.slice(vorher + gesehen.length)) {
        gesehen.push({ nach: l.uhr.jetzt() - t0, state: z.state });
      }
    }
    expect(gesehen.map((g) => g.state)).toEqual(['output_unconfirmed', 'ready']); // der Zwischenzustand ist sichtbar …
    expect(gesehen[1].nach - gesehen[0].nach).toBeLessThanOrEqual(2000); // … höchstens bis zur Zeitgrenze von `setSinkId`
    expect(l.geraet.sperren.gehalten()).toBe(true);
  });
});
