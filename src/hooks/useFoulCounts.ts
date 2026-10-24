/**
 * useFoulCounts (C3b-2, G11 + F3a Foul-Regel): Foul-Zaehler eines Spiels aus den
 * Foul-typen-Eintraegen in `LiveMatch.events` -- ohne lokales +1. Der Hook zaehlt das ganze Spiel (Gesamtzahl in der
 * Zusammenfassung nach dem Abpfiff, @SL-099); `zaehleFouls` mit `abschnitt` zaehlt je Halbzeit gegen die Grenze (@SL-034, @SL-036,
 * @SL-099, @SL-100): mit jedem Abschnitt neu, die Verlaengerung zaehlt zum letzten regulaeren Abschnitt weiter. Ein Eintrag ist genau ein Foul („Foul mit Zusatz", PO 30.09.):
 * FOUL, YELLOW_CARD, RED_CARD und TIME_PENALTY zahlen je 1, ohne Zusammenfassen nach Minute.
 * `events` enthaelt kein Zurueckgenommenes (G6/RC13); `retractedEvents` wird nicht gelesen.
 *
 * F3b1 (PO 30.09.): Gelb-Rot kommt weiterhin als Ereignistyp RED_CARD an (payload.cardType
 * 'YELLOW_RED' statt vorher 'RED', seit der Adapter-Fix in viewAdapters.ts). Fuer den Zaehler
 * aendert das nichts -- RED_CARD zaehlt unabhaengig vom Kartentyp 1 Foul, Gelb-Rot also mit.
 *
 * Fixrunde (Ruling PC30): die Karten-Erkennung laeuft ueber `cardKindOf` (gemeinsame Hilfsfunktion,
 * `src/utils/cardKind.ts`) statt einer eigenen `payload.cardType`-Abfrage -- hier nur zur
 * Klassifizierung "ist das ueberhaupt eine Karte", die Zaehlung selbst bleibt kartentyp-unabhaengig.
 */
import { useMemo } from 'react';
import { cardKindOf } from '../utils/cardKind';

const NON_CARD_FOUL_TYPES: ReadonlySet<string> = new Set(['FOUL', 'TIME_PENALTY']);

export interface FoulCountEvent {
  type: string;
  payload: {
    teamId?: string | undefined;
    team?: 'home' | 'away' | undefined;
    /** 'YELLOW' | 'YELLOW_RED' | 'RED' (F3b1) -- hier nur dokumentarisch, nicht Teil der Zaehlung. */
    cardType?: string | undefined;
  };
  /** Abschnitt des Eintrags (Engine-Spiele); ohne Angabe zaehlt der Eintrag in jedem Abschnitt mit (kein Abschnittsbezug bekannt). */
  section?: number | undefined;
}

export interface FoulCountSource {
  events?: readonly FoulCountEvent[] | undefined;
  homeTeam?: { id: string } | undefined;
  awayTeam?: { id: string } | undefined;
}

/** Aktueller und letzter regulaerer Abschnitt (`PhaseView.section`/`sections`); in der Verlaengerung ist `aktuell` = `gesamt + 1`. */
export interface FoulAbschnitt { aktuell: number; gesamt: number }

/** Verlaengerung (und Golden Goal) zaehlen zum letzten regulaeren Abschnitt (@SL-101: „eine Verlaengerung zaehlt zum letzten Abschnitt“). */
const wirksamerAbschnitt = (abschnitt: number, gesamt: number): number => Math.min(abschnitt, gesamt);

/**
 * Zaehlt die Fouls je Seite: FOUL, Karten und Zeitstrafe zaehlen je 1. Mit `abschnitt` nur die Eintraege des aktuellen Abschnitts
 * (Eintraege ohne Abschnittsangabe zaehlen mit); ohne `abschnitt` das ganze Spiel.
 */
export function zaehleFouls(match: FoulCountSource | null | undefined, abschnitt?: FoulAbschnitt | null): { home: number; away: number } {
  const events = match?.events;
  const homeTeamId = match?.homeTeam?.id;
  const awayTeamId = match?.awayTeam?.id;
  if (!events || homeTeamId === undefined || awayTeamId === undefined) {
    return { home: 0, away: 0 };
  }
  const ziel = abschnitt ? wirksamerAbschnitt(abschnitt.aktuell, abschnitt.gesamt) : null;
  let home = 0;
  let away = 0;
  for (const event of events) {
    const isCard = cardKindOf(event) !== null;
    if (!isCard && !NON_CARD_FOUL_TYPES.has(event.type)) {
      continue;
    }
    if (ziel !== null && abschnitt && event.section !== undefined && wirksamerAbschnitt(event.section, abschnitt.gesamt) !== ziel) {
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
}

export function useFoulCounts(
  match: FoulCountSource | null | undefined,
): { home: number; away: number } {
  const events = match?.events;
  const homeTeamId = match?.homeTeam?.id;
  const awayTeamId = match?.awayTeam?.id;
  return useMemo(
    () => zaehleFouls({ events, homeTeam: homeTeamId === undefined ? undefined : { id: homeTeamId }, awayTeam: awayTeamId === undefined ? undefined : { id: awayTeamId } }),
    [events, homeTeamId, awayTeamId],
  );
}
