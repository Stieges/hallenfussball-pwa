/**
 * @HT-041 „Hat die Verwaltung selbst kein Netz, zeigt sie ‚Status unbekannt‘ statt eines alten ‚bereit‘“ – die Karte je Feld im
 * Unterpunkt „Hallenton“ (Befund C-HALLENTON-OFFLINE-GEOEFFNET-FALSCHER-STAND). Ablauf aus dem Szenario: Seite öffnen, verlassen,
 * erneut öffnen, verlassen, Netz weg, Seite öffnen → Karte „Status unbekannt“. Über den echten Hook `useHallentonDaten` mit dem
 * echten `useHallStatus`; nur Netz-RPC, Lautsprecher-Laufzeit des Geräts und Spielplan sind Doppel.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => ({
  speakers: [] as Array<{ field: number; deviceName: string; state: string; ageMs: number }>,
}));
vi.mock('../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../core/device/deviceId', () => ({ getDeviceId: () => 'geraet-olli' }));
vi.mock('../../../core/repositories/hallentonRpc', () => ({
  hallSoundStatus: () => Promise.resolve({
    ok: true, sicht: 'voll', serverNow: 1_000_000, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: rpc.speakers.map((s) => ({
      ...s, isThisDevice: false, assignedAt: 500_000, outputHint: false, hintAt: null, lastSeen: 999_000, test: null,
    })),
  }),
  hallOutputHeard: vi.fn(), hallTestToneRequest: vi.fn(),
}));
vi.mock('../useHallLautsprecher', () => ({
  useHallLautsprecher: () => ({ laufzeit: null, felder: [], name: null }),
}));
vi.mock('../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => new Map<number, number>() }));
vi.mock('../useAnderesFensterTont', () => ({ useAnderesFensterTont: () => false }));

import { __setzeHallStatusFuerTests } from '../useHallStatus';
import { useHallentonDaten } from '../useHallentonDaten';

const TID = '33333333-3333-4333-8333-333333333333';
const weiter = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
let netz = true;

function netzSetzen(an: boolean): Promise<void> {
  netz = an;
  window.dispatchEvent(new Event(an ? 'online' : 'offline'));
  return weiter(0);
}
/** Die Seite „Hallenton“ öffnen (Hook einhängen) und ein wenig bleiben. */
async function oeffneSeite() {
  const seite = renderHook(() => useHallentonDaten(TID, 2));
  await weiter(0);
  return seite;
}
const art = (s: Awaited<ReturnType<typeof oeffneSeite>>, feld: number) => s.result.current.karten.find((k) => k.feld === feld)?.zustand.art;

beforeEach(() => {
  vi.useFakeTimers();
  netz = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => netz);
  rpc.speakers = [{ field: 1, deviceName: 'Rechner der Turnierleitung', state: 'ready', ageMs: 1000 }];
});
afterEach(() => { __setzeHallStatusFuerTests(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('@HT-041 Karte ohne Netz', () => {
  it('Seite zweimal geöffnet und verlassen, dann Netz weg, Seite öffnen: Feld 1 „Status unbekannt“', async () => {
    const kopf = renderHook(() => useHallentonDaten(TID, 2)); // die Kopfzeile des Dashboards hält die Abfrage am Leben
    await weiter(0);
    const erste = await oeffneSeite();
    expect(art(erste, 1)).toBe('bereit');
    erste.unmount();
    const zweite = await oeffneSeite();
    expect(art(zweite, 1)).toBe('bereit');
    zweite.unmount();
    await netzSetzen(false);
    const dritte = await oeffneSeite();
    expect(dritte.result.current.anzeige.statusUnbekannt).toBe(true);
    expect(art(dritte, 1)).toBe('statusUnbekannt');
    expect(dritte.result.current.karten.find((k) => k.feld === 1)?.geraet?.name).toBe('Rechner der Turnierleitung');
    expect(art(dritte, 2)).toBe('keinLautsprecher'); // Feld 2 hatte nie einen
    dritte.unmount(); kopf.unmount();
  });

  it('Netz kommt zurück: nach der nächsten Antwort steht wieder der echte Zustand', async () => {
    const kopf = renderHook(() => useHallentonDaten(TID, 2));
    await weiter(0);
    (await oeffneSeite()).unmount();
    await netzSetzen(false);
    const seite = await oeffneSeite();
    expect(art(seite, 1)).toBe('statusUnbekannt');
    await netzSetzen(true);
    await weiter(5000);
    expect(art(seite, 1)).toBe('bereit');
    seite.unmount(); kopf.unmount();
  });

  it('mit Netz und ohne Lautsprecher bleibt „kein Hallen-Lautsprecher“', async () => {
    rpc.speakers = [];
    const kopf = renderHook(() => useHallentonDaten(TID, 2));
    await weiter(0);
    (await oeffneSeite()).unmount();
    const seite = await oeffneSeite();
    expect(art(seite, 1)).toBe('keinLautsprecher');
    expect(art(seite, 2)).toBe('keinLautsprecher');
    seite.unmount(); kopf.unmount();
  });

  it('ohne je einen Lautsprecher gibt es auch ohne Netz kein „Status unbekannt“ (@HT-038)', async () => {
    rpc.speakers = [];
    const kopf = renderHook(() => useHallentonDaten(TID, 2));
    await weiter(0);
    await netzSetzen(false);
    const seite = await oeffneSeite();
    expect(art(seite, 1)).toBe('keinLautsprecher');
    seite.unmount(); kopf.unmount();
  });

  it('mit Netz und Lautsprecher bleibt der echte Zustand mit dem Gerät', async () => {
    const kopf = renderHook(() => useHallentonDaten(TID, 2));
    await weiter(0);
    (await oeffneSeite()).unmount();
    const seite = await oeffneSeite();
    expect(art(seite, 1)).toBe('bereit');
    expect(seite.result.current.karten[0]?.geraet?.name).toBe('Rechner der Turnierleitung');
    seite.unmount(); kopf.unmount();
  });
});
