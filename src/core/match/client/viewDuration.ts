/**
 * Spieldauer der Cockpit-Ansicht und Auto-Ende (C-VERLAENGERUNG-ENDET-SOFORT; @SL-145, @SL-081,
 * @SL-082, @TM-052, @SL-010).
 *
 * Die Engine-Uhr läuft über alle Abschnitte weiter (B-U1, `handlers/sections.ts`): Beim Anpfiff der
 * Verlängerung steht sie schon auf der Regelspielzeit. Die Dauer der Ansicht umfasst in der
 * Verlängerung deshalb Regelzeit + Verlängerung – sonst wäre die Spielzeit beim Anpfiff schon
 * abgelaufen (Countdown 00:00, Auto-Ende sofort).
 */
import type { MatchState } from '../types';
import type { LiveMatch } from '../../models/LiveMatch';

export function viewDurationSeconds(state: MatchState): number {
  const rules = state.rules;
  if (!rules) {
    return 0;
  }
  const regular = rules.sections * rules.sectionSeconds;
  return state.phase === 'overtime' ? regular + rules.overtimeSeconds : regular;
}

/**
 * Darf das Cockpit das Spiel jetzt automatisch beenden? Nur bei laufendem Spiel mit wirklich
 * abgelaufener Spielzeit – im Golden Goal nie, das endet nur mit dem Tor (@SL-082).
 */
export function isAutoFinishDue(
  match: Pick<LiveMatch, 'status' | 'playPhase'> | null | undefined,
  isOvertime: boolean,
): boolean {
  return match?.status === 'RUNNING' && isOvertime && match.playPhase !== 'goldenGoal';
}
