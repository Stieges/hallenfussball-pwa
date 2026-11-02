/**
 * T3 (PDF-Paket PR 2): Gerätespeicher für die Turniergrafiken, getrennt vom Turnier.
 * Gherkin: @W3-030 (Grafiken nur auf dem hochladenden Gerät, andere Geräte drucken ohne), @DR-024 (ohne Eintrag: leer,
 * kein Fehler), @W3-030 Kopie auf demselben Gerät (F6).
 */
import { describe, expect, it } from 'vitest';
import type { IStorageAdapter } from '../IStorageAdapter';
import { STORAGE_KEYS } from '../../../constants/storage';
import { createTournamentGraphicsStore, type StoredGraphic, type TournamentGraphics } from '../tournamentGraphicsStore';

function memoryStorage(): IStorageAdapter & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T,>(key: string) => Promise.resolve((data.has(key) ? structuredClone(data.get(key)) : null) as T | null),
    set: <T,>(key: string, value: T) => { data.set(key, structuredClone(value)); return Promise.resolve(); },
    delete: (key: string) => { data.delete(key); return Promise.resolve(); },
    clear: () => { data.clear(); return Promise.resolve(); },
    keys: () => Promise.resolve([...data.keys()]),
  };
}

const graphic = (seed: string, height = 600): StoredGraphic => ({
  dataUrl: `data:image/png;base64,${seed}`, widthPx: height, heightPx: height, originalHeightPx: height,
});
const logos: TournamentGraphics = { left: graphic('TElOS1M='), right: graphic('UkVDSFRT', 300), accent: '#2A2576' };

function setup() {
  const storage = memoryStorage();
  return { storage, store: createTournamentGraphicsStore(() => Promise.resolve(storage)) };
}

describe('@W3-030 Gerätespeicher für Turniergrafiken', () => {
  it('@W3-030 speichert unter tournament-graphics-<id> und liest dasselbe zurück (byte-gleich)', async () => {
    const { storage, store } = setup();

    await store.save('t1', logos);

    expect([...storage.data.keys()]).toEqual(['tournament-graphics-t1']);
    expect(await store.load('t1')).toEqual(logos);
  });

  it('@W3-030 der Schlüssel liegt nicht bei den Turnieren und gleicht keinem Turnier-Schlüssel', async () => {
    const { storage, store } = setup();
    await store.save('t1', logos);

    expect(STORAGE_KEYS.tournamentGraphics('t1')).toBe('tournament-graphics-t1');
    expect(STORAGE_KEYS.tournamentGraphics('t1')).not.toBe(STORAGE_KEYS.TOURNAMENTS);
    expect(storage.data.has(STORAGE_KEYS.TOURNAMENTS)).toBe(false);
  });

  it('@W3-030 Gegenbeispiel: ein zweites Turnier auf demselben Gerät hat keine Grafik (Schlüssel je Turnier-ID)', async () => {
    const { store } = setup();
    await store.save('t1', logos);

    expect(await store.load('t2')).toEqual({});
  });

  it('@DR-024 Co-Admin-Gerät ohne Eintrag: leere Grafiken, kein Fehler', async () => {
    const { store } = setup();

    await expect(store.load('unbekannt')).resolves.toEqual({});
  });

  it('@DR-024 ein beschädigter Eintrag gibt leere Grafiken zurück statt zu werfen', async () => {
    const { storage, store } = setup();
    storage.data.set('tournament-graphics-t1', { left: { dataUrl: 42 }, accent: 'blau' });

    await expect(store.load('t1')).resolves.toEqual({});
  });

  it('@W3-030 save ersetzt den Eintrag; ein leerer Satz entfernt ihn (Entfernen → keine Grafik, kein Rest)', async () => {
    const { storage, store } = setup();
    await store.save('t1', logos);
    await store.save('t1', { right: logos.right });

    expect(await store.load('t1')).toEqual({ right: logos.right });

    await store.save('t1', {});

    expect(storage.data.size).toBe(0);
  });

  it('@W3-030 remove löscht nur das eine Turnier', async () => {
    const { store } = setup();
    await store.save('t1', logos);
    await store.save('t2', logos);
    await store.remove('t1');

    expect(await store.load('t1')).toEqual({});
    expect(await store.load('t2')).toEqual(logos);
  });

  it('@W3-030 Kopie auf demselben Gerät hat die Grafiken, das Original bleibt unverändert', async () => {
    const { store } = setup();
    await store.save('alt', logos);

    await store.copy('alt', 'neu');

    expect(await store.load('neu')).toEqual(logos);
    expect(await store.load('alt')).toEqual(logos);
  });

  it('@W3-030 Kopie eines Turniers ohne Grafik legt keinen Eintrag an', async () => {
    const { storage, store } = setup();

    await store.copy('alt', 'neu');

    expect(storage.data.size).toBe(0);
  });

  it('@W3-030 ein Fehler beim Speichern (Quote) wird geworfen, nicht verschluckt; der alte Eintrag bleibt', async () => {
    const { storage, store } = setup();
    await store.save('t1', logos);
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    storage.set = () => Promise.reject(quota);

    await expect(store.save('t1', { left: graphic('TkVV') })).rejects.toBe(quota);
    expect(await store.load('t1')).toEqual(logos);
  });
});
