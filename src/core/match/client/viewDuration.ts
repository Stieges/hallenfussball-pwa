/**
 * Spieldauer der Cockpit-Ansicht und Auto-Ende (C-VERLAENGERUNG-ENDET-SOFORT; @SL-145, @SL-081,
 * @SL-082, @DR-019, @TM-052, @SL-010).
 *
 * Die Engine-Uhr läuft über alle Abschnitte weiter (B-U1, `handlers/sections.ts`): Beim Anpfiff der
 * Verlängerung steht sie schon auf der Regelspielzeit. Die Dauer der Ansicht umfasst in der
 * Verlängerung deshalb Uhrstand beim Anpfiff der Verlängerung + deren Dauer – sonst wäre die Spielzeit beim Anpfiff schon
 * abgelaufen (Countdown 00:00, Auto-Ende sofort).
 */
import type { MatchState } from '../types';
import type { LiveMatch } from '../../models/LiveMatch';

export function viewDurationSeconds(state: MatchState): number {
  const rules = state.rules;
  if (!rules) {
    return 0;
  }
  if (state.phase !== 'overtime') {
    return rules.sections * rules.sectionSeconds;
  }
  // Die Verlängerung beginnt beim Uhrstand ihres Anpfiffs (`sectionStartMs`), nicht bei der Regelzeit –
  // sonst kürzt ein Abpfiff nach Ablauf (z. B. bei 10:45) die Verlängerung. In der Pause davor ist
  // `sectionStartMs` noch der Beginn des letzten Abschnitts; dort gilt der gestoppte Uhrstand.
  const startMs = state.status === 'section_break' ? state.clock.elapsedMs : state.sectionStartMs;
  return Math.floor(startMs / 1000) + rules.overtimeSeconds;
}

/**
 * Darf das Cockpit das Spiel jetzt automatisch beenden? Nur bei laufendem Spiel mit wirklich
 * abgelaufener Spielzeit – auch im Golden Goal (@DR-019: ohne Tor folgt bei Remis das
 * Strafstoßschießen); ein Golden-Goal-Tor beendet das Spiel vorher in der Engine (@SL-082).
 */
export function isAutoFinishDue(
  match: Pick<LiveMatch, 'status'> | null | undefined,
  isOvertime: boolean,
): boolean {
  return match?.status === 'RUNNING' && isOvertime;
}
