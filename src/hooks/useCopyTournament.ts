/**
 * useCopyTournament – „Turnier kopieren“ für Dashboard und Admin Center (Paket KP, @W5-024 bis @W5-027).
 *
 * Dünner Controller: die Kopierlogik liegt in `buildCopiedTournament` (core), dieser Hook liefert nur
 * frische UUIDs und die Zeit und speichert die Kopie. Beide Einstiege rufen genau diesen Weg.
 */
import { useCallback } from 'react';
import { buildCopiedTournament } from '../core/models/tournamentCopy';
import { generateTournamentId, generateUniqueId } from '../utils/idGenerator';
import type { Tournament } from '../types/tournament';

export function useCopyTournament(saveTournament: (tournament: Tournament) => Promise<void>) {
  return useCallback(
    async (original: Tournament, title: string): Promise<Tournament> => {
      const copy = buildCopiedTournament(original, {
        newId: generateTournamentId(),
        title,
        now: new Date().toISOString(),
        makeId: generateUniqueId,
      });
      await saveTournament(copy);
      return copy;
    },
    [saveTournament],
  );
}
