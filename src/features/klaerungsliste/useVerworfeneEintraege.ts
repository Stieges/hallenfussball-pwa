/**
 * B-50 Nachblick N1 (@FU-095, B6.3): verworfene Klärungseinträge des laufenden Spiels für das Spielprotokoll im Cockpit.
 * Nur die Turnierleitung bekommt sie (`istLeitung` = leadMatches aus dem Cockpit, dazu Cloud und Netz); alle anderen sehen nichts.
 */
import { useMemo } from 'react';
import { discardedProtocolEntries, type DiscardedEntry } from '../../core/match/review/discardedProtocol';
import { useMatchReviewsFor } from './useMatchReviews';

export interface VerlaufSpiel {
  id: string;
  homeTeam: { id: string };
  awayTeam: { id: string };
  homeScore: number;
  awayScore: number;
}

const KEINE: DiscardedEntry[] = [];

export function useVerworfeneEintraege(tournamentId: string, match: VerlaufSpiel | null | undefined, istLeitung: boolean): DiscardedEntry[] {
  const { reviews } = useMatchReviewsFor(tournamentId, istLeitung);
  const id = match?.id;
  const teamA = match?.homeTeam.id;
  const teamB = match?.awayTeam.id;
  const home = match?.homeScore ?? 0;
  const away = match?.awayScore ?? 0;
  return useMemo(() => {
    if (id === undefined || teamA === undefined || teamB === undefined || reviews.length === 0) {
      return KEINE;
    }
    const entries = discardedProtocolEntries(reviews, { matchId: id, teamAId: teamA, teamBId: teamB }, { home, away });
    return entries.length === 0 ? KEINE : entries;
  }, [reviews, id, teamA, teamB, home, away]);
}
