/**
 * VerbindungsStatus (Molekül, @SL-168): Zustandspunkt + Wort, ohne Netz optional „N Einträge warten“ und der Knopf „Verbinden“,
 * nach der Rückkehr kurz „Wieder verbunden“. Props ohne Cockpit-Wissen; alle Texte kommen vom Aufrufer.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerbindungsStatus, type VerbindungsStatusTexte } from '../VerbindungsStatus';

const texte: VerbindungsStatusTexte = {
  online: 'Online', offline: 'Offline', verbinden: 'Verbinden', wiederVerbunden: 'Wieder verbunden',
  wartend: (n) => (n === 1 ? '1 Eintrag wartet' : `${n} Einträge warten`),
};
const zeige = (p: Partial<React.ComponentProps<typeof VerbindungsStatus>> = {}) =>
  render(<VerbindungsStatus status="offline" texte={texte} testId="vs" {...p} />);

describe('VerbindungsStatus (@SL-168)', () => {
  it('@SL-168 ohne Netz: Wort „Offline“, die wartenden Einträge und der Knopf „Verbinden“; Tippen ruft onVerbinden', async () => {
    const onVerbinden = vi.fn();
    zeige({ wartende: 3, onVerbinden });
    expect(screen.getByTestId('vs')).toHaveAttribute('data-status', 'offline');
    expect(screen.getByTestId('vs')).toHaveTextContent('Offline');
    expect(screen.getByTestId('vs')).toHaveTextContent('3 Einträge warten');
    await userEvent.click(screen.getByTestId('vs-verbinden'));
    expect(onVerbinden).toHaveBeenCalledTimes(1);
  });

  it('@SL-168 Gegenbeispiel: mit Netz zeigt der Status keinen Knopf „Verbinden“, auch wenn ein Handler übergeben ist', () => {
    zeige({ status: 'online', onVerbinden: vi.fn() });
    expect(screen.queryByTestId('vs-verbinden')).toBeNull();
    expect(screen.getByTestId('vs')).toHaveTextContent('Online');
  });

  it('@SL-168 Gegenbeispiel: ohne Handler gibt es keinen Knopf, ohne wartende Einträge keine Zählung', () => {
    zeige({ wartende: 0 });
    expect(screen.queryByTestId('vs-verbinden')).toBeNull();
    expect(screen.getByTestId('vs')).not.toHaveTextContent('warten');
  });

  it('@SL-168 der Knopf erfüllt die Mindest-Tippfläche (44 px, Token)', () => {
    zeige({ onVerbinden: vi.fn() });
    expect(screen.getByTestId('vs-verbinden').style.minHeight).toBe('var(--touch-target-minimum)');
  });

  it('@SL-168 nach der Rückkehr steht kurz „Wieder verbunden“ statt „Online“', () => {
    zeige({ status: 'online', wiederVerbunden: true });
    expect(screen.getByTestId('vs')).toHaveTextContent('Wieder verbunden');
    expect(screen.getByTestId('vs')).not.toHaveTextContent(/^Online/);
  });

  it('@SL-168 Variante kompakt: mit Netz nur der Punkt (Name bleibt „Online“), ohne Netz immer mit Wort', () => {
    const { unmount } = zeige({ status: 'online', variante: 'kompakt' });
    expect(screen.getByTestId('vs').textContent).toBe('');
    expect(screen.getByTestId('vs')).toHaveAccessibleName('Online');
    unmount();
    zeige({ status: 'offline', variante: 'kompakt' });
    expect(screen.getByTestId('vs')).toHaveTextContent('Offline');
  });

  it('@SL-168 Gegenbeispiel kompakt: „Wieder verbunden“ steht auch in der kompakten Variante als Wort', () => {
    zeige({ status: 'online', variante: 'kompakt', wiederVerbunden: true });
    expect(screen.getByTestId('vs')).toHaveTextContent('Wieder verbunden');
  });
});
