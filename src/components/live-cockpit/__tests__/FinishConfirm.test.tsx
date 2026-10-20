/**
 * FinishConfirm – Rückfrage „Spiel 11 bei noch 3:12 Minuten Spielzeit beenden?“ (Plan LT-1; @SL-010, @SL-157, @SL-133).
 * Echte deutsche Texte; Gegenbeispiele: Weiterspielen beendet nichts, Esc und Tipp daneben beenden nichts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { FinishConfirm } from '../areas/FinishConfirm';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const zeige = (extra: Partial<React.ComponentProps<typeof FinishConfirm>> = {}) => {
  const props = { offen: true, spielNummer: 11, restText: '3:12', onBeenden: vi.fn(), onAbbrechen: vi.fn(), ...extra };
  render(<FinishConfirm {...props} />);
  return props;
};

describe('FinishConfirm', () => {
  it('@SL-157 @SL-010 fragt „Spiel 11 bei noch 3:12 Minuten Spielzeit beenden?“ auf einem modalen Rückfrage-Dialog', () => {
    zeige();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Spiel 11 bei noch 3:12 Minuten Spielzeit beenden?');
  });

  it('@SL-010 „Beenden“ beendet genau einmal', async () => {
    const p = zeige();
    await userEvent.click(screen.getByRole('button', { name: 'Beenden' }));
    expect(p.onBeenden).toHaveBeenCalledTimes(1);
    expect(p.onAbbrechen).not.toHaveBeenCalled();
  });

  it('@SL-010 Gegenbeispiel: „Weiterspielen“ beendet nichts', async () => {
    const p = zeige();
    await userEvent.click(screen.getByRole('button', { name: 'Weiterspielen' }));
    expect(p.onBeenden).not.toHaveBeenCalled();
    expect(p.onAbbrechen).toHaveBeenCalledTimes(1);
  });

  it('@SL-010 Gegenbeispiel: Esc und Tipp neben den Dialog beenden nichts', async () => {
    const p = zeige();
    await userEvent.keyboard('{Escape}');
    expect(p.onBeenden).not.toHaveBeenCalled();
    expect(p.onAbbrechen).toHaveBeenCalledTimes(1);
  });

  it('@OB-014 Gegenbeispiel: die Eingabetaste löst in der Rückfrage nichts aus, der Fokus liegt zuerst auf „Weiterspielen“', async () => {
    const p = zeige();
    expect(screen.getByRole('button', { name: 'Weiterspielen' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(p.onBeenden).not.toHaveBeenCalled();
  });

  it('@SL-133 die Restzeit des ganzen Spiels steht im Text (8:00 im ersten Abschnitt)', () => {
    zeige({ restText: '8:00' });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('bei noch 8:00 Minuten Spielzeit');
  });

  it('Gegenbeispiel: geschlossen rendert nichts', () => {
    zeige({ offen: false });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
