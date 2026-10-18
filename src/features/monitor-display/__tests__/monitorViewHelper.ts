/**
 * Hilfe der Monitor-Tests (A-36c): die Folien lesen die gemeinsame Ansicht (`view`). `withView(t)` liefert Turnier UND
 * Ansicht für `<Slide {...withView(turnier)} />`.
 */
import type { Match, Tournament } from '../../../types/tournament';
import { buildMonitorView } from '../monitorView';
import { toLiveMatch, type MonitorLiveMatch } from '../monitorMatch';

export function withView(tournament: Tournament) {
  return { tournament, view: buildMonitorView(tournament) };
}

/** `toLiveMatch` auf dem Weg der Monitor-Seite: Spiel -> Ansicht des Turniers -> LiveMatch. */
export function liveMatchOf(match: Match, tournament: Tournament): MonitorLiveMatch {
  const known = tournament.matches?.some((m) => m.id === match.id) ?? false;
  const matches = known ? tournament.matches : [...(tournament.matches ?? []), match];
  const view = buildMonitorView({ ...tournament, date: tournament.date ?? '2026-11-28', matches });
  const shown = view.byId.get(match.id);
  if (!shown) {
    throw new Error(`Spiel ${match.id} fehlt in der Ansicht`);
  }
  return toLiveMatch(shown, match, tournament.teams, tournament);
}
