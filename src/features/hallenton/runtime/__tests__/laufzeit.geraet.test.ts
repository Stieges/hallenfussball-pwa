/**
 * H3b-2b Tonlaufzeit am Gerät: Sperre je Gerät (@HT-033 Zeile 8), Takt-Aussetzer und Verdecken (@HT-014, @HT-029), schlafen
 * gelegt (@HT-037), Lautstärke (@HT-023), Verfügbarkeit (Gast, Turnierende), Worker gescheitert, Lautsprecher-Felder über die
 * Tabs und das Reload-Tor für alle Tabs. Gefälschter Feldstand, echter Takt, Spieler, Sperre und Kanal.
 */
import { describe, expect, it } from 'vitest';
import { ABSCHNITT_MS, ENDE_A1, ENDE_A2, T0, anpfiff, ev, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalschesGeraet, FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';
import { ManuelleUhr } from '../../../../test/hallenton/manuelleUhr';
import { bereiteLautsprecherFeldIds, leseLautsprecherFelder } from '../lautsprecherKanal';
import { verbindeLautsprecherReloadTor } from '../lautsprecherReloadTor';
import { Tab, feldAus } from './laufzeitTestlage';

function imSpiel(tab: Tab, log = zweiterAbschnitt()): void {
  const feld = feldAus([{ ab: T0, log }]);
  tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
}

describe('@HT-033 Zeile 8 – Laptop, zwei Tabs: nur ein Tab tönt (Web Lock)', () => {
  it('@HT-033 Zeile 8: der zweite Tab tönt nicht, zeigt „anderer Tab“ und erzeugt weder Worker noch Abfrage; schließt der erste, übernimmt er', async () => {
    const geraet = new FalschesGeraet();
    const uhr = new ManuelleUhr(ENDE_A1 - 10_000);
    const erster = new Tab({ start: 0, geraet, uhr, name: 'A' });
    const zweiter = new Tab({ start: 0, geraet, uhr, name: 'B' });
    const a1 = anpfiff();
    imSpiel(erster, a1);
    imSpiel(zweiter, [...zweiterAbschnitt()]);
    await erster.starte();
    await zweiter.starte();
    expect(erster.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(zweiter.laufzeit.getSnapshot().rolle).toBe('andererTab');
    await erster.vor(15_000);
    expect(erster.toene().map((t) => t.art)).toEqual(['halbzeit']);
    expect(zweiter.toene()).toEqual([]);
    expect(zweiter.takt.erzeugt()).toBe(0);
    expect(zweiter.feldStandErzeugt).toBe(0);
    expect(zweiter.ffs.aufrufe).toBe(0);
    erster.laufzeit.stop(); // Tab geschlossen: der Browser gibt die Sperre frei
    await zweiter.vor(10);
    expect(zweiter.laufzeit.getSnapshot().rolle).toBe('toent');
    expect(zweiter.takt.erzeugt()).toBe(1);
    await zweiter.vor(ENDE_A2 + 3000 - uhr.jetzt());
    expect(zweiter.toene().map((t) => t.art)).toEqual(['abpfiff']);
  });
});

describe('@HT-014 Ein vom Browser angehaltener Lautsprecher wird gemeldet, bloßes Minimieren nicht', () => {
  it('@HT-014 Olli minimiert die App oder legt ein Fenster darüber (der Takt läuft weiter) → weiter bereit', async () => {
    const tab = new Tab({ start: T0 });
    imSpiel(tab, anpfiff());
    await tab.starte();
    await tab.vor(60_000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld).toEqual({ 'field-1': 'ready' });
    expect(tab.laufzeit.getSnapshot().warAngehalten).toBe(false);
  });

  it('@HT-014 der Browser hält die App an, ihr Takt setzt länger als 3 s aus → „Hintergrund“; wieder vorn → bereit mit Hinweis bis zur Bestätigung', async () => {
    const tab = new Tab({ start: T0 });
    imSpiel(tab, anpfiff());
    await tab.starte();
    tab.takt.workerAussetzen();
    await tab.vor(2500);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('ready');
    await tab.vor(2000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('background');
    tab.takt.workerWeiter();
    await tab.vor(300);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('ready');
    expect(tab.laufzeit.getSnapshot().warAngehalten).toBe(true);
    tab.laufzeit.angehaltenBestaetigen();
    expect(tab.laufzeit.getSnapshot().warAngehalten).toBe(false);
  });
});

describe('@HT-029 Der Lautsprecher gibt den Abpfiff-Ton auch minimiert oder verdeckt', () => {
  it('@HT-029 minimiert (Worker-Takt läuft) → genau einmal, höchstens 1 s neben dem Cockpit; 30 s angehalten → 30 s später', async () => {
    const log = zweiterAbschnitt();
    const pause = ev('PAUSE', ENDE_A2 - 60_000, 2, 2 * ABSCHNITT_MS - 60_000);
    const weiter = ev('RESUME', ENDE_A2 - 30_000, 2, null);
    const tab = new Tab({ start: ENDE_A2 - 120_000 });
    const feld = feldAus([{ ab: T0, log }, { ab: ENDE_A2 - 60_000, log: [...log, pause] }, { ab: ENDE_A2 - 30_000, log: [...log, pause, weiter] }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    await tab.vor(160_000);
    expect(tab.toene().map((t) => t.art)).toEqual(['abpfiff']);
    expect(Math.abs(tab.toene()[0].at - (ENDE_A2 + 30_000))).toBeLessThanOrEqual(1000);
  });
});

describe('@HT-037 Hat der Browser den Lautsprecher schlafen gelegt, sagt die App das nach dem Neuladen', () => {
  it('@HT-037 neu geladen und vom Browser verworfen → „schlafen gelegt“, bis Olli „Ton aktivieren“ klickt', async () => {
    const tab = new Tab({ start: T0, wurdeVerworfen: true });
    imSpiel(tab, anpfiff());
    await tab.starte({ aktivieren: false });
    await tab.vor(500);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('slept');
    await tab.laufzeit.tonAktivieren();
    await tab.vor(300);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('ready');
  });

  it('@HT-037 lädt Olli die App selbst neu, erscheint der Hinweis nicht (nur „Ton nicht aktiviert“)', async () => {
    const tab = new Tab({ start: T0, wurdeVerworfen: false });
    imSpiel(tab, anpfiff());
    await tab.starte({ aktivieren: false });
    await tab.vor(500);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('not_activated');
  });
});

describe('@HT-023 Die Lautstärke ist je Lautsprecher-Gerät einstellbar', () => {
  it('@HT-023 Abpfiff 80 %, Halbzeit 50 % → die Töne erklingen so; die Einstellung bleibt nach dem Neuladen auf diesem Gerät', async () => {
    const speicher = new FalscherSpeicher();
    const tab = new Tab({ start: ENDE_A1 - 5000, speicher });
    const a1 = anpfiff();
    const zweiter = [...a1, ev('SECTION_END', ENDE_A1, 1, ABSCHNITT_MS), ev('SECTION_START', ENDE_A1 + 60_000, 2, null)];
    const feld = feldAus([{ ab: T0, log: a1 }, { ab: ENDE_A1 + 60_000, log: zweiter }]);
    tab.ffs.staendeZu = (jetzt) => [feld(jetzt)];
    await tab.starte();
    tab.spieler.setzeLautstaerke('abpfiff', 80);
    tab.spieler.setzeLautstaerke('halbzeit', 50);
    await tab.vor(ENDE_A2 + 5000 - tab.uhr.jetzt());
    expect(tab.toene().map((t) => [t.art, t.gain])).toEqual([['halbzeit', 0.5], ['abpfiff', 0.8]]);
    const neuGeladen = new Tab({ start: T0, speicher });
    expect([neuGeladen.spieler.lautstaerke('abpfiff'), neuGeladen.spieler.lautstaerke('halbzeit')]).toEqual([80, 50]);
  });

  it('@HT-023 Abpfiff-Ton auf 0 % → „Lautstärke 0 %“ (volume_zero), kein Ton', async () => {
    const tab = new Tab({ start: ENDE_A2 - 5000 });
    imSpiel(tab);
    await tab.starte();
    tab.spieler.setzeLautstaerke('abpfiff', 0);
    await tab.vor(10_000);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('volume_zero');
    expect(tab.toene()).toEqual([]);
  });
});

describe('Verfügbarkeit und Worker', () => {
  it('nach dem Turnierende (turnierBeendet) schaltet sich die Laufzeit still ab: kein Takt, kein Ton, keine Meldung an die Tabs', async () => {
    const tab = new Tab({ start: ENDE_A2 - 5000 });
    imSpiel(tab);
    await tab.starte();
    await tab.vor(1000);
    expect(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt())).not.toBeNull();
    tab.ffs.verf = 'turnierBeendet';
    await tab.vor(10_000);
    expect(tab.laufzeit.getSnapshot().rolle).toBe('still');
    expect(tab.takt.quelle.zustand()).toBe('aus');
    expect(tab.toene()).toEqual([]);
    expect(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt())).toBeNull();
  });

  it('ohne echtes Konto (nichtVerfuegbar) tönt nichts und die Laufzeit schaltet sich still ab', async () => {
    const tab = new Tab({ start: ENDE_A2 - 5000 });
    imSpiel(tab);
    tab.ffs.verf = 'nichtVerfuegbar';
    await tab.starte();
    await tab.vor(10_000);
    expect(tab.laufzeit.getSnapshot().rolle).toBe('still');
    expect(tab.toene()).toEqual([]);
  });

  it('scheitert der Worker, meldet die Laufzeit das als Zustand (taktFehler, „Hintergrund“)', async () => {
    const tab = new Tab({ start: T0, erzeugenScheitert: true });
    imSpiel(tab, anpfiff());
    await tab.starte();
    expect(tab.laufzeit.getSnapshot().taktFehler).toBe(true);
    expect(tab.laufzeit.getSnapshot().zustandJeFeld['field-1']).toBe('background');
  });
});

describe('Lautsprecher-Felder über die Tabs und Reload-Tor', () => {
  it('der tönende Tab meldet seine Felder mit „bereit“; nicht aktiviert → nicht bereit; nach dem Ausschalten keine Meldung', async () => {
    const tab = new Tab({ start: T0, felder: [1, 2] });
    imSpiel(tab, anpfiff());
    await tab.starte({ aktivieren: false });
    await tab.vor(300);
    expect(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt())?.felder).toEqual([{ feld: 1, bereit: false }, { feld: 2, bereit: false }]);
    await tab.laufzeit.tonAktivieren();
    await tab.vor(300);
    const meldung = leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt());
    expect(bereiteLautsprecherFeldIds(meldung, 'hallencup-nord')).toEqual(['field-1', 'field-2']);
    expect(bereiteLautsprecherFeldIds(meldung, 'anderes-turnier')).toEqual([]);
    tab.laufzeit.stop();
    expect(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt())).toBeNull();
  });

  it('eine Meldung ohne Erneuerung veraltet nach 15 s (Tab abgestürzt), eine laufende wird alle 5 s erneuert', async () => {
    const tab = new Tab({ start: T0 });
    imSpiel(tab, anpfiff());
    await tab.starte();
    await tab.vor(40_000);
    expect(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt())).not.toBeNull();
    tab.takt.workerAussetzen(); // auch der Hauptthread meldet nichts mehr
    expect(leseLautsprecherFelder(tab.geraet.speicher, tab.uhr.jetzt() + 16_000)).toBeNull();
  });

  it('Reload-Tor: solange der Lautsprecher bereit ist, hält auch ein anderer Tab desselben Geräts das Tor zu', async () => {
    const geraet = new FalschesGeraet();
    const uhr = new ManuelleUhr(T0);
    const lautsprecher = new Tab({ start: 0, geraet, uhr, name: 'A' });
    const andererTab = new Tab({ start: 0, geraet, uhr, name: 'B' });
    imSpiel(lautsprecher, anpfiff());
    const tore: Array<{ allowsReload: () => boolean; offen: boolean }> = [];
    const loesen = verbindeLautsprecherReloadTor({
      kanal: andererTab.kanal,
      zeitgeber: uhr.gruppe('hauptB'),
      halteTor: (gate) => {
        const eintrag = { allowsReload: gate.allowsReload, offen: true };
        tore.push(eintrag);
        return () => { eintrag.offen = false; };
      },
    });
    expect(tore).toHaveLength(0);
    await lautsprecher.starte({ aktivieren: false });
    expect(tore).toHaveLength(0); // nicht bereit: Tor bleibt frei
    await lautsprecher.laufzeit.tonAktivieren();
    await lautsprecher.vor(300);
    expect(tore.filter((t) => t.offen)).toHaveLength(1);
    expect(tore[0].allowsReload()).toBe(false);
    lautsprecher.spieler.setzeLautstaerke('abpfiff', 0);
    await lautsprecher.vor(300);
    expect(tore.filter((t) => t.offen)).toHaveLength(0);
    loesen();
  });
});

