/**
 * Status-Buch des Ausgangs (C2a, PC8): Snapshot mit den Zaehlern je Turnier und
 * Spiel, Speicher-Persistenz und Fehlerhinweisen. Jede Aenderung benachrichtigt
 * die Listener sofort (Sichtbarkeit ≤ 10 s, L92).
 */
import type { LocalMatchStore } from './LocalMatchStore';
import { emptyOutboxStatus, type OutboxPause, type OutboxStatus } from './outboxTypes';

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
    const pendingByTournament: Record<string, number> = {};
    const pendingByMatch: Record<string, number> = {};
    const rejectedByMatch: Record<string, number> = {};
    const reviewByMatch: Record<string, number> = {};
    for (const copy of copies) {
      pendingByMatch[copy.matchId] = copy.pending.length;
      rejectedByMatch[copy.matchId] = copy.rejected.length;
      reviewByMatch[copy.matchId] = copy.review.length;
      const tournamentKey = copy.tournamentId ?? '';
      pendingByTournament[tournamentKey] = (pendingByTournament[tournamentKey] ?? 0) + copy.pending.length;
    }
    this.set({ pendingByTournament, pendingByMatch, rejectedByMatch, reviewByMatch, pausedMatches });
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
