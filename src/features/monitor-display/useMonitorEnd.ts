/**
 * Der Monitor nach dem Abschluss als ein Zustand (R3-7; @LZ-076, @ZM-121, @ZM-180): fragt den gespeicherten Endstand (nur bei „abgeschlossen“ in
 * der Cloud, nie im Kindermodus) und entscheidet daraus `MonitorEnd`. Solange der Endstand fehlt, bleibt das Live-Programm weg (`pending`).
 */
import type { TournamentView } from '../../core/view';
import type { Tournament } from '../../types/tournament';
import type { DisplayOrigin } from './monitorDataSource';
import { monitorEnd, NO_END, type MonitorEnd } from './monitorEnd';
import { useMonitorFinalStandings } from './useMonitorFinalStandings';

export function useMonitorEnd(tournamentId: string, tournament: Tournament | null, view: TournamentView | null, origin: DisplayOrigin | null): MonitorEnd {
  const kinder = view !== null && !view.rules.results;
  const cloud = origin === 'cloud';
  const abgeschlossen = tournament?.lifecycleStatus === 'finished' && cloud && !kinder;
  const finalStandings = useMonitorFinalStandings(tournamentId, abgeschlossen);
  return tournament === null || view === null ? NO_END : monitorEnd(tournament, view, finalStandings, cloud);
}
