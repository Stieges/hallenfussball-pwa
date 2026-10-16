/**
 * LocalStorageAdapter (A-05: stuetzt das Beiseitelegen von Altformat-Turnieren, wenn IndexedDB fehlt).
 * localStorage wird durch einen Map-gestuetzten Ersatz ersetzt (Node-Umgebung).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageAdapter } from '../LocalStorageAdapter';
import { StorageError } from '../StorageError';

function installFakeLocalStorage(overrides: Partial<Storage> = {}): Map<string, string> {
  const map = new Map<string, string>();
  const fake: Storage = {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => { map.delete(key); },
    setItem: (key, value) => { map.set(key, value); },
    ...overrides,
  };
  vi.stubGlobal('localStorage', fake);
  return map;
}

describe('LocalStorageAdapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('Lesen und Schreiben', () => {
    let adapter: LocalStorageAdapter;
    beforeEach(() => {
      installFakeLocalStorage();
      adapter = new LocalStorageAdapter();
    });

    it('schreibt JSON und liest es als Objekt zurueck', async () => {
      await adapter.set('k', { a: 1, b: ['x'] });
      expect(await adapter.get('k')).toEqual({ a: 1, b: ['x'] });
    });

    it('Gegenbeispiel: fehlender Schluessel liefert null', async () => {
      expect(await adapter.get('fehlt')).toBeNull();
    });

    it('delete entfernt nur den genannten Schluessel', async () => {
      await adapter.set('a', 1);
      await adapter.set('b', 2);
      await adapter.delete('a');
      expect(await adapter.keys()).toEqual(['b']);
    });

    it('clear leert alles, keys listet alle Schluessel', async () => {
      await adapter.set('a', 1);
      await adapter.set('b', 2);
      expect((await adapter.keys()).sort()).toEqual(['a', 'b']);
      await adapter.clear();
      expect(await adapter.keys()).toEqual([]);
    });
  });

  describe('Fehler werden als StorageError gemeldet', () => {
    it('kaputtes JSON beim Lesen', async () => {
      const map = installFakeLocalStorage();
      map.set('k', '{kaputt');
      await expect(new LocalStorageAdapter().get('k')).rejects.toBeInstanceOf(StorageError);
    });

    it('Speicher voll beim Schreiben (QuotaExceededError)', async () => {
      installFakeLocalStorage({
        setItem: () => { throw new DOMException('voll', 'QuotaExceededError'); },
      });
      await expect(new LocalStorageAdapter().set('k', 1)).rejects.toThrow('quota exceeded');
    });

    it('anderer Fehler beim Schreiben', async () => {
      installFakeLocalStorage({ setItem: () => { throw new Error('boom'); } });
      await expect(new LocalStorageAdapter().set('k', 1)).rejects.toThrow("Failed to set item 'k'");
    });

    it('Fehler bei delete, clear, keys und get', async () => {
      installFakeLocalStorage({
        getItem: () => { throw new Error('boom'); },
        removeItem: () => { throw new Error('boom'); },
        clear: () => { throw new Error('boom'); },
        key: () => { throw new Error('boom'); },
        get length() { return 1; },
      });
      const adapter = new LocalStorageAdapter();
      await expect(adapter.get('k')).rejects.toBeInstanceOf(StorageError);
      await expect(adapter.delete('k')).rejects.toBeInstanceOf(StorageError);
      await expect(adapter.clear()).rejects.toBeInstanceOf(StorageError);
      await expect(adapter.keys()).rejects.toBeInstanceOf(StorageError);
    });
  });
});
