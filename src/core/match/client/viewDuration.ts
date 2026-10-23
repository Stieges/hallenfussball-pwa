/**
 * Spieldauer der Cockpit-Ansicht (C-VERLAENGERUNG-ENDET-SOFORT; @SL-145, @SL-081, @SL-082, @DR-019,
 * @TM-052, @SL-010). Das Ende von selbst steht seit B-08b in `useAutoSectionEnd` (Grenze aus `PhaseView`).
 *
 * Die Engine-Uhr läuft über alle Abschnitte weiter (B-U1, `handlers/sections.ts`): Beim Anpfiff der
 * Verlängerung steht sie schon auf der Regelspielzeit. Die Dauer der Ansicht umfasst in der
 * Verlängerung deshalb Uhrstand beim Anpfiff der Verlängerung + deren Dauer – sonst wäre die Spielzeit beim Anpfiff schon
 * abgelaufen (Countdown 00:00, Auto-Ende sofort).
 */
import type { MatchState, MatchStatus } from '../types';

/**
 * Uhrstand (ms) am Anpfiff der Verlängerung. Die Verlängerung beginnt beim Uhrstand ihres Anpfiffs (`sectionStartMs`),
 * nicht bei der Regelzeit – sonst kürzt ein Abpfiff nach Ablauf (z. B. bei 10:45) die Verlängerung. In der Pause davor ist
 * `sectionStartMs` noch der Beginn des letzten Abschnitts; dort gilt der gestoppte Uhrstand.
 * Gemeinsam für die Verwaltung (`viewDurationSeconds`) und den Monitor (`badgeDetailFromLiveState`, Paket MU).
 */
export function overtimeStartMsOf(status: MatchStatus, clockElapsedMs: number, sectionStartMs: number): number {
  return status === 'section_break' ? clockElapsedMs : sectionStartMs;
}

export function viewDurationSeconds(state: MatchState): number {
  const rules = state.rules;
  if (!rules) {
    return 0;
  }
  if (state.phase !== 'overtime') {
    return rules.sections * rules.sectionSeconds;
  }
  const startMs = overtimeStartMsOf(state.status, state.clock.elapsedMs, state.sectionStartMs);
  return Math.floor(startMs / 1000) + rules.overtimeSeconds;
}
