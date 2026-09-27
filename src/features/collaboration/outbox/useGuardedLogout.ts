/**
 * Abmelde-Warnung (D-C2), gebuendelt fuer ALLE Abmeldewege (Review I3: ein zweiter Weg ohne
 * diese Warnung ist eine Brief-Luecke). Warnt vor dem Abmelden, wenn Eintraege noch auf
 * Uebertragung warten -- geloescht wird nichts, die lokalen Kopien bleiben erhalten. Gast oder
 * 0 wartende Eintraege melden direkt ab; ein Zaehlfehler (synchron ODER asynchron, Review m1)
 * darf das Abmelden nie blockieren.
 */
import { useCallback, useState } from 'react';
import { LocalMatchStore } from '../../../core/match/client/LocalMatchStore';
import { countWaitingEntries, type WaitingEntriesSource } from './countWaitingEntries';

export interface UseGuardedLogoutOptions {
  isGuest: boolean;
  accountId: string;
  logout: () => void | Promise<void>;
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

export function useGuardedLogout({
  isGuest,
  accountId,
  logout,
  createMatchStore = defaultMatchStoreFactory,
  onLoggedOut,
}: UseGuardedLogoutOptions): UseGuardedLogoutResult {
  const [waitingCount, setWaitingCount] = useState<number | null>(null);

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
    void Promise.resolve()
      .then(() => countWaitingEntries(createMatchStore(), accountId))
      .catch(() => 0)
      .then((waiting) => {
        if (waiting > 0) {
          setWaitingCount(waiting);
          return;
        }
        doLogout();
      });
  }, [isGuest, accountId, createMatchStore, doLogout]);

  const cancel = useCallback(() => setWaitingCount(null), []);
  const confirm = useCallback(() => {
    setWaitingCount(null);
    doLogout();
  }, [doLogout]);

  return { waitingCount, handleLogout, cancel, confirm };
}
