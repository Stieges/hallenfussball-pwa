/**
 * Status-Buch des Ausgangs (C2a, PC8): Snapshot mit den Zaehlern je Turnier und
 * Spiel, Speicher-Persistenz und Fehlerhinweisen. Jede Aenderung benachrichtigt
 * die Listener sofort (Sichtbarkeit ≤ 10 s, L92).
 */
import type { LocalMatchStore } from './LocalMatchStore';
import { RIGHTS_REVOKED, type MatchCopy } from './matchCopy';
import { emptyOutboxStatus, type OutboxPause, type OutboxStatus } from './outboxTypes';

export type CopyListCounts = Pick<OutboxStatus, 'pendingByTournament' | 'pendingByMatch' | 'rejectedByMatch' | 'reviewByMatch' | 'revokedByMatch' | 'revokedWatchOnlyByMatch'>;

/** Zähler der Listen aller Kopien eines Kontos (rein). */
export function countCopyLists(copies: readonly MatchCopy[]): CopyListCounts {
  const counts: CopyListCounts = { pendingByTournament: {}, pendingByMatch: {}, rejectedByMatch: {}, reviewByMatch: {}, revokedByMatch: {}, revokedWatchOnlyByMatch: {} };
  for (const copy of copies) {
    counts.pendingByMatch[copy.matchId] = copy.pending.length;
    counts.rejectedByMatch[copy.matchId] = copy.rejected.length;
    counts.reviewByMatch[copy.matchId] = copy.review.length;
    const tournamentKey = copy.tournamentId ?? '';
    counts.pendingByTournament[tournamentKey] = (counts.pendingByTournament[tournamentKey] ?? 0) + copy.pending.length;
    const handedOver = copy.review.map((event) => copy.reviewReasons?.[event.id]).filter((reason) => reason?.code === RIGHTS_REVOKED);
    if (handedOver.length > 0) {
      counts.revokedByMatch[copy.matchId] = handedOver.length;
      counts.revokedWatchOnlyByMatch[copy.matchId] = handedOver.filter((reason) => reason?.change === 'watch_only').length;
    }
  }
  return counts;
}

export class OutboxStatusBook {
  private snapshot: OutboxStatus = emptyOutboxStatus();
  private readonly listeners = new Set<(status: OutboxStatus) => void>();
  private storageRequested = false;

  get authRequired(): boolean {
    return this.snapshot.authRequired;
  }

  get clientOutdated(): boolean {
    return this.snapshot.clientOutdated;
  }

  getStatus(): OutboxStatus {
    return this.snapshot;
  }

  subscribe(listener: (status: OutboxStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Setzt Felder und benachrichtigt sofort. */
  set(fields: Partial<OutboxStatus>): void {
    this.snapshot = { ...this.snapshot, ...fields };
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  /** Zaehlt die Listen der Kopien eines Kontos neu und benachrichtigt. */
  async countCopies(
    store: LocalMatchStore,
    accountId: string | null,
    pausedMatches: Record<string, OutboxPause>,
  ): Promise<void> {
    const copies = accountId === null ? [] : await store.forAccount(accountId);
    this.set({ ...countCopyLists(copies), pausedMatches });
  }

  /** Einmal je Instanz: `navigator.storage.persist()` anfordern (RC6). Fehlt die API, kein Fehler. */
  async ensurePersistentStorage(): Promise<void> {
    if (this.storageRequested) {
      return;
    }
    this.storageRequested = true;
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    const storage = nav?.storage;
    if (!storage || typeof storage.persist !== 'function') {
      return;
    }
    try {
      this.set({ storagePersisted: await storage.persist() });
    } catch {
      this.set({ storagePersisted: false });
    }
  }
}
