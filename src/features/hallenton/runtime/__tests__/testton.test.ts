/**
 * H3b-3 Testton in der Halle mit Quittung (@HT-017), kein Ton von außen (@HT-044) und die drei starken Anzeichen eines
 * Ausgangswechsels im Lebenszeichen (@HT-047). Echte Laufzeit, Spieler, Ausgangs-Signale, Sperren und Kanal; Server-Doppel.
 */
import { describe, expect, it } from 'vitest';
import { T0 } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { LzTab, TID } from './lebenszeichenTestlage';

function lage() {
  const uhr = new ManuelleUhr(T0);
  const geraet = new FalschesGeraet();
  const server = new FalscherHallServer(() => uhr.jetzt(), (fn, ms) => { uhr.gruppe('netz').spaeter(fn, ms); });
  server.zuordnen(1, 'laptop');
  const tab = (name: string) => new LzTab({ start: T0, uhr, geraet, server, name });
  const anfordern = () => server.testtonAnfordern({ p_tournament_id: TID, p_field: 1 });
  return { uhr, geraet, server, tab, anfordern };
}

describe('@HT-017 „Testton in der Halle“ am Lautsprecher mit Quittung', () => {
  it('@HT-017 bereit, „Testton in der Halle“ → am Rechner einmal der Abpfiff-Ton, danach die Quittung „gespielt“ am Server', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    await a.starte();
    await a.vor(2000);
    await anfordern();
    await a.vor(6000);
    expect(a.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(server.quittungen).toHaveLength(1);
    expect(server.lautsprecher.get(1)?.test?.playedAt).not.toBeNull();
    await a.vor(20_000);
    expect(a.tab.toene()).toHaveLength(1);
  });

  it('geht die Quittung verloren, quittiert der Lautsprecher beim nächsten Lebenszeichen – ohne zweiten Ton', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    await a.starte();
    await a.vor(2000);
    a.ackNetz = false;
    await anfordern();
    await a.vor(4000);
    expect(a.tab.toene()).toHaveLength(1);
    expect(server.quittungen).toHaveLength(0);
    a.ackNetz = true;
    await a.vor(5000);
    expect(server.quittungen).toHaveLength(1);
    expect(a.tab.toene()).toHaveLength(1);
  });

  it('K1 ohne Speicher (gesperrtes localStorage) und mit verlorener Quittung → trotzdem kein zweiter Ton', async () => {
    const uhr = new ManuelleUhr(T0);
    const server = new FalscherHallServer(() => uhr.jetzt());
    server.zuordnen(1, 'laptop');
    const a = new LzTab({ start: T0, uhr, geraet: new FalschesGeraet(), server, name: 'A', ohneSpeicher: true });
    await a.starte();
    await a.vor(2000);
    a.ackNetz = false;
    await server.testtonAnfordern({ p_tournament_id: TID, p_field: 1 });
    await a.vor(12_000);
    expect(a.tab.toene()).toHaveLength(1);
  });

  it('@HT-017 nicht bereit – Ton nicht aktiviert → kein Ton und keine Quittung (die Verwaltung sieht kein „gespielt“)', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    await a.starte({ aktivieren: false });
    await anfordern();
    await a.vor(12_000);
    expect(server.lebenszeichen.length).toBeGreaterThanOrEqual(2); // gemeldet hat er (not_activated)
    expect(a.tab.toene()).toEqual([]);
    expect(server.quittungen).toEqual([]);
    expect(server.lautsprecher.get(1)?.test?.playedAt).toBeNull();
  });

  it('Gegenbeispiel: nur „Anhören“ geklickt (Ausgabe frei, Tab nicht aktiviert) → der meldende Tab spielt den Testton nicht', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    await a.starte({ aktivieren: false });
    await a.tab.spieler.aktivieren();
    await a.tab.laufzeit.ladeToeneZumAnhoeren();
    await anfordern();
    await a.vor(12_000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('wartet');
    expect(a.tab.toene()).toEqual([]);
    expect(server.quittungen).toEqual([]);
  });

  it('Gegenbeispiel: ein Testton im nicht tönenden Tab wird nicht gespielt – nur der tönende Tab spielt, einmal', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    const b = tab('B');
    await a.starte({ aktivieren: false }); // A meldet zuerst (wartet)
    await b.starte({ aktivieren: false });
    await a.vor(1000);
    await anfordern();
    await a.vor(4000); // A bekommt den Testton in der Antwort, tönt aber nicht
    expect(a.tab.toene()).toEqual([]);
    await b.tab.laufzeit.tonAktivieren();
    await b.vor(8000);
    expect(a.tab.toene()).toEqual([]);
    expect(b.tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(server.quittungen).toHaveLength(1);
  });

  it('Gegenbeispiel: ein Testton, älter als 10 s, wird nicht gespielt (Antwort kam zu spät)', async () => {
    const { server, tab, uhr, anfordern } = lage();
    const a = tab('A');
    await a.starte();
    await a.vor(1000); // Lebenszeichen um +0 und +1 s; das nächste um +6 s
    await a.vor(5010);
    await anfordern(); // direkt nach einem Lebenszeichen
    const angefordert = uhr.jetzt();
    a.netz = false;
    await a.vor(9000); // das Lebenszeichen nach 5 s scheitert
    a.netz = true;
    server.verzoegerungMs = 2000; // das nach knapp 10 s kommt erst 2 s später an
    await a.vor(5000);
    expect(uhr.jetzt() - angefordert).toBeGreaterThan(10_000);
    expect(server.lebenszeichen.some((l) => l.at - angefordert > 9000 && l.at - angefordert <= 10_000)).toBe(true);
    expect(a.tab.toene()).toEqual([]);
    expect(server.quittungen).toEqual([]);
  });

  it('Gegenprobe: dieselbe Lage ohne Verzögerung (knapp unter 10 s) → gespielt', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    await a.starte();
    await a.vor(6010);
    await anfordern();
    a.netz = false;
    await a.vor(9000);
    a.netz = true;
    await a.vor(5000);
    expect(a.tab.toene()).toHaveLength(1);
    expect(server.quittungen).toHaveLength(1);
  });

  it('Gegenbeispiel: Lautstärke 0 % → nicht gespielt, also keine Quittung', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    await a.starte();
    a.tab.spieler.setzeLautstaerke('abpfiff', 0);
    await a.vor(2000);
    await anfordern();
    await a.vor(6000);
    expect(a.tab.toene()).toEqual([]);
    expect(server.quittungen).toEqual([]);
  });
});

describe('@HT-044 Ein Fremder kann keinen Ton in der Halle auslösen', () => {
  it('@HT-044 eine Nachricht im Kanal „hallenton“ mit Testton-Inhalt → kein Ton', async () => {
    const { geraet, tab } = lage();
    const a = tab('A');
    await a.starte();
    const fremd = geraet.kanal();
    fremd.postMessage({ art: 'testton', testId: 'x', feld: 1 });
    fremd.postMessage({ art: 'felder' });
    await a.vor(12_000);
    expect(a.tab.toene()).toEqual([]);
  });

  it('@HT-044 der Server lehnt ab (kein Recht) → kein Ton; eine einzelne Ablehnung schaltet nicht ab (erst dreimal, K2)', async () => {
    const { server, tab, anfordern } = lage();
    const a = tab('A');
    await a.starte();
    await anfordern();
    server.fehler = 'kein_recht';
    await a.vor(7000);
    expect(a.tab.toene()).toEqual([]);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('toent');
  });
});

describe('@HT-047 Starke Anzeichen eines Ausgangswechsels gehen mit dem Lebenszeichen an den Server', () => {
  async function nachTestton(latenz = 0.02) {
    const l = lage();
    const a = l.tab('A');
    a.tab.kontext.outputLatency = latenz;
    await a.starte();
    await a.vor(2000);
    await l.anfordern();
    await a.vor(6000);
    expect(a.tab.toene()).toHaveLength(1);
    return { ...l, a, ab: l.server.lebenszeichen.length };
  }
  const mitAnzeichen = (server: FalscherHallServer, ab: number) => server.lebenszeichen.slice(ab).filter((l) => l.outputChanged).length;

  it('@HT-047 die Verzögerung springt seit dem Testton um mehr als 50 ms → einmal gemeldet, der Server setzt den Hinweis', async () => {
    const { a, server, ab } = await nachTestton();
    a.tab.kontext.outputLatency = 0.09;
    await a.vor(20_000);
    expect(mitAnzeichen(server, ab)).toBe(1);
    expect(server.lautsprecher.get(1)?.hintAt).not.toBeNull();
    expect(server.lautsprecher.get(1)?.state).toBe('ready'); // „✓ Bereit“ bleibt
  });

  it('@HT-047 der Browser meldet geänderte Geräte → gemeldet', async () => {
    const { a, server, ab } = await nachTestton();
    a.geraete.melden();
    await a.vor(6000);
    expect(mitAnzeichen(server, ab)).toBe(1);
  });

  it('@HT-047 die Ausgabe war ohne Zutun unterbrochen und läuft wieder → gemeldet', async () => {
    const { a, server, ab } = await nachTestton();
    a.tab.kontext.zustandSetzen('suspended');
    await a.vor(2000);
    a.tab.kontext.zustandSetzen('running');
    await a.vor(6000);
    expect(mitAnzeichen(server, ab)).toBe(1);
  });

  it('@HT-047 minimiert und wieder vorn, oder eine Bluetooth-Box ohne Meldung getrennt → kein Anzeichen', async () => {
    const { a, server, ab } = await nachTestton();
    a.tab.uhr.stummschalten('lzA');
    await a.vor(30_000);
    a.tab.uhr.lautschalten('lzA');
    await a.vor(6000);
    expect(mitAnzeichen(server, ab)).toBe(0);
    expect(server.lautsprecher.get(1)?.hintAt).toBeNull();
  });

  it('@HT-047 die App wurde neu geladen und Olli hat „Ton aktivieren“ geklickt → kein Anzeichen', async () => {
    const { a, server, tab } = await nachTestton();
    a.schliessen();
    const neu = tab('B');
    neu.tab.kontext.outputLatency = 0.15; // andere Messung im neuen Kontext
    const ab = server.lebenszeichen.length;
    await neu.starte();
    await neu.vor(12_000);
    expect(mitAnzeichen(server, ab)).toBe(0);
  });

  it('ein Anzeichen geht nicht verloren, wenn das Lebenszeichen am Netz scheitert', async () => {
    const { a, server, ab } = await nachTestton();
    a.netz = false;
    a.geraete.melden();
    await a.vor(6000);
    a.netz = true;
    await a.vor(6000);
    expect(mitAnzeichen(server, ab)).toBe(1);
  });
});
