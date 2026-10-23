/**
 * Restzeit der laufenden Spiele für Karte, Kopf und Verwaltung (Aufgabe 5.1a Spielanzeige, @ZM-162): ein Sekundentakt,
 * solange ein Spiel der Ansicht läuft; die Rechnung steht in `spectatorClockForMatch` (core/view). `elapsedOf` liefert die
 * gespielten Sekunden (Engine der Verwaltung bzw. Zwischenspeicher-Felder, `useElapsedSeconds`). Der Takt läuft in Serverzeit
 * (`NowSourceContext`, B-15): der Feinstatus der Ansicht ist in Serverzeit verankert.
 */
import { useCallback } from 'react';
import { spectatorClockForMatch, type SpectatorClock, type TournamentView } from '../../core/view';
import { useTickingNow } from './useTickingNow';

export function useSpectatorClocks(
  view: TournamentView | undefined,
  elapsedOf: (matchId: string) => number | undefined,
): (matchId: string) => SpectatorClock | null {
  const nowMs = useTickingNow((view?.current.live.length ?? 0) > 0, true);
  // nowMs und elapsedOf gehören in die Abhängigkeiten: jeder Takt liefert neue Uhren
  return useCallback((matchId: string): SpectatorClock | null => {
    const match = view?.byId.get(matchId);
    return match === undefined ? null : spectatorClockForMatch(match, elapsedOf(matchId), nowMs);
  }, [view, elapsedOf, nowMs]);
}
