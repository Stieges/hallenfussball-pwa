/**
 * Test-Hilfe `readCachedTournamentsInPage` (tests/e2e/cloud/deviceStore.ts): sie darf den Gerätespeicher der App nie selbst
 * anlegen. Befund C-GERAET-FOLGT-WACKELT, Ursache 1: Las der Helfer vor dem Start der App, entstand die Datenbank
 * `hallenfussball` in Version 1 ohne den Speicher `cache`; die App öffnete danach dieselbe Version ohne Upgrade, und jeder
 * Zugriff scheiterte („Unexpected error getting key 'tournaments'“, CI-Lauf 42329790935) – das Gerät zeigte „Nicht
 * gefunden“. Nachgestellt mit fake-indexeddb.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDBAdapter } from '../../../../src/core/storage/IndexedDBAdapter';
import { readCachedTournamentsInPage } from '../deviceStore';

// je Fall ein frisches Gerät (eigene IndexedDB-Fabrik)
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

describe('Test-Hilfe liest den Gerätespeicher, ohne ihn anzulegen (C-GERAET-FOLGT-WACKELT)', () => {
  it('liest der Helfer vor dem Start der App, kann die App danach trotzdem speichern und lesen', async () => {
    expect(await readCachedTournamentsInPage()).toBeNull(); // noch kein Gerätespeicher

    const app = new IndexedDBAdapter();
    await app.init();
    await app.set('tournaments', [{ id: 't1' }]);

    expect(await app.get('tournaments')).toEqual([{ id: 't1' }]);
  });

  it('Gegenbeispiel: nach dem Start der App liest der Helfer die Kopien', async () => {
    const app = new IndexedDBAdapter();
    await app.init();
    await app.set('tournaments', [{ id: 't1' }]);

    expect(await readCachedTournamentsInPage()).toEqual([{ id: 't1' }]);
  });
});
