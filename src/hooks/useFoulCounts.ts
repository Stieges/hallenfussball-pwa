/**
 * useFoulCounts (C3b-2, G11): Foul-Zaehler eines Spiels aus den FOUL-Eintraegen in
 * `LiveMatch.events` -- fuer das ganze Spiel, ohne Halbzeit-Reset und ohne lokales +1.
 * `events` enthaelt kein Zurueckgenommenes (G6/RC13); `retractedEvents` wird nicht gelesen.
 */
import { useMemo } from 'react';

export interface FoulCountEvent {
  type: string;
  payload: { teamId?: string | undefined };
}

export interface FoulCountSource {
  events?: readonly FoulCountEvent[] | undefined;
  homeTeam?: { id: string } | undefined;
  awayTeam?: { id: string } | undefined;
}

export function useFoulCounts(
  match: FoulCountSource | null | undefined,
): { home: number; away: number } {
  const events = match?.events;
  const homeTeamId = match?.homeTeam?.id;
  const awayTeamId = match?.awayTeam?.id;
  return useMemo(() => {
    if (!events || homeTeamId === undefined || awayTeamId === undefined) {
      return { home: 0, away: 0 };
    }
    let home = 0;
    let away = 0;
    for (const event of events) {
      if (event.type !== 'FOUL') {
        continue;
      }
      const teamId = event.payload.teamId;
      if (teamId === homeTeamId) {
        home += 1;
      } else if (teamId === awayTeamId) {
        away += 1;
      }
    }
    return { home, away };
  }, [events, homeTeamId, awayTeamId]);
}
