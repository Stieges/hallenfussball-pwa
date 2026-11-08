/**
 * H3b-3 Lebenszeichen des Hallen-Lautsprechers: genau ein Tab je Gerät meldet, auch ohne aktivierten Tab (@HT-012, @HT-013),
 * der tönende Tab übernimmt (@HT-033 Zeile 8), Hintergrund (@HT-014), Abschalten bei `superseded`/`unassigned` (Regel 1) und
 * Turnierende. Echte Laufzeit, Sperren, Kanal; Server-Doppel nach der Migration.
 */
import { describe, expect, it } from 'vitest';
import { ENDE_A2, T0, anpfiff, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherHallServer } from '../../../../test/hallenton/falscherHallServer';
import { FalschesGeraet } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { feldAus, type Tab } from './laufzeitTestlage';
import { LzTab, lebenszeichenVon } from './lebenszeichenTestlage';

function imSpiel(tab: Tab, log = zweiterAbschnitt(), felder = ['field-1']): void {
  const je = felder.map((feldId) => feldAus([{ ab: T0, log }], undefined, feldId));
  tab.ffs.staendeZu = (jetzt) => je.map((f) => f(jetzt));
}

function lage(start = T0, felder = [1]) {
  const uhr = new ManuelleUhr(start);
  const geraet = new FalschesGeraet();
  const server = new FalscherHallServer(() => uhr.jetzt(), (fn, ms) => { uhr.gruppe('netz').spaeter(fn, ms); });
  for (const feld of felder) {
    server.zuordnen(feld, 'laptop');
  }
  const tab = (name: string, o: { felder?: number[] } = {}) => new LzTab({ start, uhr, geraet, server, name, felder: o.felder ?? felder });
  return { uhr, geraet, server, tab };
}

describe('@HT-012 @HT-013 Ohne aktivierten Tab meldet genau ein Tab „Ton nicht aktiviert“', () => {
  it('@HT-012 Schalter umgelegt, „Ton aktivieren“ nicht geklickt → Lebenszeichen „not_activated“ sofort und alle 5 s', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    await a.starte({ aktivieren: false });
    await a.vor(20_500);
    const zeiten = server.lebenszeichen.map((l) => l.at - T0);
    expect(server.lebenszeichen.every((l) => l.state === 'not_activated' && l.von === 'tabA')).toBe(true);
    expect(zeiten).toEqual([0, 5000, 10_000, 15_000, 20_000]);
    expect(server.lautsprecher.get(1)?.state).toBe('not_activated');
  });

  it('Gegenbeispiel: ein zweiter Tab meldet nicht doppelt (beide nicht aktiviert)', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    const b = tab('B');
    await a.starte({ aktivieren: false });
    await b.starte({ aktivieren: false });
    await a.vor(30_000);
    expect(lebenszeichenVon(server, 'tabA')).toBe(7);
    expect(lebenszeichenVon(server, 'tabB')).toBe(0);
  });

  it('@HT-013 die App wird neu geladen (der tönende Tab ist weg, der neue nicht aktiviert) → nach höchstens 1 s „not_activated“', async () => {
    const { server, tab } = lage();
    const alt = tab('A');
    imSpiel(alt.tab, anpfiff());
    await alt.starte();
    await alt.vor(6000);
    expect(server.lautsprecher.get(1)?.state).toBe('ready');
    alt.schliessen();
    const vorher = server.lebenszeichen.length;
    const neu = tab('B');
    await neu.starte({ aktivieren: false });
    await neu.vor(1000);
    const nachher = server.lebenszeichen.slice(vorher);
    expect(nachher.map((l) => [l.von, l.state])).toEqual([['tabB', 'not_activated']]);
  });
});

describe('@HT-033 Zeile 8 – zwei Tabs: das Lebenszeichen kommt vom tönenden Tab, nie von beiden', () => {
  it('A wartet und meldet; B wird aktiviert und tönt → B übernimmt das Melden, A meldet danach nichts mehr', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    const b = tab('B');
    imSpiel(b.tab, anpfiff());
    await a.starte({ aktivieren: false });
    await b.starte({ aktivieren: false });
    await a.vor(7000);
    expect(lebenszeichenVon(server, 'tabA')).toBe(2);
    await b.tab.laufzeit.tonAktivieren();
    await b.vor(30_000);
    expect(b.tab.laufzeit.getSnapshot().rolle).toBe('toent');
    const ersterVonB = server.lebenszeichen.findIndex((l) => l.von === 'tabB');
    expect(ersterVonB).toBeGreaterThan(0);
    expect(server.lebenszeichen.slice(ersterVonB).every((l) => l.von === 'tabB' && l.state === 'ready')).toBe(true);
    expect(server.lebenszeichen.slice(ersterVonB).length).toBeGreaterThanOrEqual(6);
    expect(server.lautsprecher.get(1)?.state).toBe('ready');
  });

  it('der tönende Tab schließt → der wartende meldet wieder „not_activated“ (kein Tab bereit)', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    const b = tab('B');
    imSpiel(a.tab, anpfiff());
    await a.starte();
    await b.starte({ aktivieren: false });
    await a.vor(12_000);
    expect(lebenszeichenVon(server, 'tabB')).toBe(0);
    a.schliessen();
    const vorher = server.lebenszeichen.length;
    await b.vor(3000); // die fremde Meldung ist weg (pagehide/Stop), B fordert die Melde-Sperre an
    const nachher = server.lebenszeichen.slice(vorher);
    expect(nachher.length).toBeGreaterThan(0);
    expect(nachher.every((l) => l.von === 'tabB' && l.state === 'not_activated')).toBe(true);
  });
});

describe('@HT-014 Ein vom Browser angehaltener Lautsprecher wird gemeldet (Datenseite)', () => {
  it('@HT-014 der Takt setzt länger als 3 s aus → das Lebenszeichen „background“ kommt aus dem Hauptthread, bevor 15 s um sind', async () => {
    const { server, tab, uhr } = lage();
    const a = tab('A');
    imSpiel(a.tab, anpfiff());
    await a.starte();
    await a.vor(5100);
    const aus = uhr.jetzt();
    a.tab.takt.workerAussetzen();
    await a.vor(15_000);
    const bg = server.lebenszeichen.find((l) => l.state === 'background');
    expect(bg).toBeDefined();
    expect((bg?.at ?? Number.POSITIVE_INFINITY) - aus).toBeLessThanOrEqual(15_000);
    expect(server.lautsprecher.get(1)?.state).toBe('background');
    a.tab.takt.workerWeiter();
    await a.vor(2000);
    expect(server.lautsprecher.get(1)?.state).toBe('ready');
  });

  it('@HT-014 bloßes Minimieren (Takt läuft) → weiter „ready“ alle 5 s aus dem Worker-Takt', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    imSpiel(a.tab, anpfiff());
    await a.starte();
    a.tab.uhr.stummschalten('lzA'); // Hauptthread gedrosselt (minimiert), der Worker läuft
    await a.vor(30_000);
    expect(server.lebenszeichen.filter((l) => l.at > T0 + 1000).every((l) => l.state === 'ready')).toBe(true);
    expect(server.lebenszeichen.filter((l) => l.at > T0 + 1000).length).toBeGreaterThanOrEqual(5);
  });
});

describe('Regel 1 – abgelöst oder abgemeldet: lokal abschalten, kein Ton danach', () => {
  it('superseded → Lautsprecher aus, das nahe Ende tönt nicht mehr', async () => {
    const { server, tab, uhr } = lage(ENDE_A2 - 12_000);
    const a = tab('A');
    imSpiel(a.tab);
    await a.starte();
    await a.vor(4000);
    server.zuordnen(1, 'monitor-halle'); // ein anderes Gerät löst ab (@HT-015)
    await a.vor(ENDE_A2 + 3000 - uhr.jetzt());
    expect(a.abgeloest).toEqual([[]]);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('aus');
    expect(a.tab.toene()).toEqual([]);
  });

  it('unassigned für Feld 2 von zwei → nur Feld 1 bleibt eingeschaltet', async () => {
    const { server, tab } = lage(T0, [1, 2]);
    const a = tab('A', { felder: [1, 2] });
    await a.starte();
    await a.vor(1000);
    server.lautsprecher.delete(2); // Schalter für Feld 2 auf einem anderen Gerät aus (@HT-038)
    await a.vor(6000);
    expect(a.abgeloest).toEqual([[1]]);
  });

  it('W1 Turnierende: das Lebenszeichen bleibt am Server „ok“, die lokale Turnierkopie ist abgeschlossen → der wartende Tab wird nach höchstens 30 s still', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    await a.starte({ aktivieren: false });
    await a.vor(7000);
    expect(server.lebenszeichen.length).toBe(2);
    a.turnierBeendet = true; // „Hallencup Nord“ abgeschlossen; der Server antwortet weiter ok (kein hall_require_open)
    await a.vor(30_000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
    const vorher = server.lebenszeichen.length;
    await a.vor(30_000);
    expect(server.lebenszeichen.length).toBe(vorher);
    expect(a.endePruefungen).toBeLessThanOrEqual(3); // höchstens alle 30 s, nur lokal
  });

  it('W1 nach dem Turnierende neu geladen → der wartende Tab meldet gar nicht erst', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    a.turnierBeendet = true;
    await a.starte({ aktivieren: false });
    await a.vor(20_000);
    expect(server.lebenszeichen).toEqual([]);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
  });

  it('N1 (H3b-3): die Prüfung auf Turnierende kehrt nie zurück → das Lebenszeichen kommt trotzdem nach höchstens 3 s', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    a.endePruefungHaengt = true;
    await a.starte({ aktivieren: false });
    await a.vor(1900);
    expect(server.lebenszeichen).toEqual([]); // die Frist von 2 s läuft noch
    await a.vor(1100);
    expect(lebenszeichenVon(server, 'tabA')).toBeGreaterThanOrEqual(1);
    expect(server.lebenszeichen[0]?.state).toBe('not_activated');
  });

  it('W1 Schutz: antwortet der Server doch einmal 55000, schaltet der Lautsprecher ebenfalls still ab', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    await a.starte();
    await a.vor(1000);
    server.fehler = 'turnier_beendet';
    await a.vor(6000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
  });

  it('K2 kein Recht mehr (Co-Admin entfernt): dreimal in Folge → still wie ein Gast, keine weiteren Lebenszeichen', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    await a.starte({ aktivieren: false });
    await a.vor(1000);
    server.fehler = 'kein_recht';
    await a.vor(9000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('wartet'); // zweimal: noch nicht
    await a.vor(6000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
    const vorher = server.aufrufe.length;
    await a.vor(20_000);
    expect(server.aufrufe.length).toBe(vorher);
  });

  it('K2 ungültig (Feldzahl verkleinert) → der Grund ist sichtbar, ein späterer Erfolg setzt ihn zurück', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    await a.starte({ aktivieren: false });
    server.fehler = 'ungueltig';
    await a.vor(6000);
    expect(a.fehler.at(-1)).toBe('ungueltig');
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('wartet');
    server.fehler = null;
    await a.vor(6000);
    expect(a.fehler.at(-1)).toBeNull();
  });

  it('Gegenbeispiel: still (Gast/Turnierende über den Feldstand) → kein Lebenszeichen', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    imSpiel(a.tab, anpfiff());
    a.tab.ffs.verf = 'nichtVerfuegbar';
    await a.starte();
    await a.vor(1000);
    const vorher = server.lebenszeichen.length;
    await a.vor(20_000);
    expect(a.tab.laufzeit.getSnapshot().rolle).toBe('still');
    expect(server.lebenszeichen.length).toBe(vorher);
  });
});

describe('k-neu-2 Tonwahl neu lesen', () => {
  it('nach jedem Lebenszeichen des tönenden Tabs, nicht im wartenden', async () => {
    const { server, tab } = lage();
    const a = tab('A');
    const b = tab('B');
    await a.starte();
    await b.starte({ aktivieren: false });
    await a.vor(20_500);
    const toenend = server.lebenszeichen.filter((l) => l.von === 'tabA' && l.state === 'ready').length;
    expect(toenend).toBeGreaterThanOrEqual(4);
    expect(a.nachLebenszeichen).toBe(toenend);
    expect(b.nachLebenszeichen).toBe(0);
  });
});
