/**
 * toCockpitBoxes – die Ergebniskästen des Cockpits (@SL-176): dieselbe Rechnung wie die Anzeige am Hallenmonitor
 * (`matchBoxes`: getragene Farbe `wornColors`, Leibchen als Weste, Einstellung „Teamfarben in den Ergebniskästen“, Ausweichregel
 * @ZM-159), für das Spiel, das das Cockpit zeigt. Rein; ohne das Spiel im Turnier (noch nicht geladen) `undefined`.
 */
import { matchBoxes } from '../../../core/view';
import { parseSpectatorDisplay } from '../../../core/models/spectatorDisplay';
import type { CockpitKasten } from '../../../components/live-cockpit/typesFarben';
import type { Tournament } from '../../../types/tournament';
import { serverRulesFor } from '../../../hooks/engineServerRules';

export function toCockpitBoxes(tournament: Pick<Tournament, 'matches' | 'teams' | 'spectatorDisplay'>, matchId: string | undefined): CockpitKasten | undefined {
  if (matchId === undefined) { return undefined; }
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match) { return undefined; }
  return matchBoxes(match, tournament.teams, parseSpectatorDisplay(tournament.spectatorDisplay));
}

/** @SL-197: Spielzeit aus den Turnierregeln des Spiels (dieselbe Regel wie beim Anpfiff, `serverRulesFor`). */
export function toCockpitSpielzeit(tournament: Tournament, matchId: string | undefined): { abschnitte: number; abschnittSekunden: number } | null {
  const match = matchId === undefined ? undefined : tournament.matches.find((m) => m.id === matchId);
  if (!match) { return null; }
  const regeln = serverRulesFor(tournament, match);
  return { abschnitte: regeln.sections, abschnittSekunden: regeln.sectionSeconds };
}
