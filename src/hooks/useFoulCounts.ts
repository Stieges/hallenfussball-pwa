/**
 * useFoulCounts (C3b-2, G11 + F3a Foul-Regel): Foul-Zaehler eines Spiels aus den
 * Foul-typen-Eintraegen in `LiveMatch.events` -- fuer das ganze Spiel, ohne Halbzeit-Reset
 * und ohne lokales +1. Ein Eintrag ist genau ein Foul („Foul mit Zusatz", PO 30.09.):
 * FOUL, YELLOW_CARD, RED_CARD und TIME_PENALTY zahlen je 1, ohne Zusammenfassen nach Minute.
 * `events` enthaelt kein Zurueckgenommenes (G6/RC13); `retractedEvents` wird nicht gelesen.
 *
 * F3b1 (PO 30.09.): Gelb-Rot kommt weiterhin als Ereignistyp RED_CARD an (payload.cardType
 * 'YELLOW_RED' statt vorher 'RED', seit der Adapter-Fix in viewAdapters.ts). Fuer den Zaehler
 * aendert das nichts -- RED_CARD zaehlt unabhaengig vom Kartentyp 1 Foul, Gelb-Rot also mit.
 */
import { useMemo } from 'react';

const FOUL_TYPES: ReadonlySet<string> = new Set(['FOUL', 'YELLOW_CARD', 'RED_CARD', 'TIME_PENALTY']);

export interface FoulCountEvent {
  type: string;
  payload: {
    teamId?: string | undefined;
    team?: 'home' | 'away' | undefined;
    /** 'YELLOW' | 'YELLOW_RED' | 'RED' (F3b1) -- hier nur dokumentarisch, nicht Teil der Zaehlung. */
    cardType?: string | undefined;
  };
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
      if (!FOUL_TYPES.has(event.type)) {
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
