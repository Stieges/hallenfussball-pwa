/**
 * Paket M · @ZM-199 Die Restzeit steht überall im selben Format („1:50“, „10:00“, „0:00“, „0:09“) – Monitor, Zuschauer-Seite, Cockpit
 * (Befund C-UHRFORMAT-MONITOR-COCKPIT).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchTimer } from '../MatchTimer';
import { restzeitText } from '../../live-cockpit/model/restzeit';
import { formatRemaining } from '../../../core/view';

/** Ein pausiertes Spiel mit Abschnitt von `laenge` Sekunden und `rest` Sekunden Restzeit */
function zeigeRestzeit(laenge: number, rest: number): string {
  const gespielt = laenge - rest;
  const { unmount } = render(<MatchTimer elapsedSeconds={gespielt} durationSeconds={laenge} status="PAUSED" timerElapsedSeconds={gespielt} />);
  const text = screen.getByTestId('monitor-clock').textContent ?? '';
  unmount();
  return text;
}

describe('@ZM-199 Uhrformat Monitor = Zuschauer-Seite = Cockpit (M:SS, ohne führende Null bei den Minuten)', () => {
  it.each([[600, 600], [360, 110], [360, 59], [360, 5], [600, 280], [900, 600], [3600, 3599]])(
    'Abschnitt %i s, Restzeit %i s: Monitor und Cockpit zeigen denselben Text',
    (laenge, rest) => {
      expect(zeigeRestzeit(laenge, rest)).toBe(restzeitText(rest * 1000));
    },
  );

  it('@ZM-199: 1:50 steht als „1:50“, 10:00 als „10:00“, 0 Sekunden als „0:00“, 9 Sekunden als „0:09“ – wie Zuschauer-Seite und Cockpit', () => {
    expect(zeigeRestzeit(360, 110)).toBe('1:50');
    expect(zeigeRestzeit(600, 600)).toBe('10:00');
    expect(zeigeRestzeit(600, 0)).toBe('0:00');
    expect(zeigeRestzeit(600, 9)).toBe('0:09');
    for (const rest of [110, 600, 0, 9]) { expect(formatRemaining(rest)).toBe(restzeitText(rest * 1000)); }
  });
});
