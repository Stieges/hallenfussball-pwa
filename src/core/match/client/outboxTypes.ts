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
  /**
   * m7 (Nachtrag C3a-2a, optional -- Rueckwaertskompatibilitaet zu bestehenden Test-Doubles):
   * wird nach JEDEM eigenen Store-Schreibzugriff (`resolveBatch`, `rejectAllPending`) aufgerufen,
   * damit `MatchEngine`s gecachte Ansicht dieselbe Kopie zeigt, die der Sender gerade geschrieben
   * hat (statt bis zum naechsten `ensureMatch`/`catchUp` veraltet zu bleiben).
   */
  notifyStoreChange?: (matchId: string) => void;
}

export type OutboxPause = 'notReady' | 'backoff';

export interface OutboxStatus {
  /** Wartende Eintraege je Turnier; Kopien ohne `tournamentId` zaehlen unter ''. */
  pendingByTournament: Record<string, number>;
  pendingByMatch: Record<string, number>;
  rejectedByMatch: Record<string, number>;
  reviewByMatch: Record<string, number>;
  /** B-50 (@HE-056, @FU-017): an die Turnierleitung übergebene Einträge (Grund `RIGHTS_REVOKED`) je Spiel. */
  revokedByMatch: Record<string, number>;
  /** Davon „zum Zuschauer gemacht“ (`change` watch_only) – die Lesesicht bleibt (B-50 Review M2). */
  revokedWatchOnlyByMatch: Record<string, number>;
  /** R3-2a (@FU-018): nach dem Turnierabschluss angekommen, an die Turnierleitung übergeben (Grund `AFTER_FINISH`) je Spiel. */
  afterFinishByMatch: Record<string, number>;
  /** R3-2b (Review #392 M2): dieselben je Turnier – Grundlage fürs Aufräumen nach dem Wiederöffnen. */
  afterFinishByTournament: Record<string, number>;
  pausedMatches: Record<string, OutboxPause>;
  authRequired: boolean;
  clientOutdated: boolean;
  /** `null`, solange der Browser die Persistenz-Anfrage nicht kennt/beantwortet. */
  storagePersisted: boolean | null;
  lastError: string | null;
  /** Fehlerklasse des letzten Fehlers: vorlaeufig (Netz/Zeitlimit/Abbruch) oder dauerhaft. */
  lastFailureKind: 'transient' | 'permanent' | null;
}

export function emptyOutboxStatus(): OutboxStatus {
  return {
    pendingByTournament: {},
    pendingByMatch: {},
    rejectedByMatch: {},
    reviewByMatch: {},
    revokedByMatch: {},
    revokedWatchOnlyByMatch: {},
    afterFinishByMatch: {},
    afterFinishByTournament: {},
    pausedMatches: {},
    authRequired: false,
    clientOutdated: false,
    storagePersisted: null,
    lastError: null,
    lastFailureKind: null,
  };
}
