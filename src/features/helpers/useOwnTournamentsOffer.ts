/**
 * Punkt „Meine Turniere auf diesem Handy“ im Menü „Mehr“ des Felds (A-17c-2, @HE-110): Wer als Helfer am Feld arbeitet und
 * eigene Turniere auf dem Gerät hat, kommt von dort zur Startseite. Sichtbar nur, wenn (1) dieses Gerät für das Turnier einen
 * Helfer-Zugang hat und (2) mindestens ein eigenes Turnier (ohne Helfer-Turniere, ohne Papierkorb) auf dem Gerät liegt.
 */
import { useContext, useEffect, useState } from 'react';
import { useRepository } from '../../hooks/useRepository';
import { AuthContext } from '../auth/context/authContextInstance';
import { findHelperAccessEntry, peekHelperAccessIndex } from './helperAccessStore';

/** Reine Entscheidung: gibt es eigene Turniere, die nicht zu einem Helfer-Zugang gehören? */
export function hasOwnTournamentsBesidesHelper(
  tournaments: ReadonlyArray<{ id: string; deletedAt?: string }>,
  helperTournamentIds: ReadonlySet<string>,
): boolean {
  return tournaments.some((tournament) => !tournament.deletedAt && !helperTournamentIds.has(tournament.id));
}

/** Hat dieses Gerät (anonyme Gerätesitzung) einen Helfer-Zugang zum Turnier? Ohne Zugang braucht der Punkt nichts zu laden. */
export function useHelperAccessHere(tournamentId: string): string | null {
  const user = useContext(AuthContext)?.user ?? null;
  const deviceUserId = user?.isAnonymous === true ? user.id : null;
  return deviceUserId !== null && findHelperAccessEntry(deviceUserId, tournamentId) !== null ? deviceUserId : null;
}

/** Nur unter einem Repository-Anbieter und nur mit Helfer-Zugang aufrufen (siehe `OwnTournamentsMoreItem`). */
export function useOwnTournamentsOffer(): boolean {
  const repository = useRepository();
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    repository.listForCurrentUser()
      .then((list) => {
        const helperIds = new Set((peekHelperAccessIndex()?.entries ?? []).map((entry) => entry.tournamentId));
        if (!cancelled) { setOffer(hasOwnTournamentsBesidesHelper(list, helperIds)); }
      })
      .catch(() => { if (!cancelled) { setOffer(false); } });
    return () => { cancelled = true; };
  }, [repository]);

  return offer;
}
