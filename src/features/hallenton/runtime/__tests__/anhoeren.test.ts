/**
 * H4-1 „Anhören“ als eigene Art (H3c-Befund 4; @HT-023, @HT-017, @HT-024). Regel (Controller): Läuft eine echte Torhymne, wird
 * „Anhören“ nicht gespielt und liefert `'belegt'`; ein laufendes Anhören beendet jede echte Ausgabe (Torhymne, End-Ton, Testton)
 * sofort und es zählt nie als „Hymne läuft“; die Rücknahme eines Tors stoppt kein Anhören. Anhören der Hupen folgt derselben Regel.
 * Teil 1: Spieler auf dem gefälschten AudioContext. Teil 2: echte Laufzeit mit Toren am Server (Gherkin wie @HT-024).
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../../../../core/match';
import { CTX_11, ENDE_A2, T0, ev, zweiterAbschnitt } from '../../../../core/hallenton/__tests__/hallentonFixtures';
import { FalscherAudioKontext, tonDaten } from '../../../../test/hallenton/falscherAudioKontext';
import { erzeugeHallTonSpieler } from '../hallTonSpieler';
import type { TorWahl } from '../torhymnenSteuerung';
import { HYMNE, Tab, feldAus, type Stufe } from './laufzeitTestlage';

const A = 'https://halle.test/hallenton-sounds/hymne-a.mp3';
const B = 'https://halle.test/hallenton-sounds/hymne-b.wav';
const DATEN: Record<string, ArrayBuffer> = { '/sounds/horn-1.mp3': tonDaten(2), '/sounds/horn-2.mp3': tonDaten(3), [A]: tonDaten(8), [B]: tonDaten(7) };
const letzterStop = (q: { stops: Array<number | undefined> } | undefined): number | undefined => q?.stops.at(-1);

async function bereit() {
  const kontext = new FalscherAudioKontext();
  const spieler = erzeugeHallTonSpieler({
    erzeugeKontext: () => kontext,
    ladeDaten: (url) => (DATEN[url] ? Promise.resolve(DATEN[url]) : Promise.reject(new TypeError('Failed to fetch'))),
    speicher: null,
  });
  await spieler.laden({ abpfiff: 'horn-2', halbzeit: 'horn-1' });
  await spieler.aktivieren();
  await spieler.hymnen.laden([A, B]);
  kontext.currentTime = 100;
  return { kontext, spieler };
}

describe('@HT-023 Anhören der Torhymne ist eine eigene Art', () => {
  it('Gegenbeispiel: eine echte Hymne läuft → Anhören liefert „belegt“, spielt nichts, und die echte Hymne läuft ungestört weiter', async () => {
    const { kontext, spieler } = await bereit();
    expect(spieler.hymnen.spielen(0)).toBe(true);
    const echte = kontext.quellen.at(-1);
    const anzahl = kontext.quellen.length;
    kontext.currentTime = 103;
    expect(spieler.hymnen.anhoeren(1)).toBe('belegt');
    expect(kontext.quellen).toHaveLength(anzahl);
    expect(letzterStop(echte)).toBe(110); // nur die harte Grenze, nie verkürzt
    expect(spieler.hymnen.laeuft()).toBe(true);
  });

  it('im Leerlauf spielt Anhören die Hymne über den Regler „tor“ und den Begrenzer; sie zählt nicht als „läuft“', async () => {
    const { kontext, spieler } = await bereit();
    spieler.setzeLautstaerke('tor', 40);
    expect(spieler.hymnen.anhoeren(0)).toBe(true);
    expect(kontext.gains.at(-1)?.gain.value).toBe(0.4);
    expect(kontext.gains.at(-1)?.ziele).toEqual([expect.objectContaining({ threshold: { value: -3 } })]);
    expect(kontext.quellen.at(-1)?.starts).toEqual([100]);
    kontext.currentTime = 102;
    expect(spieler.hymnen.laeuft()).toBe(false); // nie „Hymne läuft“
  });

  it('Anhören läuft, eine echte Hymne beginnt → das Anhören endet sofort, die echte spielt ganz', async () => {
    const { kontext, spieler } = await bereit();
    spieler.hymnen.anhoeren(0);
    const vorschau = kontext.quellen.at(-1);
    kontext.currentTime = 102;
    expect(spieler.hymnen.spielen(1)).toBe(true);
    expect(letzterStop(vorschau)).toBe(102);
    expect(spieler.hymnen.laeuft()).toBe(true);
    const echte = kontext.quellen.at(-1);
    expect(echte).not.toBe(vorschau);
    expect(echte?.starts).toEqual([102]);
    expect(letzterStop(echte)).toBe(112);
  });

  it('Anhören läuft, Rücknahme eines Tors (Stopp von außen) → das Anhören läuft weiter', async () => {
    const { kontext, spieler } = await bereit();
    spieler.hymnen.anhoeren(0);
    const vorschau = kontext.quellen.at(-1);
    kontext.currentTime = 102;
    spieler.hymnen.stoppen();
    expect(letzterStop(vorschau)).toBe(110); // unverändert: nur die harte Grenze
    kontext.currentTime = 107.9;
    spieler.hymnen.stoppen();
    expect(letzterStop(vorschau)).toBe(110);
  });

  it('Anhören läuft, ein End-Ton wird geplant → das Anhören endet genau zu dessen Beginn; ein Testton („jetzt“) beendet es sofort', async () => {
    const { kontext, spieler } = await bereit();
    spieler.hymnen.anhoeren(0);
    const vorschau = kontext.quellen.at(-1);
    spieler.planen('ende', 'abpfiff', 103.5);
    expect(letzterStop(vorschau)).toBe(103.5);
    spieler.abbrechen('ende');
    expect(letzterStop(vorschau)).toBe(110); // wird er abgebrochen, gilt wieder die harte Grenze
    kontext.currentTime = 104;
    spieler.jetztSpielen('abpfiff');
    expect(letzterStop(vorschau)).toBe(104);
  });

  it('Anhören läuft, ein neues Anhören ersetzt es; ein End-Ton klingt → Anhören „belegt“', async () => {
    const { kontext, spieler } = await bereit();
    spieler.hymnen.anhoeren(0);
    const erstes = kontext.quellen.at(-1);
    kontext.currentTime = 101;
    expect(spieler.hymnen.anhoeren(1)).toBe(true);
    expect(letzterStop(erstes)).toBe(101);
    kontext.currentTime = 120;
    spieler.planen('ende', 'abpfiff', 120);
    kontext.currentTime = 121;
    expect(spieler.hymnen.anhoeren(0)).toBe('belegt');
  });
});

describe('@HT-023 Anhören der Hupen folgt derselben Regel', () => {
  it('Gegenbeispiel: eine echte Hymne läuft → „Anhören“ der Hupe liefert „belegt“ und verdrängt die Hymne nicht', async () => {
    const { kontext, spieler } = await bereit();
    spieler.hymnen.spielen(0);
    const hymne = kontext.quellen.at(-1);
    kontext.currentTime = 102;
    expect(spieler.anhoeren('abpfiff')).toBe('belegt');
    expect(letzterStop(hymne)).toBe(110);
    expect(spieler.hymnen.laeuft()).toBe(true);
    expect(spieler.geplant()).toEqual([]);
  });

  it('Gegenbeispiel: ein echter End-Ton oder Testton klingt → „Anhören“ der Hupe liefert „belegt“; danach (Ton vorbei) wird gespielt', async () => {
    const { kontext, spieler } = await bereit();
    expect(spieler.jetztSpielen('abpfiff')).toBe(true); // Testton in der Halle, 3 s
    kontext.currentTime = 101;
    const anzahl = kontext.quellen.length;
    expect(spieler.anhoeren('halbzeit')).toBe('belegt');
    expect(kontext.quellen).toHaveLength(anzahl);
    kontext.currentTime = 103;
    expect(spieler.anhoeren('halbzeit')).toBe(true);
    expect(kontext.quellen.at(-1)?.starts).toEqual([103]);
    expect(spieler.geplant()).toHaveLength(1); // das Anhören ist kein geplanter Ton
  });

  it('Anhören der Hupe läuft, eine echte Hymne beginnt → es endet sofort; ein Testton beendet es ebenso', async () => {
    const { kontext, spieler } = await bereit();
    expect(spieler.anhoeren('abpfiff')).toBe(true);
    const erstes = kontext.quellen.at(-1);
    kontext.currentTime = 101;
    spieler.hymnen.spielen(0);
    expect(letzterStop(erstes)).toBe(101);
    kontext.currentTime = 112;
    expect(spieler.anhoeren('abpfiff')).toBe(true);
    const zweites = kontext.quellen.at(-1);
    kontext.currentTime = 112.5;
    spieler.jetztSpielen('halbzeit');
    expect(letzterStop(zweites)).toBe(112.5);
  });

  it('Anhören der Hupe: stumm oder 0 % → false (kein „belegt“); der Regler wirkt auf ein laufendes Anhören', async () => {
    const { kontext, spieler } = await bereit();
    spieler.anhoeren('abpfiff');
    spieler.setzeLautstaerke('abpfiff', 30);
    expect(kontext.gains.at(-1)?.gain.value).toBe(0.3);
    spieler.setzeLautstaerke('abpfiff', 100);
    spieler.setzeLautstaerke('halbzeit', 0);
    expect(spieler.anhoeren('halbzeit')).toBe(false);
  });
});

const ABC: TorWahl = { felder: [1], hymnen: [HYMNE.a, HYMNE.b] };
const tor = (at: number): EngineEvent => ev('GOAL', at, 2, null, { teamId: CTX_11.teamAId });
const zweiteHalbzeit = zweiterAbschnitt();

describe('@HT-024 @HT-023 Anhören neben echten Toren (echte Laufzeit)', () => {
  it('Anhören läuft, dann fällt ein Tor → das Anhören endet, die echte Hymne spielt ganz (Ton bei Tor wird nie verschluckt)', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const tab = new Tab({ start: t1.at - 8000, torWahl: ABC });
    tab.ffs.staendeZu = (j) => [feldAus([{ ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }])(j)];
    await tab.starte();
    await tab.vor(3000);
    expect(tab.spieler.hymnen.anhoeren(1)).toBe(true); // „Hymne B“ (7 s) zum Anhören
    await tab.vor(12_000);
    const h = tab.hymnen();
    expect(h.map((x) => x.hymne)).toEqual(['b', 'a']); // zuerst das Anhören, dann die echte erste Hymne
    expect(h[0].bis).toBe(h[1].at); // das Anhören endet genau mit dem Beginn der echten Hymne
    expect(h[1].bis - h[1].at).toBe(8000);
  });

  it('Anhören läuft, Tom nimmt ein früheres Tor zurück → das Anhören läuft weiter bis zu seinem Ende', async () => {
    const t1 = tor(ENDE_A2 - 60_000);
    const zurueck = ev('RETRACT', t1.at + 12_000, 2, null, { actor: 'leitung', targetId: t1.id });
    const stufen: Stufe[] = [
      { ab: T0, log: zweiteHalbzeit }, { ab: t1.at, log: [...zweiteHalbzeit, t1] }, { ab: zurueck.at, log: [...zweiteHalbzeit, t1, zurueck] },
    ];
    const tab = new Tab({ start: t1.at - 2000, torWahl: ABC });
    tab.ffs.staendeZu = (j) => [feldAus(stufen)(j)];
    await tab.starte();
    await tab.vor(12_000); // die echte „Hymne A“ (8 s) ist vorbei
    expect(tab.spieler.hymnen.laeuft()).toBe(false);
    expect(tab.spieler.hymnen.anhoeren(1)).toBe(true);
    const beginn = tab.hymnen().at(-1)?.at ?? 0;
    await tab.vor(8000); // die Rücknahme (t1 + 12 s) fällt mitten ins Anhören
    const vorschau = tab.hymnen().at(-1);
    expect(vorschau?.hymne).toBe('b');
    expect(vorschau?.at).toBe(beginn);
    expect(vorschau?.bis).toBe(beginn + 7000); // ganz gespielt
    expect(tab.hymnen()).toHaveLength(2);
  });
});
