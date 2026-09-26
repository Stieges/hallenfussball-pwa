/**
 * LocalStoreDb: IndexedDB-Grundgeruest fuer die lokale Spielkopie --
 * Verbindung (mit Upgrade-Kette), Transaktionen, Fehleruebersetzung.
 * Fachliche API liegt in `LocalMatchStore.ts`.
 */
export class LocalStoreFullError extends Error {
  constructor() {
    super('Local store full');
    this.name = 'LocalStoreFullError';
  }
}

export interface StoredRecord<T> {
  key: string;
  value: T;
}

function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = error.name;
    if (typeof name === 'string') {
      return name;
    }
  }
  return '';
}

/** Quota-Fehler (synchron oder ueber `tx.error`) werden zu `LocalStoreFullError` (RC1). */
function toStoreError(error: unknown): Error {
  if (errorName(error).includes('QuotaExceeded')) {
    return new LocalStoreFullError();
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error('Storage error');
}

/** `put` kann Quota-Fehler synchron werfen (so melden das einige Browser). */
export function putRecord(
  store: IDBObjectStore,
  fail: (error: Error) => void,
  record: StoredRecord<unknown>,
): void {
  try {
    store.put(record);
  } catch (error) {
    fail(toStoreError(error));
  }
}

/**
 * `get`/`getAll` liefern im DOM-Typ `IDBRequest<any>`; hier wird die Ergebnisform
 * einmal festgelegt -- die einzigen beiden Typ-Assertions an dieser Grenze.
 */
export function getStored<T>(store: IDBObjectStore, key: string): IDBRequest<StoredRecord<T> | undefined> {
  return store.get(key) as IDBRequest<StoredRecord<T> | undefined>;
}

export function getAllStored<T>(store: IDBObjectStore): IDBRequest<Array<StoredRecord<T>>> {
  return store.getAll() as IDBRequest<Array<StoredRecord<T>>>;
}

export class StoreDb {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly dbName: string,
    private readonly storeName: string,
    private readonly version: number,
  ) {}

  open(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onerror = () => {
        this.dbPromise = null;
        reject(req.error ?? new Error('IndexedDB open failed'));
      };
      // Upgrade-Kette: spaetere Versionen als weitere Cases ergaenzen (I9).
      req.onupgradeneeded = (e) => {
        const db = req.result;
        switch (e.oldVersion) {
          case 0: {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
            break;
          }
          default: {
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName, { keyPath: 'key' });
            }
            break;
          }
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
    });
    return this.dbPromise;
  }

  /**
   * Fuehrt `work` in einer Transaktion aus und loest erst bei deren Abschluss auf (I5).
   * `fail` meldet fachliche Fehler (bricht die Transaktion ab); Quota- und
   * Abbruchfehler kommen ueber `tx.error`/synchronen Wurf und werden uebersetzt.
   */
  async run<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore, fail: (error: Error) => void) => void,
    toResult: () => T,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(this.storeName, mode);
      } catch (error) {
        reject(toStoreError(error));
        return;
      }
      let failure: Error | null = null;
      const fail = (error: Error): void => {
        failure = error;
        try {
          tx.abort();
        } catch {
          // Transaktion war bereits beendet -- der Fehler wird unten gemeldet.
        }
      };
      tx.oncomplete = () => {
        if (failure) {
          reject(failure);
          return;
        }
        resolve(toResult());
      };
      tx.onabort = () => reject(failure ?? toStoreError(tx.error));
      tx.onerror = () => reject(failure ?? toStoreError(tx.error));
      try {
        work(tx.objectStore(this.storeName), fail);
      } catch (error) {
        fail(toStoreError(error));
      }
    });
  }
}
