/**
 * Ein „Gerät“ für Tests: ein echter, getrennter Speicher statt des leeren Mocks aus `setup.dom.ts`. `installiereGeraet()` setzt ihn als
 * `window.localStorage`; ein neuer Aufruf ist ein anderes Gerät (eigener, leerer Speicher). Rückgängig mit `vi.restoreAllMocks()`.
 */
import { vi } from 'vitest';

export function neuerSpeicher(): Storage {
  const daten = new Map<string, string>();
  return {
    get length() { return daten.size; },
    clear: () => { daten.clear(); },
    key: (i) => [...daten.keys()][i] ?? null,
    getItem: (k) => daten.get(k) ?? null,
    setItem: (k, v) => { daten.set(k, v); },
    removeItem: (k) => { daten.delete(k); },
  };
}

export function installiereGeraet(): Storage {
  const speicher = neuerSpeicher();
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => speicher);
  return speicher;
}
