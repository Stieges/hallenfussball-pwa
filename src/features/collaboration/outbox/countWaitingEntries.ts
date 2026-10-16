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
