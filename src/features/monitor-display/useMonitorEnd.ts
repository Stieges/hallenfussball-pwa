/**
 * Der Monitor nach dem Abschluss als ein Zustand (R3-7; @LZ-076, @ZM-121, @ZM-180): fragt den gespeicherten Endstand über den Link des
 * Monitors (nur in der Cloud, nie im Kindermodus; abgeschlossen im Takt, sonst beim Öffnen – ein über den Betreiber wieder geöffnetes
 * Turnier behält ihn, @ZM-121 Z. 2) und entscheidet daraus `MonitorEnd`. Solange der Endstand nach dem Abschluss fehlt, bleibt das
 * Live-Programm weg (`pending`).
 */
import type { TournamentView } from '../../core/view';
import type { Tournament } from '../../types/tournament';
import type { DisplayOrigin } from './monitorDataSource';
import { monitorEnd, NO_END, type MonitorEnd } from './monitorEnd';
import { useMonitorFinalStandings, type FinalStandingsAsk } from './useMonitorFinalStandings';

function askFor(tournament: Tournament | null, view: TournamentView | null, origin: DisplayOrigin | null): FinalStandingsAsk {
  const kinder = view !== null && !view.rules.results;
  if (tournament === null || origin !== 'cloud' || kinder) { return 'off'; }
  return tournament.lifecycleStatus === 'finished' ? 'finished' : 'open';
}

export function useMonitorEnd(
  tournamentId: string, monitorId: string, tournament: Tournament | null, view: TournamentView | null, origin: DisplayOrigin | null,
): MonitorEnd {
  const finalStandings = useMonitorFinalStandings(tournamentId, monitorId, askFor(tournament, view, origin));
  return tournament === null || view === null ? NO_END : monitorEnd(tournament, view, finalStandings, origin === 'cloud');
}
