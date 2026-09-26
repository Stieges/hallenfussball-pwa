/**
 * Lokale Spielkopie (RC2, RC3, V3, V14) -- eigene IndexedDB `hallenfussball-matches`.
 * Jede Aenderung laeuft in einer Transaktion; aufgeloest wird erst nach `tx.oncomplete`
 * (I5), damit ein Abbruch beim Commit (typisch Quota) nicht als Erfolg gemeldet wird.
 * DB-Version 2 (C2a/PC7): `rejected`, `review`, `tournamentId`, Upgrade-Kette.
 */
import { type EngineEventWithSeq } from './catchUp';
import { type EngineEvent, type MatchContext } from '../types';
import {
  StoreDb,
  LocalStoreFullError,
  getAllStored,
  getStored,
  putRecord,
  type StoredRecord,
} from './LocalStoreDb';
import {
  MATCH_COPY_FORMAT_VERSION,
  applyResolution,
  dismissRejectedEntries,
  matchCopyKey,
  normalizeCopy,
  rejectAllPendingEntries,
  type BatchResolution,
  type LegacyMatchCopy,
  type MatchCopy,
  type RejectedEntry,
} from './matchCopy';

export { LocalStoreFullError, matchCopyKey };
export type { StoredRecord, MatchCopy, RejectedEntry, BatchResolution };

/** Version 1 -> 2: vorhandene Kopien um die neuen Listen ergaenzen, nichts verlieren (RC6). */
function migrateRecords(store: IDBObjectStore, tx: IDBTransaction, oldVersion: number): void {
  if (oldVersion >= MATCH_COPY_FORMAT_VERSION) {
    return;
  }
  const req = getAllStored<LegacyMatchCopy>(store);
  req.onsuccess = () => {
    for (const record of req.result) {
      putRecord(store, () => tx.abort(), { key: record.key, value: normalizeCopy(record.value) });
    }
  };
  req.onerror = () => tx.abort();
}

export class LocalMatchStore {
  private readonly db = new StoreDb('hallenfussball-matches', 'matches', MATCH_COPY_FORMAT_VERSION, migrateRecords);

  private key(accountId: string, matchId: string): string {
    return matchCopyKey(accountId, matchId);
  }

  /** Liest die Kopie, aendert sie in-place und schreibt sie zurueck -- eine Transaktion (I5). */
  private async update(key: string, mutate: (copy: MatchCopy) => void): Promise<void> {
    await this.db.run(
      'readwrite',
      (store, fail) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          const existing = req.result?.value ?? null;
          if (!existing) {
            fail(new Error('Match copy not found'));
            return;
          }
          mutate(existing);
          putRecord(store, fail, { key, value: existing });
        };
      },
      () => undefined,
    );
  }

  async load(accountId: string, matchId: string): Promise<MatchCopy | null> {
    const key = this.key(accountId, matchId);
    let copy: MatchCopy | null = null;
    await this.db.run(
      'readonly',
      (store) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          copy = req.result?.value ?? null;
        };
      },
      () => copy,
    );
    return copy;
  }

  /**
   * Legt die Kopie an oder aktualisiert bei einer vorhandenen Kopie nur `ctx`
   * (und `tournamentId`, wenn uebergeben) und `updatedAt` -- `confirmed`, `acked`,
   * `pending`, `rejected`, `review` und `watermarkSeq` bleiben erhalten
   * (N2: der Ausgang wird nie still ueberschrieben, RC1/V3). Eine Transaktion.
   */
  async create(accountId: string, matchId: string, ctx: MatchContext, tournamentId?: string): Promise<void> {
    const key = this.key(accountId, matchId);
    await this.db.run(
      'readwrite',
      (store, fail) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          const existing = req.result?.value ?? null;
          if (existing) {
            putRecord(store, fail, {
              key,
              value: {
                ...existing,
                ctx,
                ...(tournamentId !== undefined ? { tournamentId } : {}),
                updatedAt: Date.now(),
              },
            });
            return;
          }
          putRecord(store, fail, {
            key,
            value: {
              formatVersion: MATCH_COPY_FORMAT_VERSION,
              accountId,
              matchId,
              ...(tournamentId !== undefined ? { tournamentId } : {}),
              ctx,
              confirmed: [],
              watermarkSeq: 0,
              acked: [],
              pending: [],
              rejected: [],
              review: [],
              updatedAt: Date.now(),
            },
          });
        };
      },
      () => undefined,
    );
  }

  async addPending(accountId: string, matchId: string, event: EngineEvent): Promise<void> {
    await this.update(this.key(accountId, matchId), (copy) => {
      copy.pending.push(event);
      copy.updatedAt = Date.now();
    });
  }

  async markAcked(accountId: string, matchId: string, ids: string[]): Promise<void> {
    const marked = new Set(ids);
    await this.update(this.key(accountId, matchId), (copy) => {
      const moved = copy.pending.filter((event) => marked.has(event.id));
      copy.pending = copy.pending.filter((event) => !marked.has(event.id));
      copy.acked = copy.acked.filter((event) => !marked.has(event.id)).concat(moved);
      copy.updatedAt = Date.now();
    });
  }

  async applyConfirmed(
    accountId: string,
    matchId: string,
    events: EngineEventWithSeq[],
    newWatermark: number,
  ): Promise<void> {
    const removedIds = new Set(events.map((event) => event.id));
    await this.update(this.key(accountId, matchId), (copy) => {
      const confirmedIds = new Set(copy.confirmed.map((event) => event.id));
      for (const event of events) {
        if (!confirmedIds.has(event.id)) {
          copy.confirmed.push(event);
          confirmedIds.add(event.id);
        }
      }
      copy.confirmed.sort((a, b) => a.seq - b.seq);
      copy.acked = copy.acked.filter((event) => !removedIds.has(event.id));
      copy.pending = copy.pending.filter((event) => !removedIds.has(event.id));
      // M-7: ein spaet eingetroffenes, aelteres Nachladen darf den Wasserstand nicht senken.
      copy.watermarkSeq = Math.max(copy.watermarkSeq, newWatermark);
      copy.updatedAt = Date.now();
    });
  }

  async removePending(accountId: string, matchId: string, ids: string[]): Promise<EngineEvent[]> {
    const removedIds = new Set(ids);
    let removed: EngineEvent[] = [];
    await this.update(this.key(accountId, matchId), (copy) => {
      removed = copy.pending.filter((event) => removedIds.has(event.id));
      copy.pending = copy.pending.filter((event) => !removedIds.has(event.id));
      copy.updatedAt = Date.now();
    });
    return removed;
  }

  /**
   * Ein Ergebnis-Stapel: pending -> acked/rejected/review in EINER Transaktion (V3, PC7).
   * `rejected` traegt Code, Detail und Ablehnungszeit (D-C1); IDs ausserhalb `pending` zaehlen nicht.
   */
  async resolveBatch(key: string, resolution: BatchResolution): Promise<void> {
    await this.update(key, (copy) => applyResolution(copy, resolution));
  }

  /** Alle offenen Eintraege ablehnen (54000 „Spiel voll", 55000 „Spiel weg"). */
  async rejectAllPending(key: string, code: string): Promise<void> {
    await this.update(key, (copy) => rejectAllPendingEntries(copy, code, Date.now()));
  }

  /** „Verstanden" (D-C1): bestaetigte Ablehnungen aus der Liste nehmen. */
  async dismissRejected(key: string, ids: string[]): Promise<void> {
    await this.update(key, (copy) => dismissRejectedEntries(copy, ids));
  }

  async forAccount(accountId: string): Promise<MatchCopy[]> {
    let results: MatchCopy[] = [];
    await this.db.run(
      'readonly',
      (store) => {
        const req = getAllStored<MatchCopy>(store);
        req.onsuccess = () => {
          results = req.result
            .filter((item) => item.value.accountId === accountId)
            .map((item) => item.value);
        };
      },
      () => results,
    );
    return results;
  }

  /** Gastmodus (V14): Eintrag geht direkt nach `confirmed`, die `seq` wird intern vergeben. */
  async addConfirmedLocal(accountId: string, matchId: string, event: EngineEvent): Promise<void> {
    if (accountId !== 'guest') {
      throw new Error('addConfirmedLocal ist nur fuer den Gastmodus (guest) erlaubt');
    }
    await this.update(this.key(accountId, matchId), (copy) => {
      const maxSeq = copy.confirmed.reduce((max, entry) => Math.max(max, entry.seq), 0);
      const stored: EngineEventWithSeq = { ...event, seq: maxSeq + 1 };
      copy.confirmed.push(stored);
      copy.watermarkSeq = Math.max(copy.watermarkSeq, stored.seq);
      copy.updatedAt = Date.now();
    });
  }
}
