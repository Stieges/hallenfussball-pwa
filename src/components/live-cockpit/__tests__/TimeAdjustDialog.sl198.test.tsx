/**
 * @SL-198 Die Korrektur der Uhr zeigt dieselbe Zeit wie die Uhr und ändert sie in derselben Richtung (Befund C-COCKPIT-ZEIT-KORRIGIEREN-GEGENLAEUFIG).
 * Grundriss wörtlich: Spiel 9 Minuten; Countdown „5:20“ → „10 Sekunden mehr“ → „5:30“; aufwärts „3:40“ → „3:50“; Grenzen in derselben Zählweise.
 * Der Dialog meldet die gespielte Zeit im Abschnitt (die Engine rechnet so): Restzeit 5:30 bei 9:00 = gespielt 3:30.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TimeAdjustDialog } from '../components/Dialogs/TimeAdjustDialog';

vi.unmock('i18next');
vi.unmock('react-i18next');

beforeAll(async () => {
  await initRealDeI18n();
});

const NEUN_MINUTEN = 540;
const stepper = (): HTMLElement => screen.getByTestId('time-adjust-stepper');
const mehr = (): HTMLElement => screen.getByRole('button', { name: '10 Sekunden mehr' });
const uebernehmen = (): HTMLElement => screen.getByRole('button', { name: 'Übernehmen' });

function dialog(p: { gespielt: number; countdown: boolean; min?: number; minIsGoal?: boolean; onConfirm?: (s: number) => void }) {
  return render(
    <TimeAdjustDialog
      isOpen onClose={() => undefined} onConfirm={p.onConfirm ?? (() => undefined)}
      currentSeconds={p.gespielt} minSeconds={p.min ?? 0} maxSeconds={NEUN_MINUTEN} minIsGoal={p.minIsGoal ?? false} countdown={p.countdown}
    />,
  );
}

describe('@SL-198 Zählweise der Uhr im Dialog', () => {
  it.each([
    { zaehlweise: 'als Restzeit (Countdown)', countdown: true, gespielt: NEUN_MINUTEN - 320, anzeige: '5:20', danach: '5:30', gemeldet: NEUN_MINUTEN - 330 },
    { zaehlweise: 'aufwärts als gespielte Zeit', countdown: false, gespielt: 220, anzeige: '3:40', danach: '3:50', gemeldet: 230 },
  ])('@SL-198 Uhr $zaehlweise zeigt $anzeige → „10 Sekunden mehr“ → $danach', ({ countdown, gespielt, anzeige, danach, gemeldet }) => {
    const onConfirm = vi.fn();
    dialog({ gespielt, countdown, onConfirm });
    expect(stepper()).toHaveTextContent(anzeige);
    fireEvent.click(mehr());
    expect(stepper()).toHaveTextContent(danach);
    fireEvent.click(uebernehmen());
    // nach „Übernehmen“ zeigt die Uhr <danach>: gemeldet wird die gespielte Zeit, aus der die Uhr wieder <danach> rechnet
    expect(onConfirm).toHaveBeenCalledWith(gemeldet);
    expect(countdown ? NEUN_MINUTEN - gemeldet : gemeldet).toBe(Number(danach.split(':')[0]) * 60 + Number(danach.split(':')[1]));
  });

  it('@SL-198 Countdown: die Grenzen stehen als Restzeit da – höchstens bis zum Tor, mindestens 0:00', () => {
    // Tor bei gespielt 2:00 → Restzeit höchstens 7:00; die Uhr steht bei Restzeit 5:20
    dialog({ gespielt: NEUN_MINUTEN - 320, countdown: true, min: 120, minIsGoal: true });
    expect(screen.getByTestId('time-adjust-grenze-eintrag')).toHaveTextContent('wegen des Tors höchstens 7:00');
    expect(screen.getByTestId('time-adjust-grenze')).toHaveTextContent('mindestens 0:00');
    expect(screen.getByText('Restzeit im Abschnitt')).toBeInTheDocument();
    for (let i = 0; i < 30; i += 1) { fireEvent.click(mehr()); }
    expect(stepper()).toHaveTextContent('7:00');
    expect(mehr()).toBeDisabled();
  });

  it('@SL-198 aufwärts: die Grenzen stehen als gespielte Zeit da (wie bisher, @SL-012/@SL-077)', () => {
    dialog({ gespielt: 220, countdown: false, min: 120, minIsGoal: true });
    expect(screen.getByTestId('time-adjust-grenze-eintrag')).toHaveTextContent('wegen des Tors bei 2:00 frühestens 2:00');
    expect(screen.getByTestId('time-adjust-grenze')).toHaveTextContent('höchstens 9:00');
    expect(screen.getByText('Spielzeit im Abschnitt')).toBeInTheDocument();
  });

  it('@SL-198 Countdown: der Vergleich alt → neu steht in Restzeit', () => {
    dialog({ gespielt: NEUN_MINUTEN - 320, countdown: true });
    fireEvent.click(mehr());
    expect(screen.getByText('5:20 → 5:30')).toBeInTheDocument();
  });
});
