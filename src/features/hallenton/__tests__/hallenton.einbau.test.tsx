/**
 * H3b-3 Einbau: Lebenszeichen und Leitung im unsichtbaren Baustein `<HallLautsprecherLaufzeit/>`, Ausschalten ohne Netz,
 * „Anhören“ mit der Hupe des Turniers, `useHallStatus` und `useHallCockpitHinweis` (Datenseite für H4). Gegenbeispiel: ein Gast
 * meldet nichts. Supabase-Doppel wie in `HallLautsprecherLaufzeit.test.tsx`.
 */
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FalscherAudioKontext, tonDaten } from '../../../test/hallenton/falscherAudioKontext';
import { FalscherSupabase } from '../../../test/hallenton/falscherSupabase';
import { FalscherSpeicher } from '../../../test/hallenton/falschesGeraet';
import { erzeugeHallTonSpieler } from '../runtime/hallTonSpieler';
import { __setzeGeraetFuerTests, GERAET_SCHLUESSEL, geraetStand } from '../lautsprecherGeraet';
import type { LeitungLebenszeichen, LeitungStand } from '../runtime/leitungLebenszeichen';
import { ManuelleUhr } from '../../../test/hallenton/manuelleUhr';
import { noteFieldControlList, resetOwnFieldsForTests } from '../../../core/fieldControl/ownFields';
import { __setzeHallStatusFuerTests } from '../useHallStatus';
import { einzelnZugleich } from '../runtime/tonWahlWechsel';

const sb = vi.hoisted((): { client: unknown } => ({ client: null }));
const konto = vi.hoisted(() => ({ accountId: 'konto-olli' }));
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
  useWakeLock: () => ({ status: 'idle', request: vi.fn(), release: vi.fn() }),
}));
const turnier = vi.hoisted((): { wert: unknown } => ({ wert: null }));
const repos = vi.hoisted(() => ({ tournamentRepository: { get: vi.fn(() => Promise.resolve(turnier.wert)) } }));
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => repos }));
// Fixrunde 1 (W2): Hallenton liest die Turnierkopie nur lokal; das Doppel zählt die Lesevorgänge
const lokal = vi.hoisted(() => ({ aufrufe: 0 }));
vi.mock('../lokalesTurnier', () => ({ ladeTurnierLokal: () => { lokal.aufrufe += 1; return Promise.resolve(turnier.wert); } }));
vi.mock('../../match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineKontext(konto.accountId),
}));

import { HallLautsprecherLaufzeit } from '../HallLautsprecherLaufzeit';
import { ABMELDEN_SCHLUESSEL } from '../ausstehendeAbmeldung';
import { aktuelleLeitung, erzeugeBrowserLeitung, PLAN_NEU_MS, setzeLeitung } from '../leitungGeraet';
import { useHallCockpitHinweis } from '../useHallCockpitHinweis';
import { useHallLautsprecher } from '../useHallLautsprecher';
import { useHallStatus } from '../useHallStatus';

const TID = '22222222-2222-4222-8222-222222222222';
let falsch: FalscherSupabase;
let geladen: string[];

class FalscherWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage(): void { /* kein Takt im Test */ }
  terminate(): void { /* nichts */ }
}

function einschalten(): void {
  localStorage.setItem(GERAET_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1], name: 'Rechner der Turnierleitung' }));
}

async function warten(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  }
}

const aufrufe = (fn: string) => falsch.rpcLog.filter((r) => r.fn === fn);

beforeEach(() => {
  geladen = [];
  turnier.wert = null;
  lokal.aufrufe = 0;
  repos.tournamentRepository.get.mockClear();
  resetOwnFieldsForTests();
  konto.accountId = 'konto-olli';
  const speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
  falsch = new FalscherSupabase();
  sb.client = falsch.client;
  const kontext = new FalscherAudioKontext();
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
  __setzeHallStatusFuerTests();
  vi.unstubAllGlobals();
  __setzeGeraetFuerTests();
  setzeLeitung(null);
});

describe('<HallLautsprecherLaufzeit/> – Lebenszeichen und Leitung', () => {
  it('@HT-012 eingeschaltet, „Ton aktivieren“ nicht geklickt → Lebenszeichen „not_activated“ für Feld 1 (ohne Worker)', async () => {
    einschalten();
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(aufrufe('hall_speaker_heartbeat')[0]?.args).toMatchObject({ p_tournament_id: TID, p_fields: [1], p_state: 'not_activated', p_output_changed: false });
  });

  it('Gegenbeispiel: ein Gast meldet weder als Lautsprecher noch als Leitung', async () => {
    einschalten();
    konto.accountId = 'guest';
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(aufrufe('hall_speaker_heartbeat')).toEqual([]);
    expect(aktuelleLeitung()).toBeNull();
  });

  it('jedes angemeldete Gerät hat das Lebenszeichen der Leitung, auch ohne Lautsprecher-Funktion', async () => {
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(aktuelleLeitung()).not.toBeNull();
    expect(aufrufe('hall_speaker_heartbeat')).toEqual([]);
  });

  it('Regel 1: das Lebenszeichen meldet „superseded“ → das Gerät ist kein Lautsprecher mehr, die Laufzeit ist weg', async () => {
    falsch.rpcDaten.hall_speaker_heartbeat = { status: 'ok', serverNow: 0, fields: [{ field: 1, status: 'superseded', test: null, lead: null }] };
    einschalten();
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(geraetStand().einschaltung).toBeNull();
    expect(geraetStand().laufzeit).toBeNull();
    expect(localStorage.getItem(GERAET_SCHLUESSEL)).toBeNull();
  });
});

describe('Ausschalten ohne Netz (@HT-038)', () => {
  it('lokal sofort aus; die Abmeldung wird gemerkt und beim nächsten Start mit Netz nachgeholt', async () => {
    einschalten();
    const { result } = renderHook(() => useHallLautsprecher(TID));
    falsch.netz = 'fehler';
    await act(async () => { await result.current.ausschalten(); });
    expect(result.current.rolle).toBe('keiner');
    expect(JSON.parse(localStorage.getItem(ABMELDEN_SCHLUESSEL) ?? 'null')).toEqual({ turnierId: TID, felder: [1] });
    falsch.netz = 'ok';
    falsch.rpcDaten.hall_speaker_release = { status: 'released', fields: [1] };
    render(<HallLautsprecherLaufzeit />);
    await warten();
    expect(aufrufe('hall_speaker_release')).toHaveLength(2);
    expect(aufrufe('hall_speaker_release')[1]?.args).toMatchObject({ p_tournament_id: TID, p_fields: [1] });
    expect(localStorage.getItem(ABMELDEN_SCHLUESSEL)).toBeNull();
  });

  it('Gegenbeispiel: ein neues Einschalten verwirft die offene Abmeldung (sie nähme die neue Zuordnung sonst weg)', async () => {
    localStorage.setItem(ABMELDEN_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1] }));
    falsch.rpcDaten.hall_speaker_assign = { status: 'assigned', fields: [1], replaced: [] };
    const { result } = renderHook(() => useHallLautsprecher(TID));
    await act(async () => { await result.current.einschalten([1], 'Rechner der Turnierleitung'); });
    expect(localStorage.getItem(ABMELDEN_SCHLUESSEL)).toBeNull();
  });
});

describe('k4-neu-2 – „Anhören“ mit der Tonwahl des Turniers (@HT-023)', () => {
  it('@HT-023 ein Gerät ohne Lautsprecher-Funktion: „Anhören“ lädt die Abpfiff-Hupe des Turniers (Hupe 3), nicht nur Hupe 1', async () => {
    turnier.wert = { matches: [], matchCockpitSettings: { soundId: 'horn-3' } };
    const { result } = renderHook(() => useHallLautsprecher(TID));
    let gespielt: boolean | 'belegt' = false;
    await act(async () => { gespielt = await result.current.hierAnhoeren('abpfiff'); });
    expect(gespielt).toBe(true);
    expect(geladen).toContain('/sounds/horn-3.mp3');
  });
});

describe('useHallStatus(tid) – Datenseite für H4', () => {
  it('@HT-041 liest hall_sound_status, solange eingebunden; ohne Stand vom Server kein Testton („kein Netz“) und kein Aufruf', async () => {
    falsch.netz = 'fehler';
    const { result, unmount } = renderHook(() => useHallStatus(TID));
    await warten();
    expect(aufrufe('hall_sound_status')).toHaveLength(1);
    expect(result.current.stand).toBe('unbekannt');
    let antwort: Awaited<ReturnType<typeof result.current.testtonAnfordern>> | undefined;
    await act(async () => { antwort = await result.current.testtonAnfordern(1); });
    expect(antwort).toEqual({ ok: false, grund: 'netz' });
    expect(aufrufe('hall_test_tone_request')).toEqual([]);
    unmount();
  });

  it('@HT-017 @HT-049 aktueller Stand: Testton anfordern und „Gehört“ gehen an den Server', async () => {
    falsch.rpcDaten.hall_sound_status = {
      serverNow: 1000, closed: false, leads: [],
      speakers: [{ field: 1, deviceName: 'Rechner', isThisDevice: false, state: 'ready', assignedAt: 0, outputHint: true, hintAt: 900, lastSeen: 900, ageMs: 100, test: null }],
      settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [] },
    };
    falsch.rpcDaten.hall_test_tone_request = { status: 'requested', testId: 't-1', requestedAt: 1000, serverNow: 1000 };
    falsch.rpcDaten.hall_output_heard = { status: 'heard' };
    const { result } = renderHook(() => useHallStatus(TID));
    await warten();
    expect(result.current.stand).toBe('aktuell');
    expect(result.current.felder[1]).toEqual({ art: 'bereit', pruefen: true });
    await act(async () => { await result.current.testtonAnfordern(1); });
    await act(async () => { await result.current.gehoert(1); });
    expect(aufrufe('hall_test_tone_request')[0]?.args).toMatchObject({ p_tournament_id: TID, p_field: 1 });
    expect(aufrufe('hall_output_heard')[0]?.args).toMatchObject({ p_tournament_id: TID, p_field: 1 });
  });
});

describe('useHallCockpitHinweis(tid, feldId) – Datenseite für H4', () => {
  function leitungMit(stand: LeitungStand | null, jetzt = 1000): LeitungLebenszeichen {
    return { start: vi.fn(), stop: vi.fn(), stand: () => stand, versuchGescheitert: () => false, version: () => 1, jetzt: () => jetzt, subscribe: () => () => undefined };
  }

  it('@HT-040 Lautsprecher meldet sich nicht → „aus“ mit Grund und „zuletzt“ (Serverzeit)', () => {
    setzeLeitung(leitungMit({ status: 'ok', speaker: { state: 'ready', ageMs: 12_000, outputHint: false }, serverNow: 50_000, empfangenUm: 900 }));
    const { result } = renderHook(() => useHallCockpitHinweis(TID, 'field-1'));
    expect(result.current).toEqual({ art: 'aus', grund: 'meldetSichNicht', zuletztServerMs: 38_000 });
  });

  it('@HT-050 bereit mit Hinweis → „Ausgang geändert“; ohne Lebenszeichen der Leitung (kein Spiel) → kein Hinweis', () => {
    setzeLeitung(leitungMit({ status: 'ok', speaker: { state: 'ready', ageMs: 1000, outputHint: true }, serverNow: 50_000, empfangenUm: 900 }));
    const { result, rerender } = renderHook(({ feld }) => useHallCockpitHinweis(TID, feld), { initialProps: { feld: 'field-1' } });
    expect(result.current).toEqual({ art: 'ausgangGeaendert' });
    act(() => { setzeLeitung(leitungMit(null)); });
    rerender({ feld: 'field-1' });
    expect(result.current).toEqual({ art: 'keiner' });
  });
});

describe('Fixrunde 1 – W2: Hallenton liest die Turnierkopie nur lokal, die Leitung nur bei angepfiffenem Spiel', () => {
  const plan = { id: TID, matches: [{ id: 'spiel-11', field: 1, round: 1, matchNumber: 11, slotA: { kind: 'team', teamId: 'sv-sued' }, slotB: { kind: 'team', teamId: 'fc-nord' } }] };
  function leitungMit(status: string | null) {
    const uhr = new ManuelleUhr(0);
    const rpc = vi.fn(() => Promise.resolve({ ok: true as const, status: 'ok' as const, serverNow: 0, speaker: null }));
    const leitung = erzeugeBrowserLeitung({
      engine: { engine: { view: () => (status ? { result: { state: { status } } } : null), subscribe: () => () => undefined } } as never,
      ladeTurnier: () => { lokal.aufrufe += 1; return Promise.resolve(turnier.wert as never); },
      rpc,
      zeitgeber: uhr.gruppe('leitung'),
    });
    return { uhr, rpc, leitung };
  }
  async function vor(uhr: ManuelleUhr, ms: number): Promise<void> {
    for (let t = 0; t < ms; t += 500) {
      uhr.vorruecken(500);
      await act(async () => { await Promise.resolve(); });
    }
  }

  it('Toms Handy steuert Feld 1, kein Spiel angepfiffen → kein Lebenszeichen, kein Lesevorgang in der Cloud, die lokale Kopie höchstens alle 30 s', async () => {
    turnier.wert = plan;
    noteFieldControlList(TID, [{ field: 1, epoch: 1, holderName: null, holderRole: null, holderDeviceLabel: null, isMine: true, claimedAt: null }]);
    const { uhr, rpc, leitung } = leitungMit(null);
    leitung.start();
    await vor(uhr, 60_000);
    leitung.stop();
    expect(rpc).not.toHaveBeenCalled();
    expect(repos.tournamentRepository.get).not.toHaveBeenCalled();
    expect(lokal.aufrufe).toBeLessThanOrEqual(60_000 / PLAN_NEU_MS + 1);
  });

  it('unlesbare lokale Kopie → kein Lebenszeichen, und gelesen wird trotzdem höchstens alle 30 s', async () => {
    turnier.wert = { id: TID, matches: [{ id: 'spiel-11', field: 1 }] }; // ohne Seiten: planAusTurnier wirft
    noteFieldControlList(TID, [{ field: 1, epoch: 1, holderName: null, holderRole: null, holderDeviceLabel: null, isMine: true, claimedAt: null }]);
    const { uhr, rpc, leitung } = leitungMit('running');
    leitung.start();
    await vor(uhr, 60_000);
    leitung.stop();
    expect(rpc).not.toHaveBeenCalled();
    expect(lokal.aufrufe).toBeLessThanOrEqual(60_000 / PLAN_NEU_MS + 1);
  });

  it('@HT-034 Spiel 11 läuft nach der eigenen Engine → Lebenszeichen der Leitung alle 5 s', async () => {
    turnier.wert = plan;
    noteFieldControlList(TID, [{ field: 1, epoch: 1, holderName: null, holderRole: null, holderDeviceLabel: null, isMine: true, claimedAt: null }]);
    const { uhr, rpc, leitung } = leitungMit('running');
    leitung.start();
    await vor(uhr, 20_000);
    leitung.stop();
    expect(rpc.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(repos.tournamentRepository.get).not.toHaveBeenCalled();
  });

  it('N3 (H3b-3): ein Spiel, das nicht im gemerkten Plan steht, ist am Laptop angepfiffen → das Lebenszeichen kommt im nächsten 5-s-Takt', async () => {
    turnier.wert = plan; // gemerkt: nur Spiel 11, nicht angepfiffen
    noteFieldControlList(TID, [{ field: 1, epoch: 1, holderName: null, holderRole: null, holderDeviceLabel: null, isMine: true, claimedAt: null }]);
    const uhr = new ManuelleUhr(0);
    const rpc = vi.fn(() => Promise.resolve({ ok: true as const, status: 'ok' as const, serverNow: 0, speaker: null }));
    let laeuft = new Set<string>();
    let melde: (() => void) | null = null;
    const engine = {
      view: (id: string) => (laeuft.has(id) ? { result: { state: { status: 'running' } } } : null),
      subscribe: (fn: () => void) => { melde = fn; return () => { melde = null; }; },
    };
    const leitung = erzeugeBrowserLeitung({
      engine: { engine } as never,
      ladeTurnier: () => Promise.resolve(turnier.wert as never),
      rpc,
      zeitgeber: uhr.gruppe('leitung'),
    });
    leitung.start();
    await vor(uhr, 7000);
    expect(rpc).not.toHaveBeenCalled();
    // Endrunde erzeugt: Spiel 12 neu auf Feld 1 in der lokalen Kopie, am Laptop angepfiffen (die Engine meldet die Änderung)
    const spiel12 = { ...plan.matches[0], id: 'spiel-12', round: 2, matchNumber: 12 };
    turnier.wert = { ...plan, matches: [...plan.matches, spiel12] };
    laeuft = new Set(['spiel-12']);
    (melde as (() => void) | null)?.();
    await vor(uhr, 3000); // bis zum nächsten Takt bei 10 s
    expect(rpc).toHaveBeenCalledTimes(1);
    leitung.stop();
    expect(melde).toBeNull();
  });

  it('der Baustein liest für Lebenszeichen, Tonwahl und Turnierende nie über das Cloud-Repository', async () => {
    turnier.wert = { ...plan, matchCockpitSettings: { soundId: 'horn-2' } };
    einschalten();
    render(<HallLautsprecherLaufzeit />);
    await warten();
    await act(async () => { await geraetStand().laufzeit?.tonAktivieren(); });
    await warten();
    expect(lokal.aufrufe).toBeGreaterThan(0);
    expect(repos.tournamentRepository.get).not.toHaveBeenCalled();
  });

  it('die Tonwahl wird nicht doppelt gelesen, solange eine Abfrage läuft', async () => {
    let offen: () => void = () => undefined;
    const lauf = vi.fn(() => new Promise<void>((r) => { offen = r; }));
    const neuLesen = einzelnZugleich(lauf);
    neuLesen();
    neuLesen();
    neuLesen();
    expect(lauf).toHaveBeenCalledTimes(1);
    offen();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    neuLesen();
    expect(lauf).toHaveBeenCalledTimes(2);
  });
});

describe('Fixrunde 1 – W3, K5, K6', () => {
  it('W3 @HT-038 „Aus“ im schwachen WLAN (Antwort hängt) → der Lautsprecher ist sofort aus, die Abmeldung ist gemerkt', async () => {
    einschalten();
    render(<HallLautsprecherLaufzeit />);
    const { result } = renderHook(() => useHallLautsprecher(TID));
    await warten();
    const laufzeit = geraetStand().laufzeit;
    expect(laufzeit?.getSnapshot().rolle).toBe('wartet');
    falsch.haengendeRpcs.add('hall_speaker_release');
    act(() => { void result.current.ausschalten(); });
    expect(laufzeit?.getSnapshot().rolle).toBe('aus'); // gestoppt: kein geplanter Ton erklingt mehr
    expect(result.current.rolle).toBe('keiner');
    expect(JSON.parse(localStorage.getItem(ABMELDEN_SCHLUESSEL) ?? 'null')).toEqual({ turnierId: TID, felder: [1] });
    await warten();
    expect(geraetStand().laufzeit).toBeNull();
  });

  it('W3 die Abmeldung kommt an → die gemerkte Abmeldung ist verworfen', async () => {
    einschalten();
    falsch.rpcDaten.hall_speaker_release = { status: 'released', fields: [1] };
    const { result } = renderHook(() => useHallLautsprecher(TID));
    await act(async () => { await result.current.ausschalten(); });
    expect(localStorage.getItem(ABMELDEN_SCHLUESSEL)).toBeNull();
  });

  it('K6 Einschalten scheitert am Netz → die offene Abmeldung bleibt', async () => {
    localStorage.setItem(ABMELDEN_SCHLUESSEL, JSON.stringify({ turnierId: TID, felder: [1] }));
    falsch.netz = 'fehler';
    const { result } = renderHook(() => useHallLautsprecher(TID));
    await act(async () => { await result.current.einschalten([1], 'Rechner der Turnierleitung'); });
    expect(JSON.parse(localStorage.getItem(ABMELDEN_SCHLUESSEL) ?? 'null')).toEqual({ turnierId: TID, felder: [1] });
  });

  it('K5 @HT-023 „Hier anhören“ wartet nicht aufs Netz: hall_sound_status hängt, der Ton erklingt trotzdem mit der Hupe des Turniers', async () => {
    turnier.wert = { matches: [], matchCockpitSettings: { soundId: 'horn-3' } };
    falsch.haengendeRpcs.add('hall_sound_status');
    const { result } = renderHook(() => useHallLautsprecher(TID));
    let gespielt: boolean | 'belegt' = false;
    await act(async () => { gespielt = await result.current.hierAnhoeren('abpfiff'); });
    expect(gespielt).toBe(true);
    expect(geladen).toContain('/sounds/horn-3.mp3');
  });
});
