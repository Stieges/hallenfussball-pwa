import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { IndexedDBAdapter } from '../IndexedDBAdapter';
import { StorageError } from '../StorageError';

/**
 * @FU-004 „Eintrag bleibt auf dem Gerät erhalten“ – Commit-Teil (Befund C-IDB-ERFOLG-VOR-COMMIT).
 *
 * Erfolg darf erst gemeldet werden, wenn die Transaktion committet ist. Bricht sie
 * danach ab (z. B. Speicher voll beim Commit), muss der Aufruf fehlschlagen.
 * Die Tests nutzen echtes fake-indexeddb; abgebrochen wird über tx.abort() direkt
 * nach dem Request-Erfolg.
 */

function abortAfterRequestSuccess(method: 'put' | 'delete' | 'clear'): void {
  const original = IDBObjectStore.prototype[method];
  vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (
    this: IDBObjectStore,
    ...args: unknown[]
  ) {
    const request = (original as (...a: unknown[]) => IDBRequest).apply(this, args);
    request.addEventListener('success', () => {
      this.transaction.abort();
    });
    return request;
  } as never);
}

describe('IndexedDBAdapter – Commit vor Erfolgsmeldung (@FU-004)', () => {
  let originalIndexedDB: unknown;

  beforeEach(() => {
    originalIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB;
    (globalThis as { indexedDB?: unknown }).indexedDB = new IDBFactory();
  });

  afterEach(() => {
    (globalThis as { indexedDB?: unknown }).indexedDB = originalIndexedDB;
    vi.restoreAllMocks();
  });

  it('Pflicht set: Abbruch nach Request-Erfolg → set lehnt mit StorageError ab, get liefert null', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    abortAfterRequestSuccess('put');

    await expect(adapter.set('turnier-50', { name: 'Verloren' })).rejects.toBeInstanceOf(StorageError);
    vi.restoreAllMocks();
    await expect(adapter.get('turnier-50')).resolves.toBeNull();
  });

  it('Pflicht delete: Abbruch nach Request-Erfolg → delete lehnt ab, Eintrag bleibt', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();
    await adapter.set('turnier-51', { name: 'Bleibt' });

    abortAfterRequestSuccess('delete');

    await expect(adapter.delete('turnier-51')).rejects.toBeInstanceOf(StorageError);
    vi.restoreAllMocks();
    await expect(adapter.get('turnier-51')).resolves.toEqual({ name: 'Bleibt' });
  });

  it('Pflicht clear: Abbruch nach Request-Erfolg → clear lehnt ab, Eintrag bleibt', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();
    await adapter.set('turnier-52', { name: 'Bleibt auch' });

    abortAfterRequestSuccess('clear');

    await expect(adapter.clear()).rejects.toBeInstanceOf(StorageError);
    vi.restoreAllMocks();
    await expect(adapter.get('turnier-52')).resolves.toEqual({ name: 'Bleibt auch' });
  });

  it('Quota beim Commit: Ursache bleibt erhalten (originalError = Quota-Fehler)', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const quota = new DOMException('Quota exceeded', 'QuotaExceededError');
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: unknown[]
    ) {
      const request = (original as (...a: unknown[]) => IDBRequest).apply(this, args);
      request.addEventListener('success', () => {
        const tx = this.transaction;
        tx.abort();
        Object.defineProperty(tx, 'error', { get: () => quota, configurable: true });
      });
      return request;
    } as never);

    const error = await adapter.set('turnier-54', { name: 'Quota' }).then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toMatchObject({ name: 'StorageError', originalError: quota });
  });

  it('Gegenbeispiel: normaler Schreibvorgang → resolve, Eintrag lesbar', async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    await expect(adapter.set('turnier-53', { name: 'OK' })).resolves.toBeUndefined();
    await expect(adapter.get('turnier-53')).resolves.toEqual({ name: 'OK' });
  });
});
