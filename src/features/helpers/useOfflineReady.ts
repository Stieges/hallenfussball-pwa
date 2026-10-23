/**
 * „Offline bereit“ (A-17c, @HE-028): Nach der Zulassung wird das Turnier in die lokale Kopie des Geräts geladen. Bereit heißt:
 * die Kopie liegt vor und hat einen Spielplan. Erst dann wird der Merker `offlineReadyAt` im Zugangs-Index gesetzt und die
 * Anzeige „Offline bereit“ gezeigt. Ein leeres Turnier, ein Fehler oder „nicht gefunden“ ist nicht bereit – keine falsche
 * Zusage für die Halle ohne Netz. Der echte Nachweis (Flugmodus am Gerät) gehört in den Gerätetest F2.
 */
import { useEffect, useState } from 'react';
import type { ITournamentRepository } from '../../core/repositories/ITournamentRepository';
import { setOfflineReady } from './helperAccessStore';

/** Lädt das Turnier lokal-zuerst (legt beim ersten Mal die Kopie an) und sagt, ob ein Spielplan da ist. */
export async function loadOfflineCopy(repository: Pick<ITournamentRepository, 'get'>, tournamentId: string): Promise<boolean> {
  try {
    const tournament = await repository.get(tournamentId);
    return tournament !== null && tournament.matches.length > 0;
  } catch {
    return false;
  }
}

export interface UseOfflineReadyOptions {
  enabled: boolean;
  /** Nur für Tests: statt des echten Ladens. */
  load?: (tournamentId: string) => Promise<boolean>;
}

export function useOfflineReady(
  repository: Pick<ITournamentRepository, 'get'>,
  tournamentId: string,
  deviceUserId: string,
  { enabled, load }: UseOfflineReadyOptions,
): { ready: boolean } {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;
    void (load ? load(tournamentId) : loadOfflineCopy(repository, tournamentId)).then((isReady) => {
      if (cancelled || !isReady) {
        return;
      }
      setOfflineReady(deviceUserId, tournamentId);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, repository, tournamentId, deviceUserId, load]);
  return { ready };
}
