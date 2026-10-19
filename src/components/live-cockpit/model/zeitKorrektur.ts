/**
 * Uhrstände für die Zeitkorrektur (B-08d, CLOCK_ADJUST): der neue Stand ist Abschnittsbeginn + neue
 * Abschnittszeit, der bisherige Stand ist Abschnittsbeginn + gespielte Zeit. Der Abschnittsbeginn auf der
 * Spieluhr ist `limitClockMs - sectionLimitMs` (siehe `PhaseView`). Rein, ohne React.
 */
import type { PhaseView } from '../engine/phaseView';

export interface KorrekturUhrstaende {
  clockMs: number;
  previousClockMs: number;
}

export function korrekturUhrstaende(
  view: Pick<PhaseView, 'limitClockMs' | 'sectionLimitMs' | 'sectionElapsedMs'>,
  neuSekunden: number,
): KorrekturUhrstaende {
  const abschnittsBeginnMs = view.limitClockMs - view.sectionLimitMs;
  return {
    clockMs: abschnittsBeginnMs + neuSekunden * 1000,
    previousClockMs: abschnittsBeginnMs + view.sectionElapsedMs,
  };
}
