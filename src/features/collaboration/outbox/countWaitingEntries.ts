/**
 * Zaehlung der wartenden Eintraege vor dem Abmelden (D-C2, C2b).
 * Reine Funktion: liest nur, aendert und loescht nichts in der lokalen Kopie.
 */
import type { MatchCopy } from '../../../core/match/client/matchCopy';

/** Nur der Leseteil von `LocalMatchStore`, damit die Funktion einfach testbar bleibt. */
export interface WaitingEntriesSource {
  forAccount(accountId: string): Promise<MatchCopy[]>;
}

/** Summe aus `pending` und `acked` aller Kopien eines Kontos. */
export async function countWaitingEntries(store: WaitingEntriesSource, accountId: string): Promise<number> {
  const copies = await store.forAccount(accountId);
  return copies.reduce((sum, copy) => sum + copy.pending.length + copy.acked.length, 0);
}

/** Weg B (A-07c, @FU-006): Repo mit Ausgangs-Queue des Kontos (`OfflineRepository.mutationQueue`). */
interface QueueHolder {
  readonly mutationQueue: { getPendingCount(): number };
}

function isQueueHolder(repo: unknown): repo is QueueHolder {
  return typeof repo === 'object' && repo !== null && 'mutationQueue' in repo && repo.mutationQueue !== undefined && repo.mutationQueue !== null;
}

/** Wartende Eintraege der Konto-Queue (Weg B). Ein Lesefehler zaehlt 0 -- nie blockierend. */
export function countQueuedEntries(repo: unknown): number {
  try {
    return isQueueHolder(repo) ? repo.mutationQueue.getPendingCount() : 0;
  } catch {
    return 0;
  }
}

/**
 * Wartende Eintraege vor dem Abmelden (A-07c, @FU-006): Summe aus Weg A (lokale Kopie) und Weg B (Konto-Queue).
 * Jeder Ausgang zaehlt fuer sich; ein Fehler (synchron oder asynchron, auch in der Fabrik) nimmt nur dessen Anteil
 * auf 0. Gemeinsam fuer `useGuardedLogout` und den Helfer-Beitritt (@HE-092, @HE-094).
 */
export async function countWaitingBeforeSignOut(
  createMatchStore: () => WaitingEntriesSource,
  accountId: string,
  repo: unknown,
): Promise<number> {
  const storeWaiting = await Promise.resolve()
    .then(() => countWaitingEntries(createMatchStore(), accountId))
    .catch(() => 0);
  return storeWaiting + countQueuedEntries(repo);
}
