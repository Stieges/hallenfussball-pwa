/**
 * H4-9 Hook: das Gerät wechselt das Turnier (@HT-056, K2 aus der Re-Review) und nimmt einzelne Felder heraus (@HT-002).
 * Echter Hook, echte Zuordnungs-Logik, Supabase-Doppel. Erwartung aus dem Gherkin:
 * „bestätigt Olli, ist der Rechner Lautsprecher für Feld 1 im ‚Hallencup Nord‘, und im ‚Hallencup Süd‘ steht bei Feld 1 ‚kein Hallen-Lautsprecher‘;
 * bricht Olli ab, bleibt alles wie vorher“ – die Abmeldung im alten Turnier bleibt auch ohne Netz erhalten.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FalscherSupabase } from '../../../test/hallenton/falscherSupabase';
import { FalscherSpeicher } from '../../../test/hallenton/falschesGeraet';
import { ABMELDEN_SCHLUESSEL } from '../ausstehendeAbmeldung';
import { GERAET_SCHLUESSEL, __setzeGeraetFuerTests, geraetStand, setzeEinschaltung, setzeLaufzeit } from '../lautsprecherGeraet';
import type { HallLautsprecherLaufzeit } from '../runtime/HallLautsprecherLaufzeit';

const sb = vi.hoisted((): { client: unknown } => ({ client: null }));
vi.mock('../../../lib/supabase', () => ({
  get supabase() { return sb.client; },
  isSupabaseConfigured: true,
}));

import { useHallLautsprecher } from '../useHallLautsprecher';

const SUED = '11111111-1111-4111-8111-111111111111';
const NORD = '22222222-2222-4222-8222-222222222222';
let falsch: FalscherSupabase;
let stopp: ReturnType<typeof vi.fn>;

const aufrufe = (fn: string) => falsch.rpcLog.filter((r) => r.fn === fn);
const reihenfolge = (): string[] => falsch.rpcLog.map((r) => `${r.fn}:${(r.args as { p_tournament_id: string }).p_tournament_id === NORD ? 'nord' : 'sued'}`);
const imHallencupSued = (): void => {
  setzeEinschaltung({ turnierId: SUED, felder: [1], name: 'Rechner der Turnierleitung' });
  stopp = vi.fn();
  setzeLaufzeit({ stop: stopp, subscribe: () => () => undefined, getSnapshot: () => null } as unknown as HallLautsprecherLaufzeit);
};
const warten = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  }
};

beforeEach(() => {
  const speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
  falsch = new FalscherSupabase();
  sb.client = falsch.client;
  falsch.rpcDaten.hall_speaker_assign = { status: 'assigned', fields: [1], replaced: [] };
  falsch.rpcDaten.hall_speaker_release = { status: 'released', fields: [1] };
  __setzeGeraetFuerTests();
});
afterEach(() => __setzeGeraetFuerTests());

describe('@HT-056 Wer das Gerät in einem zweiten Turnier zum Lautsprecher macht', () => {
  it('Wechseln → erst Zuordnung im „Hallencup Nord“, dann Abmeldung im „Hallencup Süd“; lokal Laufzeit gestoppt, Gerät gehört zu Nord', async () => {
    imHallencupSued();
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    expect(result.current.rolle).toBe('anderesTurnier');
    expect(result.current.anderesTurnier).toEqual({ turnierId: SUED, felder: [1] });
    await act(async () => { await result.current.wechseln([1], 'Rechner der Turnierleitung'); });
    expect(reihenfolge()).toEqual(['hall_speaker_assign:nord', 'hall_speaker_release:sued']);
    expect(aufrufe('hall_speaker_release')[0]?.args).toMatchObject({ p_tournament_id: SUED, p_fields: [1] });
    expect(stopp).toHaveBeenCalledTimes(1);
    expect(result.current.rolle).toBe('diesesTurnier');
    expect(result.current.felder).toEqual([1]);
    expect(geraetStand().einschaltung).toEqual({ turnierId: NORD, felder: [1], name: 'Rechner der Turnierleitung' });
    expect(localStorage.getItem(ABMELDEN_SCHLUESSEL)).toBeNull(); // die Abmeldung des alten Turniers kam an
  });

  it('Gegenbeispiel: der Server meldet das Feld belegt (Rückfrage „Ablösen?“) → nichts hat sich geändert, nichts abgemeldet', async () => {
    imHallencupSued();
    falsch.rpcDaten.hall_speaker_assign = { status: 'occupied', fields: [{ field: 1, deviceName: 'Hallenmonitor Halle' }] };
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    let antwort: unknown;
    await act(async () => { antwort = await result.current.wechseln([1], 'Rechner der Turnierleitung'); });
    expect(antwort).toMatchObject({ ok: true, status: 'occupied' });
    expect(aufrufe('hall_speaker_release')).toEqual([]);
    expect(stopp).not.toHaveBeenCalled();
    expect(geraetStand().einschaltung?.turnierId).toBe(SUED);
    expect(result.current.rolle).toBe('anderesTurnier');
  });

  it('nach der Rückfrage „Ablösen?“ gilt der Wechsel mit Ablösen (p_replace)', async () => {
    imHallencupSued();
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    await act(async () => { await result.current.wechseln([1], 'Rechner der Turnierleitung', true); });
    expect(aufrufe('hall_speaker_assign')[0]?.args).toMatchObject({ p_tournament_id: NORD, p_replace: true });
    expect(geraetStand().einschaltung?.turnierId).toBe(NORD);
  });

  it('Gegenbeispiel: die Zuordnung scheitert (kein Netz) → alles wie vorher, keine Abmeldung, Laufzeit weiter an', async () => {
    imHallencupSued();
    falsch.netz = 'fehler';
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    let antwort: unknown;
    await act(async () => { antwort = await result.current.wechseln([1], 'Rechner der Turnierleitung'); });
    expect(antwort).toEqual({ ok: false, grund: 'netz' });
    expect(geraetStand().einschaltung?.turnierId).toBe(SUED);
    expect(stopp).not.toHaveBeenCalled();
    expect(localStorage.getItem(ABMELDEN_SCHLUESSEL)).toBeNull();
  });

  it('K2: die Abmeldung des alten Turniers bleibt auch ohne Netz gemerkt (die Antwort hängt), das Gerät ist trotzdem sofort umgezogen', async () => {
    imHallencupSued();
    falsch.haengendeRpcs.add('hall_speaker_release');
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    act(() => { void result.current.wechseln([1], 'Rechner der Turnierleitung'); });
    await warten();
    expect(stopp).toHaveBeenCalledTimes(1);
    expect(geraetStand().einschaltung?.turnierId).toBe(NORD);
    expect(JSON.parse(localStorage.getItem(ABMELDEN_SCHLUESSEL) ?? 'null')).toEqual({ turnierId: SUED, felder: [1] });
  });

  it('nichts zu wechseln (Gerät ist hier Lautsprecher oder in keinem Turnier) → null, kein Aufruf', async () => {
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    await act(async () => { expect(await result.current.wechseln([1], 'x')).toBeNull(); });
    setzeEinschaltung({ turnierId: NORD, felder: [1], name: 'x' });
    await act(async () => { expect(await result.current.wechseln([2], 'x')).toBeNull(); });
    expect(falsch.rpcLog).toEqual([]);
  });
});

describe('B4 Abmeldung im alten Turnier scheitert nicht am Netz', () => {
  it('kein Recht im alten Turnier → das Ergebnis nennt den Fehler, die Abmeldung wird nicht wiederholt, das neue Turnier gilt', async () => {
    imHallencupSued();
    falsch.rpcFehler.hall_speaker_release = '42501';
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    let antwort: unknown;
    await act(async () => { antwort = await result.current.wechseln([1], 'Rechner der Turnierleitung'); });
    expect(antwort).toMatchObject({ ok: true, status: 'assigned', alteAbmeldungFehler: 'kein_recht' });
    expect(geraetStand().einschaltung?.turnierId).toBe(NORD);
    expect(localStorage.getItem(ABMELDEN_SCHLUESSEL)).toBeNull();
  });
  it('Gegenbeispiel: nur am Netz gescheitert (Antwort hängt) → kein Fehlerhinweis, die Abmeldung bleibt gemerkt und wird nachgeholt', async () => {
    imHallencupSued();
    falsch.haengendeRpcs.add('hall_speaker_release');
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    const gefragt = vi.fn();
    act(() => { void result.current.wechseln([1], 'x').then(gefragt); });
    await warten();
    expect(gefragt).not.toHaveBeenCalled(); // noch unterwegs, kein Hinweis
    expect(JSON.parse(localStorage.getItem(ABMELDEN_SCHLUESSEL) ?? 'null')).toEqual({ turnierId: SUED, felder: [1] });
  });
});

describe('@HT-002 ein einzelnes Feld abwählen', () => {
  const zweiFelder = (): void => {
    localStorage.setItem(GERAET_SCHLUESSEL, JSON.stringify({ turnierId: NORD, felder: [1, 2], name: 'Rechner' }));
    __setzeGeraetFuerTests();
  };
  it('Feld 2 abwählen → nur Feld 2 am Server abgemeldet, Feld 1 bleibt Lautsprecher', async () => {
    zweiFelder();
    falsch.rpcDaten.hall_speaker_release = { status: 'released', fields: [2] };
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    expect(result.current.felder).toEqual([1, 2]);
    await act(async () => { await result.current.feldAbmelden(2); });
    expect(aufrufe('hall_speaker_release')[0]?.args).toMatchObject({ p_tournament_id: NORD, p_fields: [2] });
    expect(result.current.felder).toEqual([1]);
    expect(result.current.rolle).toBe('diesesTurnier');
    expect(localStorage.getItem(ABMELDEN_SCHLUESSEL)).toBeNull();
  });
  it('Gegenbeispiel: ein Feld, das dieses Gerät nicht hat → null, kein Aufruf', async () => {
    zweiFelder();
    const { result } = renderHook(() => useHallLautsprecher(NORD));
    await act(async () => { expect(await result.current.feldAbmelden(3)).toBeNull(); });
    expect(falsch.rpcLog).toEqual([]);
  });
});
