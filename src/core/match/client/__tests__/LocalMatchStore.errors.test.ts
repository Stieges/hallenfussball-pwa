import 'fake-indexeddb/auto';
import { IDBVersionChangeEvent } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalMatchStore, LocalStoreFullError } from '../LocalMatchStore';
import { ctx, ev, withSeq } from './fixtures';

/**
 * Laesst jeden `put`-Request erfolgreich werden und bricht DANACH die Transaktion ab
 * (Abbruch beim Commit, z.B. Quota). Wer nur auf `request.onsuccess` aufloest, merkt
 * den Abbruch nicht -- wer auf `tx.oncomplete` wartet, bekommt einen Fehler.
 * Mit `error` wird zusaetzlich `tx.error` gesetzt (so melden Browser Quota-Abbrueche).
 */
function failCommitAfterPutSuccess(error?: DOMException): void {
  const originalPut = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value: object,
    key?: IDBValidKey,
  ) {
    const req = key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
    req.addEventListener(
      'success',
      () => {
        if (error) {
          Object.defineProperty(this.transaction, 'error', { configurable: true, value: error });
        }
        this.transaction.abort();
      },
      { once: true },
    );
    return req;
  });
}

describe('LocalMatchStore: Speicherfehler', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uebersetzt QuotaExceededError beim Speichern (synchroner Abbruch) in LocalStoreFullError', async () => {
    await store.create('acc-q', 'lms-8', ctx);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    await expect(
      store.addPending('acc-q', 'lms-8', withSeq(ev({ id: 'q1', type: 'GOAL', at: 1 }), 1)),
    ).rejects.toBeInstanceOf(LocalStoreFullError);
  });

  it('uebersetzt einen Quota-Abbruch beim Commit (tx.error) in LocalStoreFullError', async () => {
    await store.create('acc-q', 'lms-16', ctx);
    failCommitAfterPutSuccess(new DOMException('quota exceeded', 'QuotaExceededError'));

    await expect(
      store.addPending('acc-q', 'lms-16', withSeq(ev({ id: 'q2', type: 'GOAL', at: 1 }), 1)),
    ).rejects.toBeInstanceOf(LocalStoreFullError);
  });

  it('behandelt nicht-quota Transaktionsabbrueche NICHT als LocalStoreFullError', async () => {
    await store.create('acc-x', 'lms-9', ctx);
    failCommitAfterPutSuccess();

    await expect(
      store.addPending('acc-x', 'lms-9', withSeq(ev({ id: 'x1', type: 'GOAL', at: 1 }), 1)),
    ).rejects.not.toBeInstanceOf(LocalStoreFullError);
  });

  it('loest erst nach dem Commit der Transaktion auf (Abbruch beim Commit wird gemeldet)', async () => {
    await store.create('acc-c', 'lms-10', ctx);
    failCommitAfterPutSuccess();

    await expect(
      store.addPending('acc-c', 'lms-10', withSeq(ev({ id: 'c1', type: 'GOAL', at: 1 }), 1)),
    ).rejects.toThrow();
  });
});

describe('LocalMatchStore: Gastmodus (V14)', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('addConfirmedLocal legt fortlaufende lokale seq an, ohne die Eingabe zu veraendern', async () => {
    await store.create('guest', 'lms-11', ctx);
    const first = ev({ id: 'g1', type: 'GOAL', at: 500, teamId: 'teamA' });
    const second = ev({ id: 'g2', type: 'GOAL', at: 600, teamId: 'teamB' });
    await store.addConfirmedLocal('guest', 'lms-11', first);
    await store.addConfirmedLocal('guest', 'lms-11', second);

    expect(Object.hasOwn(first, 'seq')).toBe(false);
    expect(Object.hasOwn(second, 'seq')).toBe(false);

    const copy = await store.load('guest', 'lms-11');
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['g1', 'g2']);
    expect(copy?.confirmed.map((e) => e.seq)).toEqual([1, 2]);
    expect(copy?.acked).toEqual([]);
    expect(copy?.pending).toEqual([]);
  });

  it('addConfirmedLocal wirft, wenn keine Kopie existiert (erst create)', async () => {
    await expect(
      store.addConfirmedLocal('guest', 'lms-12', ev({ id: 'g3', type: 'GOAL', at: 1 })),
    ).rejects.toThrow(/not found/);
  });

  it('addConfirmedLocal lehnt Konten ausserhalb des Gastmodus ab', async () => {
    await store.create('acc-not-guest', 'lms-13', ctx);
    await expect(
      store.addConfirmedLocal('acc-not-guest', 'lms-13', ev({ id: 'g4', type: 'GOAL', at: 1 })),
    ).rejects.toThrow(/guest/);
  });
});

describe('LocalMatchStore: Datenbank-Lebenszyklus (I9)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('haelt eine Verbindung offen (indexedDB.open nur einmal fuer mehrere Operationen)', async () => {
    const store = new LocalMatchStore();
    await store.create('acc-db', 'lms-14', ctx);
    const openSpy = vi.spyOn(indexedDB, 'open');
    await store.load('acc-db', 'lms-14');
    await store.load('acc-db', 'lms-14');
    await store.forAccount('acc-db');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('schliesst die Verbindung bei versionchange und oeffnet bei Bedarf neu', async () => {
    const store = new LocalMatchStore();
    const openSpy = vi.spyOn(indexedDB, 'open');
    await store.create('acc-db', 'lms-15', ctx);
    const openRequest = openSpy.mock.results[0]?.value;
    expect(openRequest).toBeDefined();
    openRequest?.result.dispatchEvent(new IDBVersionChangeEvent('versionchange'));

    const copy = await store.load('acc-db', 'lms-15');
    expect(copy?.matchId).toBe('lms-15');
    expect(openSpy).toHaveBeenCalledTimes(2);
  });
});
