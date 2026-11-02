/**
 * T5 (PDF-Paket R8): Beim ersten Speichern einer Turniergrafik bittet die App den Browser, den Gerätespeicher zu behalten
 * (`navigator.storage.persist()`, ohne Garantie). Safari räumt sonst skriptbeschreibbaren Speicher nach 7 Tagen ohne Nutzung.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from '../requestPersistentStorage';

function stubStorage(persist: (() => Promise<boolean>) | undefined): void {
  vi.stubGlobal('navigator', persist === undefined ? {} : { storage: { persist } });
}

afterEach(() => vi.unstubAllGlobals());

describe('requestPersistentStorage', () => {
  it('fragt persist() an und gibt die Antwort des Browsers zurück', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    stubStorage(persist);

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('der Browser darf ablehnen: false, kein Fehler', async () => {
    stubStorage(() => Promise.resolve(false));

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('Gegenbeispiel: ohne Storage-Schnittstelle (ältere Browser) false, kein Fehler', async () => {
    stubStorage(undefined);

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('Gegenbeispiel: wirft persist(), bleibt es bei false (die Anfrage darf das Speichern nie stören)', async () => {
    stubStorage(() => Promise.reject(new Error('gesperrt')));

    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
