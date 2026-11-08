/**
 * Paket M · Uhrformat des Monitors gleich dem Cockpit (Befund C-UHRFORMAT-MONITOR-COCKPIT; @ZM-139 „das Cockpit zeigt dieselbe Restzeit“,
 * @ZM-162 „steht die Restzeit 1:50“) und die graue, als „unsicher“ gekennzeichnete Restzeit bei eingefrorener Verbindung (@ZM-085, @ME-030).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchTimer } from '../MatchTimer';
import { UhrSicherheitContext } from '../UhrSicherheitContext';
import { restzeitText } from '../../live-cockpit/model/restzeit';
import { monitorThemes } from '../../../design-tokens';
import { getContrastRatio } from '../../../design-tokens/display';

/** Ein pausiertes Spiel mit Abschnitt von `laenge` Sekunden und `rest` Sekunden Restzeit */
function zeigeRestzeit(laenge: number, rest: number): string {
  const gespielt = laenge - rest;
  const { unmount } = render(<MatchTimer elapsedSeconds={gespielt} durationSeconds={laenge} status="PAUSED" timerElapsedSeconds={gespielt} />);
  const text = screen.getByTestId('monitor-clock').textContent ?? '';
  unmount();
  return text;
}

describe('Uhrformat Monitor = Cockpit (M:SS, ohne führende Null bei den Minuten)', () => {
  it.each([[600, 600], [360, 110], [360, 59], [360, 5], [600, 280], [900, 600], [3600, 3599]])(
    'Abschnitt %i s, Restzeit %i s: Monitor und Cockpit zeigen denselben Text',
    (laenge, rest) => {
      expect(zeigeRestzeit(laenge, rest)).toBe(restzeitText(rest * 1000));
    },
  );

  it('@ZM-139: 1:50 steht als „1:50“, nicht als „01:50“; 10:00 bleibt „10:00“, 0:00 steht als „0:00“', () => {
    expect(zeigeRestzeit(360, 110)).toBe('1:50');
    expect(zeigeRestzeit(600, 600)).toBe('10:00');
    expect(zeigeRestzeit(600, 0)).toBe('0:00');
  });
});

describe('Restzeit bei eingefrorener Verbindung (@ZM-085)', () => {
  const unsicherRendern = () => render(
    <UhrSicherheitContext.Provider value={false}>
      <MatchTimer elapsedSeconds={250} durationSeconds={360} status="RUNNING" timerStartTime={new Date().toISOString()} timerElapsedSeconds={250} />
    </UhrSicherheitContext.Provider>,
  );

  it('die Uhr bleibt sichtbar, ist grau und über ihr steht „unsicher“ (Text, nicht nur Farbe)', () => {
    unsicherRendern();
    const uhr = screen.getByTestId('monitor-clock');
    expect(uhr).toHaveAttribute('data-sicherheit', 'unsicher');
    expect(uhr.querySelector<HTMLElement>('[data-monitor="uhr"]')!.style.color).not.toBe('');
    expect(screen.getByTestId('clock-label')).toHaveTextContent('liveMatch.clock.remainingUncertain');
  });

  it('Gegenbeispiel: mit sicherer Verbindung bleibt „Restzeit“ in der Farbe der Uhr', () => {
    render(<MatchTimer elapsedSeconds={250} durationSeconds={360} status="RUNNING" timerStartTime={new Date().toISOString()} timerElapsedSeconds={250} />);
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-sicherheit', 'sicher');
    expect(screen.getByTestId('clock-label')).toHaveTextContent('liveMatch.clock.remaining');
    expect(screen.getByTestId('clock-label')).not.toHaveTextContent('Uncertain');
  });

  // Das helle Design ist MVP+ (@ZM-173); sein gedämpfter Text (4,3 : 1) wird mit diesem Paket nachgezogen
  it('das Grau erreicht im dunklen Design mindestens 4,6 : 1 zum Hintergrund (@ZM-125)', () => {
    expect(getContrastRatio(monitorThemes.dark.textSecondary, monitorThemes.dark.background)).toBeGreaterThanOrEqual(4.6);
  });
});
