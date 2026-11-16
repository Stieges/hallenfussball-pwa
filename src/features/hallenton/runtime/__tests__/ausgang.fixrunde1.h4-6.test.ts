/**
 * H4-6 Fixrunde 1: „im Zweifel kein Ton, aber nie dauerhaft tot“ (Zeitgrenzen, Kette), Durchgang durch „Ton nicht aktiviert“ beim
 * Verlust und bei der Rückkehr, beide Reihenfolgen von `devicechange` und `suspended`, Geräte ohne Wahl (@HT-053, @HT-054, @HT-055).
 * Uhr von Hand (`ManuelleUhr`), keine festen Wartezeiten.
 */
import { describe, expect, it } from 'vitest';
import { ABSCHNITT_MS, ENDE_A2, T0, ev, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { AUSGAENGE, FalscheMedienGeraete, type FalscherAusgang } from '../../../../test/hallenton/falscheMedienGeraete';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { AUSGANG_PRUEFEN_SCHLUESSEL, AUSGANG_SCHLUESSEL } from '../ausgang/ausgangWahl';
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

describe('B1 Zeitgrenzen: nie dauerhaft tot', () => {
  it('enumerateDevices antwortet nie → nach der Zeitgrenze ist das Gerät bedienbar: „Ausgang bestätigen“ wirkt danach', async () => {
    const l = lage({ gespeichert: DOCK });
    l.medien.leseHaengt = true;
    const a = tab(l);
    await a.starte();
    expect(a.tab.waechter?.gelesen()).toBe(false);
    const lesen = a.tab.waechter!.neuLesen();
    let gelesen = false;
    void lesen.then(() => { gelesen = true; });
    await a.vor(2500);
    expect(gelesen).toBe(true); // die Runde endet an der Zeitgrenze, wer auf sie wartet, hängt nicht
    expect(a.tab.waechter?.gelesen()).toBe(true); // die Zeitgrenze zählt als Abschluss
    expect(zustand(a)).toBe('output_unconfirmed'); // im Zweifel kein Ton
    l.medien.leseHaengt = false;
    a.tab.wahl.pruefenAnstossen(); // „Ausgang bestätigen“
    await a.vor(1500);
    expect(zustand(a)).toBe('ready');
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
  });

  it('der Kontext steht und die Liste hängt → nach der Gnadenfrist „Ton nicht aktiviert“ statt dauerhaft „unbestätigt“; danach läuft alles wieder', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(2000);
    expect(zustand(a)).toBe('ready');
    l.medien.leseHaengt = true;
    a.tab.kontext.zustandSetzen('suspended'); // z. B. vom Browser angehalten
    expect(zustand(a)).toBe('output_unconfirmed'); // Gnadenfrist
    await a.vor(4000);
    expect(zustand(a)).toBe('not_activated');
    l.medien.leseHaengt = false;
    await a.tab.laufzeit.tonAktivieren();
    await a.vor(1500);
    expect(zustand(a)).toBe('ready');
  });

  it('setSinkId antwortet nie → aktivieren() kehrt nach der Zeitgrenze zurück, Zustand output_unconfirmed (nie still „Standard“); eine spätere Wahl funktioniert', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    a.tab.kontext.setSinkIdHaengt = true;
    await a.starte({ aktivieren: false });
    let fertig = false;
    const aktivierung = a.tab.laufzeit.tonAktivieren().then(() => { fertig = true; });
    await a.vor(500);
    expect(fertig).toBe(false);
    expect(zustand(a)).toBe('output_unconfirmed'); // solange `setSinkId` aussteht: nie „Ton nicht aktiviert“
    await a.vor(2500);
    await aktivierung;
    expect(fertig).toBe(true);
    expect(zustand(a)).toBe('output_unconfirmed');
    expect(a.tab.kontext.sinkId).toBe('');
    expect(a.tab.toene()).toEqual([]);
    a.tab.kontext.setSinkIdHaengt = false;
    a.tab.wahl.setzen(wahlVon(LG));
    await a.vor(1500);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'lg']);
    expect(zustand(a)).toBe('ready');
  });
});

describe('B2 Die Kette übersteht werfende Zuhörer', () => {
  it('ein Zuhörer wirft einmal → der nächste Wechsel funktioniert, aktivieren() lehnt nicht ab, keine unbehandelte Ablehnung', async () => {
    const unbehandelt: unknown[] = [];
    const merke = (grund: unknown) => { unbehandelt.push(grund); };
    process.on('unhandledRejection', merke);
    try {
      const l = lage({ gespeichert: DOCK });
      const a = tab(l);
      await a.starte();
      let geworfen = false;
      a.tab.spieler.onZustand(() => {
        if (!geworfen) {
          geworfen = true;
          throw new Error('Zuhörer kaputt');
        }
      });
      let wirft = true;
      a.tab.waechter!.beobachten(() => {
        if (wirft) {
          wirft = false;
          throw new Error('Zuhörer des Wächters kaputt');
        }
      });
      a.tab.wahl.setzen(wahlVon(LG));
      await a.vor(1500);
      expect(geworfen).toBe(true);
      expect(wirft).toBe(false);
      a.tab.wahl.setzen(wahlVon(DOCK));
      await a.vor(1500);
      expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'lg', 'dock']);
      await expect(a.tab.spieler.aktivieren()).resolves.toBe(true);
      await new Promise((r) => { setTimeout(r, 0); });
      expect(unbehandelt).toEqual([]);
    } finally {
      process.off('unhandledRejection', merke);
    }
  });
});

describe('B3 Verlust bei laufendem Kontext und Rückkehr', () => {
  async function dockLaeuft() {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    return { l, a };
  }

  it('@HT-054 Verlust (nur devicechange, der Kontext läuft weiter) 2 s vor dem Ende, Rückkehr 1 s davor → der Abpfiff erklingt genau einmal, pünktlich', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(28_000);
    l.medien.abziehen('dock');
    await a.vor(1000);
    expect(zustand(a)).toBe('output_lost');
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    l.medien.anstecken(DOCK);
    await a.vor(8000);
    const toene = a.tab.toene();
    expect(toene.map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(toene[0].at - ENDE_A2)).toBeLessThanOrEqual(1000);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock', 'dock']);
  });

  it('@HT-054 Gegenbeispiel: Rückkehr erst mehr als 5 s nach dem Ende → kein Ton', async () => {
    const { l, a } = await dockLaeuft();
    await a.vor(28_000);
    l.medien.abziehen('dock');
    await a.vor(8000); // 6 s nach dem Ende
    l.medien.anstecken(DOCK);
    await a.vor(6000);
    expect(a.tab.toene()).toEqual([]);
  });

  it.each([
    ['devicechange vor suspended', true],
    ['suspended vor einem späteren devicechange', false],
  ])('@HT-054 Reihenfolge %s → output_lost, die Sperre bleibt, kein Ton aus dem Standard-Ausgang', async (_name, zuerstGeraete) => {
    const { l, a } = await dockLaeuft();
    await a.vor(5000);
    if (zuerstGeraete) {
      l.medien.abziehen('dock');
      a.tab.kontext.ausgangVerschwindet('dock');
    } else {
      a.tab.kontext.ausgangVerschwindet('dock'); // zuerst steht die Ausgabe still, die Liste kennt das Dock noch
      await a.vor(1000);
      expect(zustand(a)).toBe('output_unconfirmed'); // Gnadenfrist: nie „Ton nicht aktiviert“, die Sperre bleibt
      expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
      l.medien.abziehen('dock', false);
      l.medien.geraeteWechsel();
    }
    await a.vor(1500);
    expect(zustand(a)).toBe('output_lost');
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(l.geraet.sperren.gehalten()).toBe(true);
    await a.vor(30_000);
    expect(a.tab.toene()).toEqual([]);
    expect(a.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
    expect(a.tab.kontext.quellen.every((q) => q.starts.length === 0)).toBe(true);
  });

  it('Wahlwechsel aus einem anderen Tab (dieser Tab hatte keine Wahl): während des ersten Lesens wird nichts Geplantes abgebrochen, der Ton erklingt über die neue Wahl', async () => {
    const l = lage();
    const b = tab(l, 'B');
    await b.starte();
    await b.vor(27_000); // das Ende steht bevor, sein Ton ist eingeplant
    expect(b.tab.spieler.geplant().length).toBeGreaterThan(0);
    const a = tab(l, 'A');
    a.tab.wahl.setzen(wahlVon(DOCK)); // storage-Ereignis in B
    expect(b.tab.spieler.geplant().length).toBeGreaterThan(0); // synchron: nichts abgebrochen
    await b.vor(6000);
    expect(b.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(b.tab.kontext.setSinkIdAufrufe).toEqual(['dock']);
  });
});

describe('„🔈? Prüfen“ (@HT-054 Zeilen 2 und 3, @HT-047)', () => {
  it('Rückkehr ohne neue Wahl: bereit, und der Server kennt den Hinweis „Ausgang geändert“', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(7000); // die Anzeichen am Spieler sind angelegt
    l.medien.abziehen('dock');
    await a.vor(7000);
    expect(l.server.lautsprecher.get(1)?.state).toBe('output_lost');
    l.medien.anstecken(DOCK);
    await a.vor(7000);
    expect(l.server.lautsprecher.get(1)?.state).toBe('ready');
    expect(l.server.lautsprecher.get(1)?.hintAt).not.toBeNull();
    expect(l.server.lebenszeichen.some((z) => z.outputChanged)).toBe(true);
  });

  it('neue Wahl nach dem Abziehen: bereit, und der Hinweis steht weiter', async () => {
    const l = lage({ gespeichert: DOCK });
    const a = tab(l);
    await a.starte();
    await a.vor(7000);
    l.medien.abziehen('dock');
    await a.vor(7000);
    a.tab.wahl.setzen(wahlVon(LG));
    await a.vor(7000);
    expect(l.server.lautsprecher.get(1)?.state).toBe('ready');
    expect(l.server.lautsprecher.get(1)?.hintAt).not.toBeNull();
  });
});

describe('Geräte ohne gespeicherte Wahl bleiben unberührt (Rückwärtsverträglichkeit, Fixrunde 1)', () => {
  async function lauf(mitMedien: boolean) {
    const l = lage();
    const a = tab(l, 'A', mitMedien);
    const verlauf: string[] = [];
    a.tab.spieler.onZustand((z) => verlauf.push(z));
    await a.starte();
    await a.vor(3000);
    a.tab.kontext.ausgangWechseltVonAussen(''); // spontanes sinkchange
    await a.vor(1000);
    a.tab.kontext.zustandSetzen('suspended'); // statechange → suspended
    await a.vor(4000);
    await a.tab.laufzeit.tonAktivieren();
    await a.vor(1000);
    l.medien.geraeteWechsel(); // devicechange
    a.geraete.melden();
    l.geraet.speicher.werte.clear(); // localStorage.clear()
    const anderer = l.geraet.neueSeite();
    anderer.speicher.setItem(AUSGANG_PRUEFEN_SCHLUESSEL, '1'); // storage-Ereignisse ohne Wahl: Anstoß „neu prüfen“ ...
    anderer.speicher.setItem('hallenton:anderes', '1'); // ... und ein fremder Schlüssel
    await a.vor(40_000);
    return { l, a, verlauf, heartbeat: l.server.lebenszeichen.map((z) => z.state), toene: a.tab.toene(), nachher: zustand(a) };
  }

  it('spontanes sinkchange, suspended, devicechange, storage-Ereignis/clear → 0 Aufrufe von setSinkId, Mikrofon, enumerateDevices, permissions.query; gleiche Zustände wie ohne Wächter', async () => {
    const neu = await lauf(true);
    const alt = await lauf(false);
    expect(neu.verlauf).toEqual(alt.verlauf);
    expect(neu.heartbeat).toEqual(alt.heartbeat);
    expect(neu.toene).toEqual(alt.toene);
    expect(neu.nachher).toBe(alt.nachher);
    expect(neu.a.tab.kontext.setSinkIdAufrufe).toEqual([]);
    expect(neu.l.medien.mikrofonAnfragen).toBe(0);
    expect(neu.l.medien.leseAufrufe).toBe(0);
    expect(neu.l.medien.erlaubnisAbfragen).toBe(0);
  });
});
