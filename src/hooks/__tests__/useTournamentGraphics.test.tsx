/**
 * T3 (PDF-Paket PR 2): Hook für die Turniergrafiken. Gherkin: @W3-030 (nur auf diesem Gerät, Fehler nennt der App
 * den Grund), @DR-024 (Gerät ohne Eintrag: leer, kein Fehler).
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTournamentGraphics } from '../useTournamentGraphics';
import { createTournamentGraphicsStore, type StoredGraphic, type TournamentGraphics } from '../../core/storage/tournamentGraphicsStore';
import type { IStorageAdapter } from '../../core/storage/IStorageAdapter';

function memoryStorage(failOnSet?: Error): IStorageAdapter {
  const data = new Map<string, unknown>();
  return {
    get: <T,>(key: string) => Promise.resolve((data.has(key) ? structuredClone(data.get(key)) : null) as T | null),
    set: <T,>(key: string, value: T) => (failOnSet ? Promise.reject(failOnSet) : (data.set(key, structuredClone(value)), Promise.resolve())),
    delete: (key: string) => { data.delete(key); return Promise.resolve(); },
    clear: () => { data.clear(); return Promise.resolve(); },
    keys: () => Promise.resolve([...data.keys()]),
  };
}

const graphic = (seed: string): StoredGraphic => ({ dataUrl: `data:image/png;base64,${seed}`, widthPx: 600, heightPx: 600, originalHeightPx: 600 });
const LOGO: TournamentGraphics = { left: graphic('TElOS1M='), accent: '#2A2576' };

describe('useTournamentGraphics', () => {
  it('@DR-024 Gerät ohne Eintrag: leere Grafiken, kein Fehler, nach dem Laden nicht mehr "loading"', async () => {
    const store = createTournamentGraphicsStore(() => Promise.resolve(memoryStorage()));
    const { result } = renderHook(() => useTournamentGraphics('t1', store));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.graphics).toEqual({});
    expect(result.current.error).toBeNull();
  });

  it('@W3-030 speichern: der Zustand zeigt die Grafik, und ein neuer Hook für dieselbe ID lädt sie wieder', async () => {
    const storage = memoryStorage();
    const store = createTournamentGraphicsStore(() => Promise.resolve(storage));
    const { result } = renderHook(() => useTournamentGraphics('t1', store));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = false;
    await act(async () => { ok = await result.current.save(LOGO); });

    expect(ok).toBe(true);
    expect(result.current.graphics).toEqual(LOGO);
    const second = renderHook(() => useTournamentGraphics('t1', store));
    await waitFor(() => expect(second.result.current.graphics).toEqual(LOGO));
  });

  it('@W3-030 Gegenbeispiel: ein zweites Turnier sieht die Grafik nicht', async () => {
    const storage = memoryStorage();
    const store = createTournamentGraphicsStore(() => Promise.resolve(storage));
    await store.save('t1', LOGO);

    const { result } = renderHook(() => useTournamentGraphics('t2', store));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.graphics).toEqual({});
  });

  it('@W3-030 ein Speicherfehler (Quote) wird gemeldet, nicht verschluckt; die gezeigte Grafik bleibt die alte', async () => {
    const quota = Object.assign(new Error('Speicher voll'), { name: 'QuotaExceededError' });
    const storage = memoryStorage();
    const store = createTournamentGraphicsStore(() => Promise.resolve(storage));
    await store.save('t1', LOGO);
    const { result } = renderHook(() => useTournamentGraphics('t1', store));
    await waitFor(() => expect(result.current.graphics).toEqual(LOGO));
    storage.set = () => Promise.reject(quota);

    let ok = true;
    await act(async () => { ok = await result.current.save({ left: graphic('TkVV') }); });

    expect(ok).toBe(false);
    expect(result.current.error).toBe(quota);
    expect(result.current.graphics).toEqual(LOGO);
    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });

  it('@W3-030 entfernen: Zustand leer und Eintrag weg', async () => {
    const storage = memoryStorage();
    const store = createTournamentGraphicsStore(() => Promise.resolve(storage));
    await store.save('t1', LOGO);
    const { result } = renderHook(() => useTournamentGraphics('t1', store));
    await waitFor(() => expect(result.current.graphics).toEqual(LOGO));

    await act(async () => { await result.current.remove(); });

    expect(result.current.graphics).toEqual({});
    expect(await store.load('t1')).toEqual({});
  });

  it('@DR-024 ohne Turnier-ID (Entwurf noch ohne ID): leer, kein Zugriff auf den Speicher', async () => {
    const store = createTournamentGraphicsStore(() => Promise.reject(new Error('nicht aufrufen')));
    const { result } = renderHook(() => useTournamentGraphics(undefined, store));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.graphics).toEqual({});
    expect(result.current.error).toBeNull();
  });
});
