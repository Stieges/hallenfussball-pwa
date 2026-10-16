/**
 * Status-Hook fuer die Ausgangs-Anzeige (C2b): bildet die Status-API des
 * Senders per `useSyncExternalStore` ab. Ohne Sender (noch nicht verdrahtet,
 * C3a) zeigt der Hook den leeren Status.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { OutboxStatus } from '../../../core/match/client/outboxTypes';
import { emptyOutboxStatus } from '../../../core/match/client/outboxTypes';

/** Status-Quelle, wie sie `OutboxSender`/`OutboxStatusBook` anbieten. */
export interface OutboxStatusSource {
  getStatus(): OutboxStatus;
  subscribe(listener: (status: OutboxStatus) => void): () => void;
}

/** Stabile Referenz: `getSnapshot` muss zwischen Benachrichtigungen gleich bleiben. */
const EMPTY_STATUS: OutboxStatus = emptyOutboxStatus();

export function useOutboxStatus(sender: OutboxStatusSource | null): OutboxStatus {
  const subscribe = useCallback(
    (onStoreChange: () => void) => (sender ? sender.subscribe(() => onStoreChange()) : () => undefined),
    [sender],
  );
  const getSnapshot = useCallback(() => (sender ? sender.getStatus() : EMPTY_STATUS), [sender]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Wartende Eintraege eines Turniers (0, wenn keines zaehlt). */
export function pendingForTournament(status: OutboxStatus, tournamentId: string): number {
  return status.pendingByTournament[tournamentId] ?? 0;
}

function totalOf(counts: Record<string, number>, matchIds?: string[]): number {
  const entries = matchIds === undefined ? Object.values(counts) : matchIds.map((id) => counts[id] ?? 0);
  return entries.reduce((sum, count) => sum + count, 0);
}

/** Alle abgelehnten Eintraege, optional auf Spiele begrenzt. */
export function rejectedTotal(status: OutboxStatus, matchIds?: string[]): number {
  return totalOf(status.rejectedByMatch, matchIds);
}

/** Alle Eintraege, die auf die Turnierleitung warten, optional auf Spiele begrenzt. */
export function reviewTotal(status: OutboxStatus, matchIds?: string[]): number {
  return totalOf(status.reviewByMatch, matchIds);
}
