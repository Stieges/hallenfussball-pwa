/**
 * Schreibt die Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt werden“ über den schmalen Weg
 * `updatePlacementsToPlayOut` (Fixrunde TB-6, Controller-Entscheidung): frisch lesen, nur dieses Feld mit der gelesenen
 * Version schreiben. Entscheidungen einer anderen Person (`standingDecisions`) werden nie aus einem veralteten lokalen Stand
 * zurückgeschrieben. Konflikt → einmal ab dem Lesen wiederholen, dann `STALE` (sichtbar, nie still überschrieben); ohne Netz
 * `OFFLINE`. Rein, ohne React.
 */
import type { ITournamentRepository } from '../repositories/ITournamentRepository';
import { NetworkError, OptimisticLockError, RepositoryError } from '../errors';
import { parsePlacementsToPlayOut } from '../standings/playOutPlaces';

export type PlayOutPlacesError = 'STALE' | 'OFFLINE' | 'NOT_FOUND';

export type PlayOutPlacesResult = { ok: true } | { ok: false; code: PlayOutPlacesError };

const MAX_ATTEMPTS = 2;

export class PlayOutPlacesService {
  constructor(private readonly repository: ITournamentRepository) {}

  async update(tournamentId: string, places: readonly number[]): Promise<PlayOutPlacesResult> {
    if (this.repository.updatePlacementsToPlayOut === undefined) {
      throw new RepositoryError('updatePlacementsToPlayOut', 'Repository kann die Einstellung nicht speichern');
    }
    const clean = parsePlacementsToPlayOut(places.filter((p) => Number.isInteger(p) && p >= 1));
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const tournament = await this.repository.get(tournamentId, { fresh: true });
      if (tournament === null) {
        return { ok: false, code: 'NOT_FOUND' };
      }
      try {
        await this.repository.updatePlacementsToPlayOut(tournamentId, clean, tournament.version ?? 0);
        return { ok: true };
      } catch (error) {
        if (error instanceof NetworkError && error.isOffline) {
          return { ok: false, code: 'OFFLINE' };
        }
        if (!(error instanceof OptimisticLockError)) {
          throw error;
        }
      }
    }
    return { ok: false, code: 'STALE' };
  }
}
