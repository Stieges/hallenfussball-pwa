/**
 * @RE-002 Einstellung „Fehlerberichte senden“: je Gerät gespeichert, vorbelegt an, aus bleibt aus (auch nach Neuladen).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function speicher(): Storage {
  const daten = new Map<string, string>();
  return {
    get length() { return daten.size; },
    clear: () => daten.clear(),
    getItem: (k) => daten.get(k) ?? null,
    key: (i) => [...daten.keys()][i] ?? null,
    removeItem: (k) => { daten.delete(k); },
    setItem: (k, v) => { daten.set(k, String(v)); },
  };
}

beforeEach(() => { vi.stubGlobal('localStorage', speicher()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('@RE-002 Fehlerberichte senden: Speicher je Gerät', () => {
  it('ohne Eintrag ist die Einstellung an (Vorbelegung)', async () => {
    const { isErrorReportingEnabled } = await import('../errorReportPreference');
    expect(isErrorReportingEnabled()).toBe(true);
  });

  it('ausgeschaltet bleibt aus, auch wenn das Modul neu geladen wird (Neuladen der Seite)', async () => {
    const { setErrorReportingEnabled } = await import('../errorReportPreference');
    setErrorReportingEnabled(false);
    vi.resetModules();
    const neu = await import('../errorReportPreference');
    expect(neu.isErrorReportingEnabled()).toBe(false);
  });

  it('wieder eingeschaltet ist sie an (Gegenbeispiel)', async () => {
    const { setErrorReportingEnabled, isErrorReportingEnabled } = await import('../errorReportPreference');
    setErrorReportingEnabled(false);
    setErrorReportingEnabled(true);
    expect(isErrorReportingEnabled()).toBe(true);
  });

  it('gesperrter Speicher: Vorbelegung an, kein Absturz', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('gesperrt'); }, setItem: () => { throw new Error('gesperrt'); }, removeItem: () => { throw new Error('gesperrt'); } });
    const { isErrorReportingEnabled, setErrorReportingEnabled } = await import('../errorReportPreference');
    expect(isErrorReportingEnabled()).toBe(true);
    expect(() => setErrorReportingEnabled(false)).not.toThrow();
  });
});
