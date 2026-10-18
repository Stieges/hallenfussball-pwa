/**
 * TimeAdjustDialog (B-08d): Spielzeit im Abschnitt mit Grenzen. Testwerte wörtlich aus @SL-012 (Obergrenze
 * „höchstens 6:00“), @SL-077 (Untergrenze „wegen des Tors bei 5:10 frühestens 5:10“) und dem Übernehmen-Knopf.
 * Echte deutsche Texte (realDeI18n), kein Engine-Zugriff: der Dialog meldet nur die neue Spielzeit.
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

const noop = (): void => undefined;

function dialog(props: { current: number; min?: number; max?: number; minIsGoal?: boolean; onConfirm?: (s: number) => void }) {
  return render(
    <TimeAdjustDialog
      isOpen
      onClose={noop}
      onConfirm={props.onConfirm ?? noop}
      currentSeconds={props.current}
      minSeconds={props.min ?? 0}
      maxSeconds={props.max ?? 360}
      minIsGoal={props.minIsGoal ?? false}
    />,
  );
}

const mehr = (): HTMLElement => screen.getByRole('button', { name: '10 Sekunden mehr' });
const weniger = (): HTMLElement => screen.getByRole('button', { name: '10 Sekunden weniger' });
const uebernehmen = (): HTMLElement => screen.getByRole('button', { name: 'Übernehmen' });

describe('TimeAdjustDialog (B-08d)', () => {
  it('@SL-012 Gegenbeispiel: die Spielzeit steigt höchstens bis 6:00, der Hinweis nennt die Grenze', () => {
    const onConfirm = vi.fn();
    dialog({ current: 180, max: 360, onConfirm });
    for (let i = 0; i < 40; i += 1) { fireEvent.click(mehr()); }
    expect(screen.getByText('6:00')).toBeInTheDocument();
    expect(screen.queryByText('7:00')).not.toBeInTheDocument();
    expect(screen.getByText('höchstens 6:00')).toBeInTheDocument();
    expect(mehr()).toBeDisabled();
    fireEvent.click(uebernehmen());
    expect(onConfirm).toHaveBeenCalledWith(360);
  });

  it('@SL-077: nach dem Tor bei 5:10 geht die Spielzeit nicht darunter, der Hinweis nennt das Tor', () => {
    const onConfirm = vi.fn();
    dialog({ current: 320, min: 310, minIsGoal: true, onConfirm });
    expect(screen.getByText('wegen des Tors bei 5:10 frühestens 5:10')).toBeInTheDocument();
    fireEvent.click(weniger());
    expect(screen.getByText('5:10')).toBeInTheDocument();
    expect(weniger()).toBeDisabled();
    fireEvent.click(uebernehmen());
    expect(onConfirm).toHaveBeenCalledWith(310);
  });

  it('Gegenbeispiel: ein Eintrag ohne Tor nennt den Eintrag, nicht das Tor', () => {
    dialog({ current: 320, min: 310, minIsGoal: false });
    expect(screen.getByText('wegen eines Eintrags bei 5:10 frühestens 5:10')).toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne Änderung ist der Übernehmen-Knopf aus, nichts wird gesendet', () => {
    const onConfirm = vi.fn();
    dialog({ current: 320, onConfirm });
    expect(uebernehmen()).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
