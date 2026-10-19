/**
 * useCopyTournament – „Turnier kopieren“ für Dashboard und Admin Center (Paket KP, @W5-024 bis @W5-028).
 *
 * Dünner Controller: die Kopierlogik liegt in `buildCopiedTournament` (core), dieser Hook lädt das volle Turnier,
 * liefert frische UUIDs und die Zeit und speichert die Kopie. Beide Einstiege rufen genau diesen Weg.
 *
 * Die Liste der Startseite enthält angemeldet nur Kopfdaten (`teams: []`, `matches: []`, siehe
 * `SupabaseRepository.listForCurrentUser`). Deshalb wird das Original vor dem Kopieren über `repository.get` voll
 * geladen. Scheitert das, wird nichts angelegt (C-COPY-DASH, @W5-025).
 */
import { useCallback } from 'react';
import { buildCopiedTournament } from '../core/models/tournamentCopy';
import { generateTournamentId, generateUniqueId } from '../utils/idGenerator';
import { useRepository } from './useRepository';
import type { Tournament } from '../types/tournament';

export function useCopyTournament(saveTournament: (tournament: Tournament) => Promise<void>) {
  const repository = useRepository();
  return useCallback(
    async (original: Tournament, title: string, startDate?: string): Promise<Tournament> => {
      const full = await repository.get(original.id);
      if (!full) { throw new Error(`Turnier ${original.id} konnte vor dem Kopieren nicht geladen werden`); }
      // Ein veröffentlichtes Turnier ohne Spielplan ist ein Listen-Eintrag oder kaputt: lieber nichts anlegen als eine leere Kopie
      if (full.status === 'published' && full.matches.length === 0) {
        throw new Error(`Turnier ${original.id} hat nach dem Laden keinen Spielplan`);
      }
      const copy = buildCopiedTournament(full, {
        newId: generateTournamentId(),
        title,
        now: new Date().toISOString(),
        makeId: generateUniqueId,
        startDate,
      });
      await saveTournament(copy);
      return copy;
    },
    [repository, saveTournament],
  );
}
