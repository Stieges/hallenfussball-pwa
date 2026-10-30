/**
 * Der Monitor nach dem Abschluss als ein Zustand (R3-7; @LZ-076, @ZM-121, @ZM-180): fragt den gespeicherten Endstand über den Link des
 * Monitors (nur in der Cloud, nie im Kindermodus; abgeschlossen im Takt, sonst beim Öffnen – ein über den Betreiber wieder geöffnetes
 * Turnier behält ihn, @ZM-121 Z. 2) und entscheidet daraus `MonitorEnd`. Solange der Endstand nach dem Abschluss fehlt, bleibt das
 * Live-Programm weg (`pending`).
 *
 * Kindermodus und Wiederöffnen (@ZM-121 Z. 2 mit Z. 4, Review #415): Hat dieser Monitor das Turnier im Kindermodus abgeschlossen gesehen
 * („Turnier beendet – danke fürs Mitspielen“), bleibt das nach dem Wiederöffnen stehen, bis neu abgeschlossen wird – solange der
 * Kindermodus an ist. Der Server liefert im Kindermodus nie einen Endstand und sagt nicht, dass wieder geöffnet wurde; deshalb gilt das
 * nur, solange die Seite offen ist (nach einem Neuladen im wieder geöffneten Turnier: normales Programm, Lücke im Report).
 */
import { useEffect, useState } from 'react';
import type { TournamentView } from '../../core/view';
import type { Tournament } from '../../types/tournament';
import type { DisplayOrigin } from './monitorDataSource';
import { KIDS_END, monitorEnd, NO_END, type MonitorEnd } from './monitorEnd';
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
  const end = tournament === null || view === null ? NO_END : monitorEnd(tournament, view, finalStandings, origin === 'cloud');
  // Turnier, für das dieser Monitor „Turnier beendet“ im Kindermodus gezeigt hat
  const [kidsEndedFor, setKidsEndedFor] = useState<string | null>(null);
  useEffect(() => {
    if (end.kind === 'kids') { setKidsEndedFor(tournamentId); }
  }, [end.kind, tournamentId]);
  const kinder = view !== null && !view.rules.results;
  const wiederOffen = tournament !== null && tournament.lifecycleStatus !== 'finished' && tournament.lifecycleStatus !== 'cancelled';
  if (end.kind === 'none' && kinder && wiederOffen && kidsEndedFor === tournamentId) { return KIDS_END; }
  return end;
}
