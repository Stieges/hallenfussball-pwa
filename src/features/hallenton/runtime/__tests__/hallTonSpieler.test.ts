/**
 * H3b-1: Web-Audio-Spieler des Hallen-Lautsprechers gegen einen gefälschten AudioContext.
 * @HT-012 ohne „Ton aktivieren“ nicht bereit; @HT-023 Lautstärke je Gerät und je Ton (80 % / 50 %), bleibt nach dem
 * Neuladen; @HT-028 Zeile 4: eigener Ton nicht ladbar → „Hupe 1“ und „eigener Ton nicht geladen“; @HT-039 Lautstärke 0 %.
 * Planbarer Start `start(t)`, harter Stopp nach 5 s, Begrenzer vor dem Ausgang.
 */
import { describe, expect, it, vi } from 'vitest';
import { FalscherAudioKontext, tonDaten } from '../../../../test/hallenton/falscherAudioKontext';
import { erzeugeHallTonSpieler, HART_STOPP_SEK, type Speicher } from '../hallTonSpieler';

function speicher(start: Record<string, string> = {}): Speicher & { daten: Record<string, string> } {
  const daten = { ...start };
  return {
    daten,
    getItem: (k) => daten[k] ?? null,
    setItem: (k, v) => { daten[k] = v; },
  };
}

const HUPEN: Record<string, ArrayBuffer> = {
  '/sounds/horn-1.mp3': tonDaten(2),
  '/sounds/horn-2.mp3': tonDaten(3),
  '/sounds/horn-3.mp3': tonDaten(1),
};
const EIGEN_OK = 'https://amtlqicosscsjnnthvzm.supabase.co/storage/v1/object/public/hallenton-sounds/t/a.mp3';
const EIGEN_LANG = 'https://amtlqicosscsjnnthvzm.supabase.co/storage/v1/object/public/hallenton-sounds/t/lang.mp3';
const EIGEN_KAPUTT = 'https://amtlqicosscsjnnthvzm.supabase.co/storage/v1/object/public/hallenton-sounds/t/kaputt.mp3';

function aufbau(opts: { speicher?: Speicher | null } = {}) {
  const kontext = new FalscherAudioKontext();
  const ladeDaten = vi.fn((url: string): Promise<ArrayBuffer> => {
    const bekannt: Record<string, ArrayBuffer> = { ...HUPEN, [EIGEN_OK]: tonDaten(3), [EIGEN_LANG]: tonDaten(6), [EIGEN_KAPUTT]: tonDaten(255) };
    const daten = bekannt[url];
    return daten ? Promise.resolve(daten) : Promise.reject(new TypeError('Failed to fetch'));
  });
  const spieler = erzeugeHallTonSpieler({ erzeugeKontext: () => kontext, ladeDaten, speicher: opts.speicher === undefined ? speicher() : opts.speicher });
  return { kontext, ladeDaten, spieler };
}

async function bereit(opts: { speicher?: Speicher | null } = {}) {
  const a = aufbau(opts);
  await a.spieler.laden({ abpfiff: 'horn-2', halbzeit: 'horn-1' });
  await a.spieler.aktivieren();
  return a;
}

describe('hallTonSpieler', () => {
  it('@HT-012 ohne „Ton aktivieren“ ist der Spieler nicht bereit und plant keinen Ton', async () => {
    const { spieler, kontext } = aufbau();
    await spieler.laden({ abpfiff: 'horn-1', halbzeit: 'horn-1' });
    expect(spieler.zustand()).toBe('not_activated');
    expect(spieler.planen('ton-1', 'abpfiff', 10)).toBe(false);
    expect(spieler.jetztSpielen('abpfiff')).toBe(false);
    expect(kontext.quellen).toHaveLength(0);
  });

  it('@HT-012 „Ton aktivieren“ ruft resume() und macht den Spieler mit geladenem Abpfiff-Ton bereit', async () => {
    const { spieler, kontext } = aufbau();
    await spieler.laden({ abpfiff: 'horn-1', halbzeit: 'horn-1' });
    const zustaende: string[] = [];
    spieler.onZustand((z) => zustaende.push(z));
    expect(await spieler.aktivieren()).toBe(true);
    expect(kontext.resumeAufrufe).toBe(1);
    expect(spieler.zustand()).toBe('ready');
    expect(zustaende).toEqual(['ready']);
  });

  it('@HT-012 konnte das Gerät den Abpfiff-Ton nicht laden, gilt es als „Ton nicht aktiviert“, und der Klick lädt ihn neu', async () => {
    const kontext = new FalscherAudioKontext();
    let netz = false;
    const ladeDaten = vi.fn((url: string) => (netz && HUPEN[url] ? Promise.resolve(HUPEN[url]) : Promise.reject(new TypeError('Failed to fetch'))));
    const spieler = erzeugeHallTonSpieler({ erzeugeKontext: () => kontext, ladeDaten, speicher: null });
    await spieler.laden({ abpfiff: 'horn-2', halbzeit: 'horn-1' });
    expect(await spieler.aktivieren()).toBe(false);
    expect(spieler.zustand()).toBe('not_activated');
    netz = true;
    expect(await spieler.aktivieren()).toBe(true);
    expect(ladeDaten).toHaveBeenCalledWith('/sounds/horn-2.mp3');
    expect(spieler.zustand()).toBe('ready');
    expect(spieler.planen('a', 'abpfiff', 1)).toBe(true);
  });

  it('@HT-012 ohne geladenen Ton (laden() nie aufgerufen) ist der Spieler auch nach „Ton aktivieren“ nicht bereit', async () => {
    const { spieler, kontext } = aufbau();
    expect(await spieler.aktivieren()).toBe(false);
    expect(kontext.resumeAufrufe).toBe(1);
    expect(spieler.zustand()).toBe('not_activated');
  });

  it('@HT-012 Gegenbeispiel: verweigert der Browser die Freigabe, bleibt „not_activated“', async () => {
    const { spieler, kontext } = aufbau();
    kontext.resumeErlaubt = false;
    expect(await spieler.aktivieren()).toBe(false);
    expect(spieler.zustand()).toBe('not_activated');
  });

  it('lädt die Hupen über ihre Adresse unter /sounds wie PRESET_SOUNDS und dekodiert sie', async () => {
    const { spieler, ladeDaten } = aufbau();
    expect(await spieler.laden({ abpfiff: 'horn-2', halbzeit: 'horn-3' })).toEqual({ abpfiff: 'geladen', halbzeit: 'geladen' });
    expect(ladeDaten).toHaveBeenCalledWith('/sounds/horn-2.mp3');
    expect(ladeDaten).toHaveBeenCalledWith('/sounds/horn-3.mp3');
    expect(ladeDaten).toHaveBeenCalledWith('/sounds/horn-1.mp3');
  });

  it('planen: Quelle → Lautstärke → Begrenzer → Ausgang, Start genau zur geplanten Zeit, harter Stopp nach 5 s', async () => {
    const { spieler, kontext } = await bereit();
    kontext.currentTime = 100;
    expect(spieler.planen('abpfiff-s11', 'abpfiff', 117.25)).toBe(true);
    const [quelle] = kontext.quellen;
    expect(quelle?.buffer).toEqual({ duration: 3 });
    expect(quelle?.starts).toEqual([117.25]);
    expect(HART_STOPP_SEK).toBe(5);
    expect(quelle?.stops).toEqual([122.25]);
    const gain = kontext.gains[0];
    expect(quelle?.ziele).toEqual([expect.objectContaining({ gain: gain?.gain })]);
    const [kompressor] = kontext.kompressoren;
    expect(gain?.ziele).toHaveLength(1);
    expect(kompressor?.ziele).toEqual([kontext.destination]);
    expect(kompressor?.ratio.value).toBeGreaterThan(1);
    expect(spieler.geplant()).toEqual(['abpfiff-s11']);
  });

  it('abbrechen: der geplante Ton wird sofort gestoppt und getrennt (Freigabe fehlt, Uhr angehalten)', async () => {
    const { spieler, kontext } = await bereit();
    kontext.currentTime = 50;
    spieler.planen('abpfiff-s11', 'abpfiff', 53);
    spieler.abbrechen('abpfiff-s11');
    const [quelle] = kontext.quellen;
    expect(quelle?.stops.at(-1)).toBe(50);
    expect(quelle?.getrennt).toBe(true);
    expect(spieler.geplant()).toEqual([]);
    spieler.abbrechen('gibt-es-nicht');
  });

  it('dieselbe Kennung neu planen ersetzt den alten Ton (nie zwei Töne für ein Ende, @HT-032)', async () => {
    const { spieler, kontext } = await bereit();
    spieler.planen('abpfiff-s11', 'abpfiff', 10);
    spieler.planen('abpfiff-s11', 'abpfiff', 40);
    expect(kontext.quellen).toHaveLength(2);
    expect(kontext.quellen[0]?.getrennt).toBe(true);
    expect(spieler.geplant()).toEqual(['abpfiff-s11']);
  });

  it('nach dem Ende des Tons ist die Kennung nicht mehr geplant und die Knoten sind getrennt', async () => {
    const { spieler, kontext } = await bereit();
    spieler.planen('abpfiff-s11', 'abpfiff', 1);
    kontext.endeMelden();
    expect(spieler.geplant()).toEqual([]);
    expect(kontext.quellen[0]?.getrennt).toBe(true);
    expect(kontext.gains[0]?.getrennt).toBe(true);
  });

  it('@HT-023 jetztSpielen („Anhören“, Testton): der Halbzeit-Ton sofort, mit eigener Lautstärke', async () => {
    const { spieler, kontext } = await bereit();
    spieler.setzeLautstaerke('halbzeit', 50);
    kontext.currentTime = 7;
    expect(spieler.jetztSpielen('halbzeit')).toBe(true);
    expect(kontext.quellen[0]?.buffer).toEqual({ duration: 2 });
    expect(kontext.quellen[0]?.starts).toEqual([7]);
    expect(kontext.gains[0]?.gain.value).toBe(0.5);
  });

  it('@HT-023 Abpfiff 80 %, Halbzeit 50 %: Töne in der eingestellten Lautstärke, auf diesem Gerät gespeichert', async () => {
    const lokal = speicher();
    const { spieler, kontext } = await bereit({ speicher: lokal });
    spieler.setzeLautstaerke('abpfiff', 80);
    spieler.setzeLautstaerke('halbzeit', 50);
    spieler.planen('a', 'abpfiff', 1);
    spieler.planen('h', 'halbzeit', 2);
    expect(kontext.gains.map((g) => g.gain.value)).toEqual([0.8, 0.5]);
    expect(JSON.parse(lokal.daten['hallenton:lautstaerke'] ?? '{}')).toEqual({ abpfiff: 80, halbzeit: 50 });
  });

  it('@HT-023 die Einstellung bleibt nach dem Neuladen der App erhalten (neuer Spieler, gleicher Speicher)', async () => {
    const lokal = speicher({ 'hallenton:lautstaerke': JSON.stringify({ abpfiff: 80, halbzeit: 50 }), 'hallenton:stumm': 'false' });
    const { spieler } = aufbau({ speicher: lokal });
    expect(spieler.lautstaerke('abpfiff')).toBe(80);
    expect(spieler.lautstaerke('halbzeit')).toBe(50);
    expect(spieler.stumm()).toBe(false);
  });

  it('@HT-023 Gegenbeispiel: die Lautstärke ist nicht turnierweit – der Schlüssel enthält kein Turnier', async () => {
    const lokal = speicher();
    const { spieler } = aufbau({ speicher: lokal });
    spieler.setzeLautstaerke('abpfiff', 30);
    spieler.setzeStumm(true);
    expect(Object.keys(lokal.daten).sort()).toEqual(['hallenton:lautstaerke', 'hallenton:stumm']);
  });

  it('ohne Speicher (privates Fenster, gesperrt) gelten 100 % und nicht stumm, nichts wirft', async () => {
    const kaputt: Speicher = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    const { spieler } = aufbau({ speicher: kaputt });
    expect(spieler.lautstaerke('abpfiff')).toBe(100);
    expect(spieler.stumm()).toBe(false);
    spieler.setzeLautstaerke('abpfiff', 40);
    expect(spieler.lautstaerke('abpfiff')).toBe(40);
    const ohne = aufbau({ speicher: null });
    expect(ohne.spieler.lautstaerke('halbzeit')).toBe(100);
  });

  it('Gegenbeispiel: unbrauchbare gespeicherte Werte werden ersetzt (außerhalb 0–100, kein JSON)', () => {
    const lokal = speicher({ 'hallenton:lautstaerke': '{"abpfiff":180,"halbzeit":"laut"}' });
    expect(aufbau({ speicher: lokal }).spieler.lautstaerke('abpfiff')).toBe(100);
    const lokal2 = speicher({ 'hallenton:lautstaerke': 'kaputt' });
    expect(aufbau({ speicher: lokal2 }).spieler.lautstaerke('halbzeit')).toBe(100);
  });

  it('@HT-039 Lautstärke des Abpfiff-Tons auf 0 % → volume_zero, kein Ton geplant', async () => {
    const { spieler, kontext } = await bereit();
    spieler.setzeLautstaerke('abpfiff', 0);
    expect(spieler.zustand()).toBe('volume_zero');
    expect(spieler.planen('a', 'abpfiff', 1)).toBe(false);
    expect(kontext.quellen).toHaveLength(0);
  });

  it('@HT-039 Gegenbeispiel: nur der Halbzeit-Ton auf 0 % ist kein volume_zero', async () => {
    const { spieler } = await bereit();
    spieler.setzeLautstaerke('halbzeit', 0);
    expect(spieler.zustand()).toBe('ready');
    expect(spieler.planen('h', 'halbzeit', 1)).toBe(false);
  });

  it('stumm: kein Ton, Zustand volume_zero; wieder laut → ready', async () => {
    const { spieler } = await bereit();
    spieler.setzeStumm(true);
    expect(spieler.zustand()).toBe('volume_zero');
    expect(spieler.jetztSpielen('abpfiff')).toBe(false);
    spieler.setzeStumm(false);
    expect(spieler.zustand()).toBe('ready');
  });

  it('@HT-027 eigener Ton über die öffentliche Storage-Adresse (https): geladen und gespielt', async () => {
    const { spieler, kontext, ladeDaten } = aufbau();
    expect(await spieler.laden({ abpfiff: { eigeneUrl: EIGEN_OK }, halbzeit: 'horn-1' })).toEqual({ abpfiff: 'geladen', halbzeit: 'geladen' });
    await spieler.aktivieren();
    expect(ladeDaten).toHaveBeenCalledWith(EIGEN_OK);
    expect(spieler.zustand()).toBe('ready');
    spieler.planen('a', 'abpfiff', 1);
    expect(kontext.quellen[0]?.buffer).toEqual({ duration: 3 });
  });

  it.each([
    ['nicht ladbar (Netz)', 'https://amtlqicosscsjnnthvzm.supabase.co/storage/v1/object/public/hallenton-sounds/t/fehlt.mp3'],
    ['nicht dekodierbar', EIGEN_KAPUTT],
    ['länger als 5 Sekunden', EIGEN_LANG],
  ])('@HT-028 Zeile 4: eigener Ton %s → spielt „Hupe 1“, Zustand custom_sound_failed', async (_fall, url) => {
    const { spieler, kontext } = aufbau();
    expect(await spieler.laden({ abpfiff: { eigeneUrl: url }, halbzeit: 'horn-2' })).toEqual({ abpfiff: 'rueckfall', halbzeit: 'geladen' });
    await spieler.aktivieren();
    expect(spieler.zustand()).toBe('custom_sound_failed');
    expect(spieler.planen('a', 'abpfiff', 1)).toBe(true);
    expect(kontext.quellen[0]?.buffer).toEqual({ duration: 2 });
  });

  it.each([
    ['blob:', 'blob:https://hallenfussball.app/1234'],
    ['http', 'http://amtlqicosscsjnnthvzm.supabase.co/x.mp3'],
    ['data:', 'data:audio/mpeg;base64,AAAA'],
  ])('@HT-028 Gegenbeispiel: eigener Ton als %s-Adresse wird nicht geladen (CSP), Rückfall auf „Hupe 1“', async (_art, url) => {
    const { spieler, ladeDaten } = aufbau();
    expect(await spieler.laden({ abpfiff: 'horn-1', halbzeit: { eigeneUrl: url } })).toEqual({ abpfiff: 'geladen', halbzeit: 'rueckfall' });
    expect(ladeDaten).not.toHaveBeenCalledWith(url);
    await spieler.aktivieren();
    expect(spieler.zustand()).toBe('custom_sound_failed');
  });

  it('Gegenbeispiel: ein neues Laden mit funktionierendem Ton nimmt custom_sound_failed zurück', async () => {
    const { spieler } = aufbau();
    await spieler.laden({ abpfiff: { eigeneUrl: EIGEN_KAPUTT }, halbzeit: 'horn-1' });
    await spieler.aktivieren();
    expect(spieler.zustand()).toBe('custom_sound_failed');
    await spieler.laden({ abpfiff: 'horn-3', halbzeit: 'horn-1' });
    expect(spieler.zustand()).toBe('ready');
  });

  it('Hupen werden je Spieler nur einmal geladen', async () => {
    const { spieler, ladeDaten } = aufbau();
    await spieler.laden({ abpfiff: 'horn-1', halbzeit: 'horn-1' });
    await spieler.laden({ abpfiff: 'horn-1', halbzeit: 'horn-1' });
    expect(ladeDaten.mock.calls.filter(([url]) => url === '/sounds/horn-1.mp3')).toHaveLength(1);
  });

  it('Gegenbeispiel: Hupe nicht ladbar → laden meldet „fehlt“, planen liefert false', async () => {
    const kontext = new FalscherAudioKontext();
    const spieler = erzeugeHallTonSpieler({ erzeugeKontext: () => kontext, ladeDaten: () => Promise.reject(new TypeError('Failed to fetch')), speicher: null });
    expect(await spieler.laden({ abpfiff: 'horn-1', halbzeit: 'horn-2' })).toEqual({ abpfiff: 'fehlt', halbzeit: 'fehlt' });
    await spieler.aktivieren();
    expect(spieler.zustand()).toBe('not_activated');
    expect(spieler.planen('a', 'abpfiff', 1)).toBe(false);
  });

  it('audioZeitFuerServerZeit: Serverzeit → Audiozeit, abzüglich der gemessenen Ausgabe-Verzögerung', () => {
    const { spieler, kontext } = aufbau();
    kontext.currentTime = 100;
    kontext.outputLatency = 0.144;
    expect(spieler.audioZeitFuerServerZeit(117_000, 100_000)).toBeCloseTo(116.856, 6);
    kontext.outputLatency = undefined;
    expect(spieler.audioZeitFuerServerZeit(117_000, 100_000)).toBeCloseTo(117, 6);
  });

  it('der Browser setzt die Ausgabe aus (suspended) → not_activated, bis sie wieder läuft', async () => {
    const { spieler, kontext } = await bereit();
    kontext.zustandSetzen('suspended');
    expect(spieler.zustand()).toBe('not_activated');
    kontext.zustandSetzen('running');
    expect(spieler.zustand()).toBe('ready');
  });
});
