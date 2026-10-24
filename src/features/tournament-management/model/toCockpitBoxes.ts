/**
 * toCockpitBoxes – die Ergebniskästen des Cockpits (@SL-176): dieselbe Rechnung wie die Anzeige am Hallenmonitor
 * (`matchBoxes`: getragene Farbe `wornColors`, Leibchen als Weste, Einstellung „Teamfarben in den Ergebniskästen“, Ausweichregel
 * @ZM-159), für das Spiel, das das Cockpit zeigt. Rein; ohne das Spiel im Turnier (noch nicht geladen) `undefined`.
 */
import { matchBoxes } from '../../../core/view';
import { parseSpectatorDisplay } from '../../../core/models/spectatorDisplay';
import type { CockpitKasten } from '../../../components/live-cockpit/typesFarben';
import type { Tournament } from '../../../types/tournament';

export function toCockpitBoxes(tournament: Pick<Tournament, 'matches' | 'teams' | 'spectatorDisplay'>, matchId: string | undefined): CockpitKasten | undefined {
  if (matchId === undefined) { return undefined; }
  const match = tournament.matches.find((m) => m.id === matchId);
  if (!match) { return undefined; }
  return matchBoxes(match, tournament.teams, parseSpectatorDisplay(tournament.spectatorDisplay));
}
