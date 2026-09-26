/**
 * Schnittstellen des Ausgangs-Senders (C2a, PC8): injizierte Abhaengigkeiten
 * und die Status-API, die spaeter die `SyncStatusBar` befuellt (C2b).
 */
import type { AppendableEvent, AppendOptions, AppendResult } from '../../repositories/appendMatchEventsRpc';
import type { LocalMatchStore } from './LocalMatchStore';

export type TimeoutHandle = ReturnType<typeof setTimeout>;

/** Injizierte Timer (kein globaler Aufruf) -- Rueckruf darf asynchron sein. */
export interface OutboxTimers {
  setTimeout(callback: () => void | Promise<void>, ms: number): TimeoutHandle;
  clearTimeout(handle: TimeoutHandle): void;
}

/** Schreibweg des Servers, normalerweise `SupabaseLiveMatchRepository.appendMatchEvents`. */
export interface OutboxApi {
  appendMatchEvents(
    matchId: string,
    events: readonly AppendableEvent[],
    options: AppendOptions,
  ): Promise<AppendResult>;
}

export interface OutboxSenderDeps {
  store: LocalMatchStore;
  api: OutboxApi;
  clientFormat: number;
  deviceId?: string;
  timers: OutboxTimers;
  now: () => number;
  requestCatchUp: (matchId: string) => void;
}

export type OutboxPause = 'notReady' | 'backoff';

export interface OutboxStatus {
  /** Wartende Eintraege je Turnier; Kopien ohne `tournamentId` zaehlen unter ''. */
  pendingByTournament: Record<string, number>;
  pendingByMatch: Record<string, number>;
  rejectedByMatch: Record<string, number>;
  reviewByMatch: Record<string, number>;
  pausedMatches: Record<string, OutboxPause>;
  authRequired: boolean;
  clientOutdated: boolean;
  /** `null`, solange der Browser die Persistenz-Anfrage nicht kennt/beantwortet. */
  storagePersisted: boolean | null;
  lastError: string | null;
}

export function emptyOutboxStatus(): OutboxStatus {
  return {
    pendingByTournament: {},
    pendingByMatch: {},
    rejectedByMatch: {},
    reviewByMatch: {},
    pausedMatches: {},
    authRequired: false,
    clientOutdated: false,
    storagePersisted: null,
    lastError: null,
  };
}
