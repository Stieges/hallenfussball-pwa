/**
 * Im Cockpit gebuchte Tore gegen einen eingetragenen Stand (@FU-139, Befund C-ERGEBNISEINTRAG-TORE-WIDERSPRUCH).
 * Die Torschützenliste zählt nur gebuchte Tore (GOAL/OWN_GOAL, nicht zurückgenommen). Trägt die Turnierleitung im Spielplan
 * einen anderen Stand ein, bleiben diese Tore im Protokoll stehen; die App warnt vorher. Gleiche Ableitung wie Cockpit und
 * Torschützenliste: `computedScoreFor` (Tore je Seite inkl. Eigentore für die Gegenseite, ohne zurückgenommene Tore).
 * Rein, kein React.
 */
import { computedScoreFor, type MatchContext, type MatchState } from './types';

/** Der aus gebuchten Toren berechnete Stand („1:0“, Heim:Gast) -- nur wenn mindestens ein Tor gebucht ist und der Eintrag davon abweicht, sonst `null`. */
export function bookedScoreMismatch(
  state: MatchState,
  ctx: Pick<MatchContext, 'teamAId' | 'teamBId'>,
  entered: { home: number; away: number },
): string | null {
  const home = computedScoreFor(state, ctx.teamAId);
  const away = computedScoreFor(state, ctx.teamBId);
  if (home + away === 0) {
    return null; // keine Tore gebucht: nichts, was dem Eintrag widerspricht
  }
  return home === entered.home && away === entered.away ? null : `${home}:${away}`;
}
