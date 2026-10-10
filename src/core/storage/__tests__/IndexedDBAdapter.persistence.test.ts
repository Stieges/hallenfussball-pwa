import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { IndexedDBAdapter } from '../IndexedDBAdapter';
import { StorageError } from '../StorageError';

/**
 * @FU-004 „Eintrag bleibt auf dem Gerät erhalten“ – Speicher-Teil.
 *
 * Diese Tests laufen gegen eine echte (fake-indexeddb) Datenbank, nicht gegen
 * einen Mock der Adapter-Aufrufe: Wer den Persistenz-Aufruf entfernt, wird
 * hier rot.
 */

describe('IndexedDBAdapter – Persistenz (@FU-004)', () => {
  let originalIndexedDB: unknown;

  beforeEach(() => {
    originalIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB;
    (globalThis as { indexedDB?: unknown }).indexedDB = new IDBFactory();
  });

  afterEach(() => {
    (globalThis as { indexedDB?: unknown }).indexedDB = originalIndexedDB;
    vi.restoreAllMocks();
  });

  it('Pflicht (echter Weg): Eintrag ist nach Schreiben über eine neue Instanz lesbar', async () => {
    const first = new IndexedDBAdapter();
    await first.init();
    await first.set('turnier-42', { name: 'Hallencup', spiele: 6 });

    // Neue Instanz = neue Verbindung zur selben Datenbank (wie nach App-Neustart).
    const second = new IndexedDBAdapter();
    await second.init();

    await expect(second.get<{ name: string; spiele: number }>('turnier-42')).resolves.toEqual({
      name: 'Hallencup',
      spiele: 6,
    });
  });

  it('Gegenbeispiel: Quota voll → Fehler wird geworfen, nicht still verworfen', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    const failingRequest = { error: quotaError, onerror: null as (() => void) | null, onsuccess: null };
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      queueMicrotask(() => failingRequest.onerror?.());
      return failingRequest as unknown as IDBRequest;
    });

    const result = adapter.set('turnier-43', { name: 'Voll' });

    await expect(result).rejects.toBeInstanceOf(StorageError);
    await expect(result).rejects.toMatchObject({ originalError: quotaError });
  });

  it('Gegenbeispiel: ein abgewiesener Schreibvorgang hinterlässt keinen Eintrag', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    const failingRequest = { error: quotaError, onerror: null as (() => void) | null, onsuccess: null };
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      queueMicrotask(() => failingRequest.onerror?.());
      return failingRequest as unknown as IDBRequest;
    });

    await expect(adapter.set('turnier-44', 'x')).rejects.toBeInstanceOf(StorageError);
    expect(putSpy).toHaveBeenCalledTimes(1);

    putSpy.mockRestore();
    await expect(adapter.get('turnier-44')).resolves.toBeNull();
  });
});
