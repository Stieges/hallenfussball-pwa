/**
 * Abmelde-Warnung (D-C2), gebuendelt fuer ALLE Abmeldewege (Review I3: ein zweiter Weg ohne
 * diese Warnung ist eine Brief-Luecke). Warnt vor dem Abmelden, wenn Eintraege noch auf
 * Uebertragung warten -- geloescht wird nichts, die lokalen Kopien bleiben erhalten. Gast oder
 * 0 wartende Eintraege melden direkt ab; ein Zaehlfehler (synchron ODER asynchron, Review m1)
 * darf das Abmelden nie blockieren.
 */
import { useCallback, useState } from 'react';
import { LocalMatchStore } from '../../../core/match/client/LocalMatchStore';
import { useRepositories } from '../../../core/contexts/RepositoryContext';
import { countWaitingEntries, type WaitingEntriesSource } from './countWaitingEntries';

export interface UseGuardedLogoutOptions {
  isGuest: boolean;
  accountId: string;
  logout: () => unknown;
  /** Kleine injizierbare Fabrik der lokalen Spielkopie (Standard: neue LocalMatchStore-Instanz). */
  createMatchStore?: () => WaitingEntriesSource;
  /** Nach dem Abmelden aufgerufen (z.B. Navigation zurueck). */
  onLoggedOut?: () => void;
}

export interface UseGuardedLogoutResult {
  /** Anzahl wartender Eintraege, solange die Warnung offen ist; sonst `null`. */
  waitingCount: number | null;
  handleLogout: () => void;
  cancel: () => void;
  confirm: () => void;
}

const defaultMatchStoreFactory = (): WaitingEntriesSource => new LocalMatchStore();

/** Weg B (A-07c, @FU-006): Repo mit Ausgangs-Queue des Kontos (`OfflineRepository.mutationQueue`). */
interface QueueHolder {
  readonly mutationQueue: { getPendingCount(): number };
}

function isQueueHolder(repo: unknown): repo is QueueHolder {
  return typeof repo === 'object' && repo !== null && 'mutationQueue' in repo && repo.mutationQueue !== undefined && repo.mutationQueue !== null;
}

/** Wartende Eintraege der Konto-Queue (Weg B). Ein Lesefehler zaehlt 0 -- nie blockierend. */
function countQueuedEntries(repo: unknown): number {
  try {
    return isQueueHolder(repo) ? repo.mutationQueue.getPendingCount() : 0;
  } catch {
    return 0;
  }
}

export function useGuardedLogout({
  isGuest,
  accountId,
  logout,
  createMatchStore = defaultMatchStoreFactory,
  onLoggedOut,
}: UseGuardedLogoutOptions): UseGuardedLogoutResult {
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const { tournamentRepository } = useRepositories();

  const doLogout = useCallback(() => {
    void logout();
    onLoggedOut?.();
  }, [logout, onLoggedOut]);

  const handleLogout = useCallback(() => {
    if (isGuest) {
      doLogout();
      return;
    }
    // Fixrunde 1 (Review m1): die Fabrik darf synchron werfen -- ausserhalb dieses
    // Promise-Callbacks wuerde das als unhandled rejection enden und logout() nie erreichen.
    // A-07c (@FU-006): Summe aus Weg A (lokale Kopie) und Weg B (Konto-Queue); jeder Ausgang
    // zaehlt fuer sich, ein Fehler in einem Ausgang nimmt nur dessen Anteil auf 0.
    void Promise.resolve()
      .then(() => countWaitingEntries(createMatchStore(), accountId))
      .catch(() => 0)
      .then((storeWaiting) => {
        const waiting = storeWaiting + countQueuedEntries(tournamentRepository);
        if (waiting > 0) {
          setWaitingCount(waiting);
          return;
        }
        doLogout();
      });
  }, [isGuest, accountId, createMatchStore, doLogout, tournamentRepository]);

  const cancel = useCallback(() => setWaitingCount(null), []);
  const confirm = useCallback(() => {
    setWaitingCount(null);
    doLogout();
  }, [doLogout]);

  return { waitingCount, handleLogout, cancel, confirm };
}
