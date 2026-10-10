/**
 * A-06k (@FU-025): Zustand des Realtime-Kanals je Turnier, geteilt zwischen dem Abonnenten
 * (Cockpit `useMatchExecution`, Admin/Monitor `useLiveMatches`) und den Anzeigern (Engine-Ausweichen
 * `useEngineLiveFallback`, Hinweis im `SyncStatusIndicator`). Kein Status gemeldet = unbekannt,
 * und unbekannt loest weder Ausweichen noch Hinweis aus.
 */
import { useSyncExternalStore } from 'react';
import type { RealtimeChannelStatus } from '../core/repositories/SupabaseLiveMatchRepository';

const statusByTournament = new Map<string, RealtimeChannelStatus>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setRealtimeChannelStatus(tournamentId: string, status: RealtimeChannelStatus): void {
  if (statusByTournament.get(tournamentId) === status) {
    return;
  }
  statusByTournament.set(tournamentId, status);
  notify();
}

export function clearRealtimeChannelStatus(tournamentId: string): void {
  if (!statusByTournament.has(tournamentId)) {
    return;
  }
  statusByTournament.delete(tournamentId);
  notify();
}

/** true, sobald ein gemeldeter Zustand NICHT `SUBSCRIBED` ist (also Abfrage-Ausweichen noetig). */
export function isRealtimeInterrupted(status: RealtimeChannelStatus | undefined): boolean {
  return status !== undefined && status !== 'SUBSCRIBED';
}

function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRealtimeChannelStatus(tournamentId: string | undefined): RealtimeChannelStatus | undefined {
  return useSyncExternalStore(subscribeToStore, () => (tournamentId ? statusByTournament.get(tournamentId) : undefined));
}
