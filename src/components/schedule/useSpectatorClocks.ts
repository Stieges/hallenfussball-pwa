/**
 * Restzeit der laufenden Spiele für Karte, Kopf und Verwaltung (Aufgabe 5.1a Spielanzeige, @ZM-162): ein Sekundentakt,
 * solange ein Spiel der Ansicht läuft; die Rechnung steht in `spectatorClockForMatch` (core/view). `elapsedOf` liefert die
 * gespielten Sekunden (Engine der Verwaltung bzw. Zwischenspeicher-Felder, `useElapsedSeconds`). Der Takt läuft in Serverzeit
 * (`NowSourceContext`, B-15): der Feinstatus der Ansicht ist in Serverzeit verankert.
 *
 * Mit `matches` (Ereignisse und `live_state` der Spiele, etwa aus der öffentlichen Antwort) trägt die Uhr auch die laufenden
 * Zeitstrafen beim Team (@ZM-184) – nie, wenn die Ansicht keine Ergebnisse zeigt (Kindermodus, @ZM-183).
 */
import { useCallback, useMemo } from 'react';
import { hatZeitstrafen, laufendeZeitstrafen, spectatorClockForMatch, type SpectatorClock, type TournamentView } from '../../core/view';
import { slotTeamId } from '../../core/models/matchSlot';
import type { Match } from '../../types/tournament';
import { useTickingNow } from './useTickingNow';

export function useSpectatorClocks(
  view: TournamentView | undefined,
  elapsedOf: (matchId: string) => number | undefined,
  matches?: readonly Match[],
): (matchId: string) => SpectatorClock | null {
  const nowMs = useTickingNow((view?.current.live.length ?? 0) > 0, true);
  const byId = useMemo(() => new Map((matches ?? []).map((m) => [m.id, m] as const)), [matches]);
  // nowMs und elapsedOf gehören in die Abhängigkeiten: jeder Takt liefert neue Uhren
  return useCallback((matchId: string): SpectatorClock | null => {
    const match = view?.byId.get(matchId);
    const clock = match === undefined ? null : spectatorClockForMatch(match, elapsedOf(matchId), nowMs);
    const raw = byId.get(matchId);
    if (clock === null || raw === undefined || view?.rules.results !== true) {
      return clock;
    }
    const zeitstrafen = laufendeZeitstrafen({
      events: raw.events, liveState: raw.liveState, homeId: slotTeamId(raw.slotA), awayId: slotTeamId(raw.slotB), nowMs,
    });
    return hatZeitstrafen(zeitstrafen) ? { ...clock, zeitstrafen } : clock;
  }, [view, elapsedOf, nowMs, byId]);
}
