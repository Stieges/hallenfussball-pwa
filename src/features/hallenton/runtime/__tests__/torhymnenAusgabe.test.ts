/**
 * H3c Torhymnen im Spieler (`hymnen`, `torhymnenAusgabe.ts`) gegen den gefälschten AudioContext: Vorab laden über die
 * öffentliche Adresse (nur https), nicht ladbar → nicht spielbar ohne Rückfall und ohne `custom_sound_failed` (@HT-024,
 * gilt nach Vorschlag), harte Grenze 10 s, eigener Regler `tor` (@HT-023), Begrenzer, Stopp von außen, und jeder andere Ton
 * beendet die Hymne genau zu seinem Beginn (Regel 4: ein Ende geht vor).
 */
import { describe, expect, it } from 'vitest';
import { FalscherAudioKontext, tonDaten } from '../../../../test/hallenton/falscherAudioKontext';
import { erzeugeHallTonSpieler, type Speicher } from '../hallTonSpieler';

const BASIS = 'https://amtlqicosscsjnnthvzm.supabase.co/storage/v1/object/public/hallenton-sounds/t/';
const A = `${BASIS}hymne-a.mp3`;
const B = `${BASIS}hymne-b.wav`;
const LANG = `${BASIS}hymne-lang.mp3`;
const KAPUTT = `${BASIS}hymne-kaputt.mp3`;
const DATEN: Record<string, ArrayBuffer> = {
  '/sounds/horn-1.mp3': tonDaten(2), '/sounds/horn-2.mp3': tonDaten(3), [A]: tonDaten(8), [B]: tonDaten(7), [LANG]: tonDaten(14), [KAPUTT]: tonDaten(255),
};

function speicher(): Speicher {
  const daten: Record<string, string> = {};
  return { getItem: (k) => daten[k] ?? null, setItem: (k, v) => { daten[k] = v; } };
}

async function bereit(s: Speicher | null = speicher()) {
  const kontext = new FalscherAudioKontext();
  const geholt: string[] = [];
  const spieler = erzeugeHallTonSpieler({
    erzeugeKontext: () => kontext,
    ladeDaten: (url) => {
      geholt.push(url);
      const d = DATEN[url];
      return d ? Promise.resolve(d) : Promise.reject(new TypeError('Failed to fetch'));
    },
    speicher: s,
  });
  await spieler.laden({ abpfiff: 'horn-2', halbzeit: 'horn-1' });
  await spieler.aktivieren();
  return { kontext, spieler, geholt };
}

/** Letzte Stoppzeit der Quelle (Web Audio: der letzte Aufruf gilt). */
const letzterStop = (q: { stops: Array<number | undefined> }): number | undefined => q.stops.at(-1);

describe('Torhymnen im Spieler', () => {
  it('lädt die Hymnen vorab über die öffentliche Adresse; eine nicht ladbare ist nicht spielbar, ohne Rückfall und ohne custom_sound_failed', async () => {
    const { spieler, geholt } = await bereit();
    expect(await spieler.hymnen.laden([A, KAPUTT, B])).toEqual([true, false, true]);
    expect(spieler.hymnen.liste()).toEqual([A, KAPUTT, B]);
    expect(spieler.hymnen.spielbar()).toEqual([true, false, true]);
    expect(geholt).toEqual(expect.arrayContaining([A, KAPUTT, B]));
    expect(spieler.hymnen.spielen(1)).toBe(false);
    expect(spieler.zustand()).toBe('ready');
  });

  it('Gegenbeispiel: Adressen ohne https (blob:, data:, http:) werden gar nicht geholt', async () => {
    const { spieler, geholt } = await bereit();
    expect(await spieler.hymnen.laden(['blob:https://app/1', 'data:audio/mpeg;base64,AA', 'http://halle.test/a.mp3'])).toEqual([false, false, false]);
    expect(geholt.filter((u) => !u.startsWith('/sounds/'))).toEqual([]);
  });

  it('spielt sofort über den Regler „tor“ und den Begrenzer; eine kürzere Datei endet mit ihrem Ende (8 s)', async () => {
    const { spieler, kontext } = await bereit();
    spieler.setzeLautstaerke('tor', 40);
    await spieler.hymnen.laden([A]);
    kontext.currentTime = 100;
    expect(spieler.hymnen.spielen(0)).toBe(true);
    const q = kontext.quellen.at(-1);
    expect(q?.starts).toEqual([100]);
    expect(letzterStop(q ?? { stops: [] })).toBe(110); // harte Grenze gesetzt
    expect(kontext.gains.at(-1)?.gain.value).toBe(0.4);
    expect(kontext.gains.at(-1)?.ziele).toEqual([expect.objectContaining({ threshold: { value: -3 } })]);
    kontext.currentTime = 107.9;
    expect(spieler.hymnen.laeuft()).toBe(true);
    kontext.currentTime = 108;
    expect(spieler.hymnen.laeuft()).toBe(false);
  });

  it('Datei länger als 10 s (14 s) → harter Stopp nach 10 s', async () => {
    const { spieler, kontext } = await bereit();
    await spieler.hymnen.laden([LANG]);
    kontext.currentTime = 50;
    spieler.hymnen.spielen(0);
    expect(letzterStop(kontext.quellen.at(-1) ?? { stops: [] })).toBe(60);
    kontext.currentTime = 59.99;
    expect(spieler.hymnen.laeuft()).toBe(true);
    kontext.currentTime = 60;
    expect(spieler.hymnen.laeuft()).toBe(false);
  });

  it('ein End-Ton wird während der Hymne geplant → die Hymne endet genau zu seinem Beginn; wird er abgebrochen, gilt wieder die harte Grenze', async () => {
    const { spieler, kontext } = await bereit();
    await spieler.hymnen.laden([A]);
    kontext.currentTime = 10;
    spieler.hymnen.spielen(0);
    const hymne = kontext.quellen.at(-1);
    expect(spieler.planen('ende', 'abpfiff', 13.5)).toBe(true);
    expect(letzterStop(hymne ?? { stops: [] })).toBe(13.5);
    spieler.abbrechen('ende'); // das Ende verschiebt sich (Pause)
    expect(letzterStop(hymne ?? { stops: [] })).toBe(20);
  });

  it('ein End-Ton war schon vor der Hymne geplant → die Hymne endet zu seinem Beginn', async () => {
    const { spieler, kontext } = await bereit();
    await spieler.hymnen.laden([A]);
    kontext.currentTime = 10;
    spieler.planen('ende', 'halbzeit', 12);
    spieler.hymnen.spielen(0);
    expect(letzterStop(kontext.quellen.at(-1) ?? { stops: [] })).toBe(12);
  });

  it('während ein End-Ton klingt, startet keine Hymne (ein Ende geht vor)', async () => {
    const { spieler, kontext } = await bereit();
    await spieler.hymnen.laden([A]);
    kontext.currentTime = 10;
    spieler.planen('ende', 'abpfiff', 10);
    kontext.currentTime = 11;
    expect(spieler.hymnen.spielen(0)).toBe(false);
    kontext.currentTime = 13; // Hupe 2 (3 s) ist vorbei
    expect(spieler.hymnen.spielen(0)).toBe(true);
  });

  it('Stopp von außen → sofort; ein später geplanter Ton setzt keine neue Stoppzeit', async () => {
    const { spieler, kontext } = await bereit();
    await spieler.hymnen.laden([A]);
    kontext.currentTime = 10;
    spieler.hymnen.spielen(0);
    const hymne = kontext.quellen.at(-1);
    kontext.currentTime = 12.25;
    spieler.hymnen.stoppen();
    expect(letzterStop(hymne ?? { stops: [] })).toBe(12.25);
    expect(spieler.hymnen.laeuft()).toBe(false);
    spieler.planen('ende', 'abpfiff', 15);
    expect(letzterStop(hymne ?? { stops: [] })).toBe(12.25);
  });

  it('Fixrunde 1: wirft stop() der Hymne (Browser), bleibt der Weg des End-Tons heil: der Abpfiff wird trotzdem geplant', async () => {
    const { spieler, kontext } = await bereit();
    await spieler.hymnen.laden([A]);
    const original = kontext.createBufferSource.bind(kontext);
    let werfen = false;
    kontext.createBufferSource = () => {
      const quelle = original();
      const stop = quelle.stop;
      quelle.stop = (wann?: number) => {
        if (werfen && quelle.buffer?.duration === 8) { // nur die Quelle der Hymne
          throw new Error('InvalidStateError');
        }
        stop(wann);
      };
      return quelle;
    };
    kontext.currentTime = 10;
    expect(spieler.hymnen.spielen(0)).toBe(true);
    werfen = true;
    expect(() => spieler.planen('ende', 'abpfiff', 12)).not.toThrow();
    expect(spieler.geplant()).toContain('ende');
    werfen = true;
    expect(() => spieler.hymnen.stoppen()).not.toThrow();
  });

  it('eine neue Hymne („Anhören“) ersetzt die laufende', async () => {
    const { spieler, kontext } = await bereit();
    await spieler.hymnen.laden([A, B]);
    kontext.currentTime = 10;
    spieler.hymnen.spielen(0);
    const erste = kontext.quellen.at(-1);
    kontext.currentTime = 11;
    spieler.hymnen.spielen(1);
    expect(letzterStop(erste ?? { stops: [] })).toBe(11);
    expect(spieler.hymnen.laeuft()).toBe(true);
  });

  it('Gegenbeispiele: nicht aktiviert, stumm oder Regler „tor“ auf 0 % → keine Hymne', async () => {
    const kontext = new FalscherAudioKontext();
    const spieler = erzeugeHallTonSpieler({ erzeugeKontext: () => kontext, ladeDaten: (url) => Promise.resolve(DATEN[url] ?? tonDaten(255)), speicher: null });
    await spieler.hymnen.laden([A]);
    expect(spieler.hymnen.spielen(0)).toBe(false); // nicht aktiviert
    await spieler.laden({ abpfiff: 'horn-2', halbzeit: 'horn-1' });
    await spieler.aktivieren();
    spieler.setzeStumm(true);
    expect(spieler.hymnen.spielen(0)).toBe(false);
    spieler.setzeStumm(false);
    spieler.setzeLautstaerke('tor', 0);
    expect(spieler.hymnen.spielen(0)).toBe(false);
    expect(spieler.zustand()).toBe('ready'); // „volume_zero“ hängt nur am Abpfiff-Ton
    spieler.setzeLautstaerke('tor', 10);
    expect(spieler.hymnen.spielen(0)).toBe(true);
  });

  it('@HT-023 Regler „tor“ bleibt nach dem Neuladen; ein älterer Eintrag ohne „tor“ gilt mit 100 %', async () => {
    const s = speicher();
    const { spieler } = await bereit(s);
    spieler.setzeLautstaerke('tor', 40);
    const neu = erzeugeHallTonSpieler({ erzeugeKontext: () => new FalscherAudioKontext(), ladeDaten: () => Promise.reject(new Error('egal')), speicher: s });
    expect(neu.lautstaerke('tor')).toBe(40);
    const alt = speicher();
    alt.setItem('hallenton:lautstaerke', JSON.stringify({ abpfiff: 80, halbzeit: 50 }));
    const ausAlt = erzeugeHallTonSpieler({ erzeugeKontext: () => new FalscherAudioKontext(), ladeDaten: () => Promise.reject(new Error('egal')), speicher: alt });
    expect([ausAlt.lautstaerke('abpfiff'), ausAlt.lautstaerke('halbzeit'), ausAlt.lautstaerke('tor')]).toEqual([80, 50, 100]);
  });

  it('eine spätere Ladeliste ersetzt eine frühere, auch wenn die frühere zuletzt fertig wird', async () => {
    const kontext = new FalscherAudioKontext();
    const offen: Array<() => void> = [];
    const spieler = erzeugeHallTonSpieler({
      erzeugeKontext: () => kontext,
      ladeDaten: (url) => (url === A ? new Promise((r) => { offen.push(() => r(DATEN[A])); }) : Promise.resolve(DATEN[url] ?? tonDaten(255))),
      speicher: null,
    });
    const erste = spieler.hymnen.laden([A]);
    await spieler.hymnen.laden([B]);
    offen.forEach((fn) => fn());
    await erste;
    expect(spieler.hymnen.liste()).toEqual([B]);
  });
});
