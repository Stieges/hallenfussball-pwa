/**
 * scoreChangeHelpers (A-08f3e2): Weiche der Schnelleingabe nach dem Status der Engine-Ansicht NACH `catchUp`
 * (Plan § 1.3 Nr. 3, N-4). Die K.-o.-Auflösung liegt in `hooks/koSlotResolution.ts` (Fixrunde 1, I-1).
 * Spiel beenden (20261110_009, @FU-112, @FU-114, @FU-118): ein angepfiffenes Spiel beendet die Turnierleitung nach
 * Rückfrage mit dem Ergebnis (`end`); im laufenden Strafstoßschießen nicht (`shootout`).
 */
import { elapsedAt, type MatchState, type MatchStatus } from '../../../core/match';

/**
 * enter = `RESULT_ENTRY`, correct = `CORRECTION` mit Grund, unskip = Rückfrage + Stapel, end = Rückfrage + `RESULT_ENTRY`
 * mit `basedOn` (Abpfiff und Ergebnis in einem Eintrag), shootout = Ablehnung (im Cockpit zu Ende bringen).
 */
export type ResultEntryRoute = 'enter' | 'correct' | 'unskip' | 'end' | 'shootout';

export function routeForStatus(status: MatchStatus): ResultEntryRoute {
  switch (status) {
    case 'scheduled':
      return 'enter';
    case 'finished':
      return 'correct';
    case 'skipped':
      return 'unskip';
    case 'shootout':
      return 'shootout';
    default:
      return 'end'; // running, paused, section_break, decision_pending
  }
}

/** Uhr der Rückfrage: Restzeit des Abschnitts in Sekunden, `null` = Spielzeit abgelaufen (@FU-114). */
export function endPromptRestSeconds(state: MatchState, serverNow: number): number | null {
  const rules = state.rules;
  if (!rules || state.status === 'decision_pending') {
    return null;
  }
  const overtime = state.phase === 'overtime';
  const lastSection = overtime || state.section >= rules.sections;
  const limitMs = (overtime ? rules.overtimeSeconds : rules.sectionSeconds) * 1000;
  if (state.status === 'section_break') {
    // Pause nach einem Abschnitt: vor der Verlängerung ist die reguläre Spielzeit um, sonst folgt ein ganzer Abschnitt.
    return lastSection ? null : rules.sectionSeconds;
  }
  const restMs = limitMs - (elapsedAt(state.clock, serverNow) - state.sectionStartMs);
  return restMs <= 0 && lastSection ? null : Math.max(0, Math.ceil(restMs / 1000));
}
