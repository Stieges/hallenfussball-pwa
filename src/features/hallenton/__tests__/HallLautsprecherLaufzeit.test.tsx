/**
 * H3b-2b Einbau: unsichtbarer Baustein `<HallLautsprecherLaufzeit/>` und `useHallLautsprecher` (Schnittstelle für H4).
 * Gegenbeispiele aus dem Brief: ein normales Gerät ohne Lautsprecher erzeugt keinen Worker, ein Gast startet nichts; der
 * Worker entsteht einmal; Bildschirm wach, solange die Laufzeit tönt. Aktionen: einschalten (@HT-001, @HT-015),
 * Ton aktivieren (@HT-012), ausschalten (@HT-038), Hier anhören und Lautstärke (@HT-023).
 */
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FalscherAudioKontext, tonDaten } from '../../../test/hallenton/falscherAudioKontext';
import { FalscherSupabase } from '../../../test/hallenton/falscherSupabase';
import { FalscherSpeicher } from '../../../test/hallenton/falschesGeraet';
import { erzeugeHallTonSpieler } from '../runtime/hallTonSpieler';
import { __setzeGeraetFuerTests, GERAET_SCHLUESSEL, geraetStand } from '../lautsprecherGeraet';

const sb = vi.hoisted((): { client: unknown } => ({ client: null }));
const wach = vi.hoisted(() => ({ aufrufe: [] as boolean[] }));
const konto = vi.hoisted(() => ({ accountId: 'konto-olli' }));
// stabil wie der Kontext des Providers (`useMemo` je Konto)
const engineKontext = vi.hoisted(() => {
  const je: Record<string, unknown> = {};
  return (accountId: string) => {
    je[accountId] ??= {
      accountId,
      clock: { serverNow: () => Date.now(), sync: () => Promise.resolve(true) },
      engine: { view: () => null, subscribe: () => () => undefined },
    };
    return je[accountId];
  };
});

vi.mock('../../../lib/supabase', () => ({
  get supabase() { return sb.client; },
  isSupabaseConfigured: true,
}));
vi.mock('../../../hooks/useWakeLock', () => ({
  useWakeLock: (an: boolean) => { wach.aufrufe.push(an); return { status: 'idle', request: vi.fn(), release: vi.fn() }; },
}));
const turnier = vi.hoisted((): { wert: unknown } => ({ wert: null }));
const repos = vi.hoisted(() => ({ tournamentRepository: { get: () => Promise.resolve(turnier.wert) } }));
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => repos }));
// Fixrunde 1 (W2): Hallenton liest die Turnierkopie nur lokal; das Doppel zählt die Lesevorgänge
const lokal = vi.hoisted(() => ({ aufrufe: 0 }));
vi.mock('../lokalesTurnier', () => ({ ladeTurnierLokal: () => { lokal.aufrufe += 1; return Promise.resolve(turnier.wert); } }));
vi.mock('../../match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineKontext(konto.accountId),
}));

import { HallLautsprecherLaufzeit } from '../HallLautsprecherLaufzeit';
import { useHallLautsprecher } from '../useHallLautsprecher';

const TID = '22222222-2222-4222-8222-222222222222';
let worker: { erzeugt: number; beendet: number };
let kontext: FalscherAudioKontext;
let geladen: string[];

class FalscherWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  constructor() { worker.erzeugt += 1; }
  postMessage(): void { /* Takt kommt im Test nicht: es geht um das Entstehen */ }
  terminate(): void { worker.beendet += 1; }
}

function einschalten(): void {
  localStorage.setItem(GERAET_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1], name: 'Rechner der Turnierleitung' }));
}

beforeEach(() => {
  worker = { erzeugt: 0, beendet: 0 };
  geladen = [];
  turnier.wert = null;
  wach.aufrufe = [];
  konto.accountId = 'konto-olli';
  // die Testumgebung ersetzt localStorage durch leere Attrappen: hier ein echter Speicher dahinter
  const speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
  const falsch = new FalscherSupabase();
  sb.client = falsch.client;
  kontext = new FalscherAudioKontext();
  __setzeGeraetFuerTests({
    spieler: erzeugeHallTonSpieler({
      erzeugeKontext: () => kontext,
      ladeDaten: (url) => { geladen.push(url); return Promise.resolve(tonDaten(2)); },
      speicher: localStorage,
    }),
  });
  vi.stubGlobal('Worker', FalscherWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  __setzeGeraetFuerTests();
});

describe('<HallLautsprecherLaufzeit/> – nur auf einem Lautsprecher-Gerät entsteht Last', () => {
  it('Gegenbeispiel: ein normales Gerät ohne Lautsprecher erzeugt keinen Worker und hält den Bildschirm nicht wach', () => {
    render(<HallLautsprecherLaufzeit />);
    expect(worker.erzeugt).toBe(0);
    expect(geraetStand().laufzeit).toBeNull();
    expect(wach.aufrufe.every((an) => !an)).toBe(true);
  });

  it('Gegenbeispiel: ein Gast startet nichts, auch wenn das Gerät als Lautsprecher eingeschaltet ist', () => {
    einschalten();
    konto.accountId = 'guest';
    render(<HallLautsprecherLaufzeit />);
    expect(worker.erzeugt).toBe(0);
    expect(geraetStand().laufzeit).toBeNull();
  });

  it('eingeschaltetes Lautsprecher-Gerät: die Laufzeit startet, nach „Ton aktivieren“ entsteht der Worker einmal, der Bildschirm bleibt wach', async () => {
    einschalten();
    const { rerender, unmount } = render(<HallLautsprecherLaufzeit />);
    await act(async () => { await Promise.resolve(); });
    expect(geraetStand().laufzeit?.getSnapshot().rolle).toBe('wartet'); // W3: Sperre erst nach der Aktivierung
    expect(worker.erzeugt).toBe(0);
    await act(async () => { await geraetStand().laufzeit?.tonAktivieren(); });
    rerender(<HallLautsprecherLaufzeit />);
    expect(worker.erzeugt).toBe(1);
    expect(geraetStand().laufzeit?.getSnapshot().rolle).toBe('toent');
    expect(wach.aufrufe[wach.aufrufe.length - 1]).toBe(true);
    unmount();
    expect(worker.beendet).toBe(1);
  });
});

describe('useHallLautsprecher(tid) – Schnittstelle für H4', () => {
  it('@HT-001 einschalten über hall_speaker_assign → das Gerät ist Lautsprecher für Feld 1, die Laufzeit startet', async () => {
    const falsch = sb.client as FalscherSupabase;
    falsch.rpcDaten.hall_speaker_assign = { status: 'assigned', fields: [1], replaced: [] };
    render(<HallLautsprecherLaufzeit />);
    const { result } = renderHook(() => useHallLautsprecher(TID));
    expect(result.current.rolle).toBe('keiner');
    let antwort: Awaited<ReturnType<typeof result.current.einschalten>> | undefined;
    await act(async () => { antwort = await result.current.einschalten([1], 'Rechner der Turnierleitung'); });
    expect(antwort?.ok).toBe(true);
    const aufruf = falsch.rpcLog.find((r) => r.fn === 'hall_speaker_assign');
    expect(aufruf?.args).toMatchObject({ p_tournament_id: TID, p_fields: [1], p_device_name: 'Rechner der Turnierleitung', p_replace: false });
    expect(result.current.rolle).toBe('diesesTurnier');
    expect(result.current.felder).toEqual([1]);
    expect(result.current.laufzeit?.rolle).toBe('wartet');
    expect(result.current.laufzeit?.zustandJeFeld).toEqual({ 'field-1': 'not_activated' });
  });

  it('@HT-025 Tonwahl: Turnier mit Abpfiff „Hupe 2“ (matchCockpitSettings.soundId) → der Lautsprecher lädt horn-2 für den Abpfiff', async () => {
    const falsch = sb.client as FalscherSupabase;
    falsch.rpcDaten.hall_sound_status = {
      serverNow: 0, closed: false, speakers: [], leads: [],
      settings: { halftimeSound: 'horn-3', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [] },
    };
    turnier.wert = { matches: [], matchCockpitSettings: { soundId: 'horn-2' } };
    einschalten();
    render(<HallLautsprecherLaufzeit />);
    const warten = async () => {
      for (let i = 0; i < 5; i += 1) {
        await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
      }
    };
    await warten();
    // k-neu-3: ein nicht aktivierter Tab lädt keine Töne und fragt die Tonwahl nicht ab
    expect(geladen).toEqual([]);
    expect(falsch.rpcLog.some((r) => r.fn === 'hall_sound_status')).toBe(false);
    await act(async () => { await geraetStand().laufzeit?.tonAktivieren(); });
    await warten();
    expect(geladen).toContain('/sounds/horn-2.mp3');
    expect(geladen).toContain('/sounds/horn-3.mp3');
  });

  it('@HT-015 Feld schon belegt → occupied geht an H4 (Rückfrage „Ablösen?“), das Gerät bleibt ohne Lautsprecher; mit abloesen wird p_replace gesetzt', async () => {
    const falsch = sb.client as FalscherSupabase;
    falsch.rpcDaten.hall_speaker_assign = { status: 'occupied', fields: [{ field: 1, deviceName: 'Rechner der Turnierleitung' }] };
    const { result } = renderHook(() => useHallLautsprecher(TID));
    let antwort: Awaited<ReturnType<typeof result.current.einschalten>> | undefined;
    await act(async () => { antwort = await result.current.einschalten([1], 'Ollis Handy'); });
    expect(antwort).toMatchObject({ ok: true, status: 'occupied' });
    expect(result.current.rolle).toBe('keiner');
    await act(async () => { await result.current.einschalten([1], 'Ollis Handy', true); });
    expect(falsch.rpcLog.filter((r) => r.fn === 'hall_speaker_assign').map((r) => (r.args as { p_replace: boolean }).p_replace)).toEqual([false, true]);
  });

  it('@HT-012 tonAktivieren aus der Geste → bereit; @HT-038 ausschalten über hall_speaker_release → Laufzeit aus', async () => {
    const falsch = sb.client as FalscherSupabase;
    falsch.rpcDaten.hall_speaker_release = { status: 'released', fields: [1] };
    einschalten();
    render(<HallLautsprecherLaufzeit />);
    const { result } = renderHook(() => useHallLautsprecher(TID));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await result.current.tonAktivieren(); });
    expect(result.current.laufzeit?.zustandJeFeld).toEqual({ 'field-1': 'ready' });
    await act(async () => { await result.current.ausschalten(); });
    expect(falsch.rpcLog.find((r) => r.fn === 'hall_speaker_release')?.args).toMatchObject({ p_tournament_id: TID, p_fields: [1] });
    expect(result.current.rolle).toBe('keiner');
    expect(geraetStand().laufzeit).toBeNull();
    expect(worker.beendet).toBe(1);
  });

  it('ein Gerät, das Lautsprecher eines anderen Turniers ist, meldet „anderesTurnier“ ohne Felder', () => {
    einschalten();
    const { result } = renderHook(() => useHallLautsprecher('anderes-turnier'));
    expect(result.current.rolle).toBe('anderesTurnier');
    expect(result.current.felder).toEqual([]);
  });

  it('@HT-023 hierAnhoeren spielt den Ton nur auf diesem Gerät; Lautstärke und Stumm bleiben auf dem Gerät', async () => {
    const { result } = renderHook(() => useHallLautsprecher(TID));
    act(() => { result.current.setzeLautstaerke('halbzeit', 50); });
    expect(result.current.lautstaerke).toEqual({ abpfiff: 100, halbzeit: 50, tor: 100 }); // @HT-023: Regler Torhymne seit 07.11.
    let gespielt = false;
    await act(async () => { gespielt = await result.current.hierAnhoeren('halbzeit'); });
    expect(gespielt).toBe(true);
    expect(kontext.quellen).toHaveLength(1);
    expect(kontext.gains[0].gain.value).toBe(0.5);
    expect(worker.erzeugt).toBe(0);
    act(() => { result.current.setzeStumm(true); });
    expect(result.current.stumm).toBe(true);
    expect(JSON.parse(localStorage.getItem('hallenton:lautstaerke') ?? '{}')).toEqual({ abpfiff: 100, halbzeit: 50, tor: 100 });
  });

  it('@HT-023/@HT-024 Regler der Torhymne auf 40 %; hierAnhoeren(„tor“, 1) spielt „Hymne B“ des Turniers einmal mit 40 %, höchstens 10 s', async () => {
    const falsch = sb.client as FalscherSupabase;
    // eigenes Turnier („Hallencup Süd“): die zuletzt gelesene Tonwahl merkt sich das Modul je Turnier
    const sued = '33333333-3333-4333-8333-333333333333';
    const hymnen = [`${sued}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.mp3`, `${sued}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.wav`];
    falsch.rpcDaten.hall_sound_status = {
      serverNow: 0, closed: false, speakers: [], leads: [],
      settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [1], goalAnthemPaths: hymnen },
    };
    const { result } = renderHook(() => useHallLautsprecher(sued));
    act(() => { result.current.setzeLautstaerke('tor', 40); });
    expect(result.current.lautstaerke).toEqual({ abpfiff: 100, halbzeit: 100, tor: 40 });
    let gespielt = false;
    await act(async () => { gespielt = await result.current.hierAnhoeren('tor', 1); });
    expect(gespielt).toBe(true);
    expect(geladen).toContain(`https://halle.test/hallenton-sounds/${hymnen[1]}`);
    const quelle = kontext.quellen.at(-1);
    expect(quelle?.starts).toHaveLength(1);
    expect(quelle?.stops.at(-1)).toBe((quelle?.starts[0] ?? 0) + 10);
    expect(kontext.gains.at(-1)?.gain.value).toBe(0.4);
    expect(worker.erzeugt).toBe(0);
    expect(JSON.parse(localStorage.getItem('hallenton:lautstaerke') ?? '{}')).toEqual({ abpfiff: 100, halbzeit: 100, tor: 40 });
  });

  it('@HT-023 auf dem Lautsprecher-Gerät vor „Ton aktivieren“: „Anhören“ spielt den Ton einmal, ohne den Tab zu aktivieren (W2-neu-1)', async () => {
    einschalten();
    render(<HallLautsprecherLaufzeit />);
    const { result } = renderHook(() => useHallLautsprecher(TID));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.laufzeit?.rolle).toBe('wartet');
    let gespielt = false;
    await act(async () => { gespielt = await result.current.hierAnhoeren('abpfiff'); });
    expect(gespielt).toBe(true);
    expect(kontext.quellen).toHaveLength(1);
    expect(result.current.laufzeit?.rolle).toBe('wartet');
    expect(result.current.laufzeit?.zustandJeFeld).toEqual({ 'field-1': 'not_activated' });
    expect(worker.erzeugt).toBe(0);
  });
});
