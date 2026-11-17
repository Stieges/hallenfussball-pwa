/**
 * @HT-060 Nach dem Abmelden ist der gemerkte Stand des Hallen-Lautsprechers weg; @HT-041 ohne Abmelden bleibt er stehen.
 * Echter Hook `useHallStatus` mit dem echten Melder `useKontoWechselMeldung` (das Gegenstück des AuthProviders), RPC-Doppel mit voller Sicht.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => ({ fehler: false }));
vi.mock('../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../core/device/deviceId', () => ({ getDeviceId: () => 'geraet-1' }));
vi.mock('../../../core/repositories/hallentonRpc', () => ({
  hallSoundStatus: () => Promise.resolve(rpc.fehler
    ? { ok: false, grund: 'netz' }
    : {
      ok: true, sicht: 'voll', serverNow: 1, closed: false, leads: [],
      settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
      speakers: [{ field: 1, deviceName: 'Rechner der Turnierleitung', isThisDevice: false, state: 'ready', assignedAt: 1, outputHint: false, hintAt: null, lastSeen: 1, ageMs: 1000, test: null }],
    }),
  hallOutputHeard: vi.fn(), hallTestToneRequest: vi.fn(),
}));

import { useKontoWechselMeldung } from '../../auth/context/useKontoWechselMeldung';
import { __setzeHallStatusFuerTests, useHallStatus } from '../useHallStatus';
import { NACHLAUF_MS } from '../runtime/hallStatusGeteilt';

const weiter = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const NAME = 'Rechner der Turnierleitung';

beforeEach(() => { vi.useFakeTimers(); rpc.fehler = false; });
afterEach(() => { __setzeHallStatusFuerTests(); vi.useRealTimers(); });

/** Olli sieht bei Feld 1 den Gerätenamen, verlässt die Seite; danach hat die Verwaltung kein Netz. */
async function ollisSitzungMitNetzverlust(): Promise<void> {
  const olli = renderHook(() => useHallStatus('sued'));
  await weiter(0);
  expect(olli.result.current.letzteSprecher[0]?.deviceName).toBe(NAME);
  olli.unmount();
  await weiter(NACHLAUF_MS + 1);
  rpc.fehler = true;
}

async function verwaltungOhneNetz(): Promise<ReturnType<typeof renderHook<ReturnType<typeof useHallStatus>, unknown>>> {
  const h = renderHook(() => useHallStatus('sued'));
  await weiter(16_000);
  return h;
}

function mitKonto(start: string | null) {
  return renderHook(({ id }: { id: string | null }) => useKontoWechselMeldung(id), { initialProps: { id: start } });
}

describe('@HT-060 Gemerkter Stand beim Abmelden', () => {
  it('Olli sieht den Gerätenamen, meldet sich ab, Tom öffnet ohne Netz dasselbe Turnier: kein Gerätename', async () => {
    const konto = mitKonto('olli');
    await ollisSitzungMitNetzverlust();
    konto.rerender({ id: null });
    konto.rerender({ id: 'tom' });
    const tom = await verwaltungOhneNetz();
    expect(tom.result.current.stand).toBe('unbekannt');
    expect(tom.result.current.letzteSprecher).toEqual([]);
    expect(tom.result.current.lautsprecherBekannt).toBe(false);
    tom.unmount();
  });

  it('dasselbe Konto meldet sich nach dem Abmelden wieder an: ebenfalls leer', async () => {
    const konto = mitKonto('olli');
    await ollisSitzungMitNetzverlust();
    konto.rerender({ id: null });
    konto.rerender({ id: 'olli' });
    const wieder = await verwaltungOhneNetz();
    expect(wieder.result.current.letzteSprecher).toEqual([]);
    wieder.unmount();
  });

  it('Kontowechsel ohne ausdrückliches Abmelden (abgelaufene Sitzung, neues Konto): leer', async () => {
    const konto = mitKonto('olli');
    await ollisSitzungMitNetzverlust();
    konto.rerender({ id: 'tom' });
    const tom = await verwaltungOhneNetz();
    expect(tom.result.current.letzteSprecher).toEqual([]);
    tom.unmount();
  });

  it('Gegenbeispiel @HT-041: ohne Abmelden bleibt der gemerkte Stand ohne Netz stehen', async () => {
    const konto = mitKonto('olli');
    await ollisSitzungMitNetzverlust();
    konto.rerender({ id: 'olli' });
    const olli = await verwaltungOhneNetz();
    expect(olli.result.current.stand).toBe('unbekannt');
    expect(olli.result.current.letzteSprecher[0]?.deviceName).toBe(NAME);
    expect(olli.result.current.lautsprecherBekannt).toBe(true);
    olli.unmount();
  });
});
