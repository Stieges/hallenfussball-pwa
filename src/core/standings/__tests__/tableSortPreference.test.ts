/**
 * Task 2 „Tabellen sortieren“: Gerätespeicher der Sortier-Vorliebe (@TS-011).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deviceSortPreferences } from '../tableSortPreference';

const KEY = 'hallenfussball.tabellenSortierung';

/** Testumgebung ist `node` (kein window): ein kleiner Speicher-Ersatz, den wir je Test neu setzen. */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size; },
    ...overrides,
  };
}
const useStorage = (storage: Storage): Storage => {
  vi.stubGlobal('window', { localStorage: storage });
  return storage;
};

describe('deviceSortPreferences', () => {
  let storage: Storage;
  beforeEach(() => { storage = useStorage(fakeStorage()); });
  afterEach(() => vi.unstubAllGlobals());

  it('@TS-011 nichts gemerkt → undefined', () => {
    expect(deviceSortPreferences.read('gruppe')).toBeUndefined();
  });

  it('@TS-011 Rundlauf je Tabellenart, Richtung bleibt erhalten', () => {
    deviceSortPreferences.write('gruppe', { column: 'pkt', reversed: true });
    deviceSortPreferences.write('tor', { column: 'tore', reversed: false });
    expect(deviceSortPreferences.read('gruppe')).toEqual({ column: 'pkt', reversed: true });
    expect(deviceSortPreferences.read('tor')).toEqual({ column: 'tore', reversed: false });
    expect(deviceSortPreferences.read('end')).toBeUndefined();
    expect(JSON.parse(storage.getItem(KEY)!)).toEqual({ gruppe: 'pkt.r', tor: 'tore' });
  });

  it('@TS-011 „platz“ gemerkt → null (Platzierung), nicht undefined', () => {
    deviceSortPreferences.write('gesamt', null);
    expect(storage.getItem(KEY)).toBe('{"gesamt":"platz"}');
    expect(deviceSortPreferences.read('gesamt')).toBeNull();
  });

  it('@TS-011 Schreiben einer Art lässt die anderen stehen', () => {
    deviceSortPreferences.write('gruppe', { column: 'team', reversed: false });
    deviceSortPreferences.write('end', { column: 'diff', reversed: false });
    expect(deviceSortPreferences.read('gruppe')).toEqual({ column: 'team', reversed: false });
  });

  it('@TS-011 unlesbares JSON oder unbekannter Wert → undefined', () => {
    storage.setItem(KEY, '{kaputt');
    expect(deviceSortPreferences.read('gruppe')).toBeUndefined();
    storage.setItem(KEY, '{"gruppe":"quatsch","end":5}');
    expect(deviceSortPreferences.read('gruppe')).toBeUndefined();
    expect(deviceSortPreferences.read('end')).toBeUndefined();
    storage.setItem(KEY, '[1]');
    expect(deviceSortPreferences.read('gruppe')).toBeUndefined();
  });

  it('@TS-011 werfender localStorage: Lesen → undefined, Schreiben still', () => {
    useStorage(fakeStorage({
      getItem: () => { throw new Error('gesperrt'); },
      setItem: () => { throw new Error('voll'); },
    }));
    expect(deviceSortPreferences.read('gruppe')).toBeUndefined();
    expect(() => deviceSortPreferences.write('gruppe', null)).not.toThrow();
  });
});

describe('deviceSortPreferences ohne window', () => {
  it('@TS-011 fehlt der Speicher ganz, gilt „nichts gemerkt“', () => {
    expect(deviceSortPreferences.read('gruppe')).toBeUndefined();
    expect(() => deviceSortPreferences.write('gruppe', null)).not.toThrow();
  });
});
