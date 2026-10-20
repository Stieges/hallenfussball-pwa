/**
 * Ersatz-Ansicht ohne Engine-Kopie (Aufgabe 2.4): Solange `useEnginePhase` keine `PhaseView` liefert (Kopie lädt noch,
 * Aufrufer ohne Engine-Provider), zeigt die Tafel die Zeit aus dem `LiveMatch`. Abschnitt und Pausen kennt der
 * `LiveMatch` nicht (S1): ein Abschnitt, keine Pausen-Restzeit. Rein, ohne React.
 */
import type { LiveMatch } from '../types';
import type { PhaseView } from '../engine/phaseView';

/** Was die Ersatz-Ansicht vom Spiel liest. */
export type LegacyPhaseMatch = Pick<LiveMatch, 'status' | 'playPhase' | 'awaitingTiebreakerChoice' | 'durationSeconds' | 'tiebreakerMode'>;

function statusOf(match: LegacyPhaseMatch): PhaseView['status'] {
  if (match.status === 'FINISHED') { return 'finished'; }
  if (match.status === 'NOT_STARTED') { return 'scheduled'; }
  if (match.playPhase === 'penalty') { return 'shootout'; }
  if (match.awaitingTiebreakerChoice) { return 'decision_pending'; }
  return match.status === 'RUNNING' ? 'running' : 'paused';
}

/** `elapsedSeconds`: Sekunden seit Beginn der aktuellen Spielzeit (Quelle `useMatchTimerExtended`). */
export function legacyPhaseViewOf(match: LegacyPhaseMatch, elapsedSeconds: number): PhaseView {
  const verlaengerung = match.playPhase === 'overtime' || match.playPhase === 'goldenGoal';
  return {
    status: statusOf(match),
    phase: verlaengerung ? 'overtime' : match.playPhase === 'penalty' ? 'shootout' : 'regular',
    section: 1,
    sections: 1,
    sectionElapsedMs: Math.max(0, elapsedSeconds) * 1000,
    sectionLimitMs: match.durationSeconds * 1000,
    limitClockMs: match.durationSeconds * 1000,
    limitAt: null,
    reopenCount: 0,
    isLastRegularSection: true,
    breakRemainingMs: null,
    quittungRestMs: null, // ohne Engine-Kopie kennt der `LiveMatch` den Abpfiff-Zeitpunkt nicht (@SL-152)
    earliestAdjustMs: 0,
    earliestAdjustIsGoal: false,
    penalties: [],
    shootout: null,
    clockAdjustments: [],
    tiebreakMode: match.playPhase === 'goldenGoal' ? 'goldenGoal' : match.tiebreakerMode ?? null,
  };
}
