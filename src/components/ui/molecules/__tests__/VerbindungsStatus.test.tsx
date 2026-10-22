/**
 * VerbindungsStatus (Molekül, @SL-168): Zustandspunkt + Wort, ohne Netz optional „N Einträge warten“ und der Knopf „Verbinden“,
 * während des Versuchs „Verbinde …“ in derselben Pille; eine Meldung „Wieder verbunden“ gibt es nicht. Props ohne Cockpit-Wissen; alle Texte kommen vom Aufrufer.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerbindungsStatus, type VerbindungsStatusTexte } from '../VerbindungsStatus';

const texte: VerbindungsStatusTexte = {
  online: 'Verbunden', offline: 'Offline', verbinden: 'Verbinden', verbindet: 'Verbinde …',
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
    expect(screen.getByTestId('vs')).toHaveTextContent('Verbunden');
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

  it('@SL-168 Variante kompakt: mit Netz nur der Punkt (Name bleibt „Verbunden“ in der Ansage), ohne Netz immer mit Wort', () => {
    const { unmount } = zeige({ status: 'online', variante: 'kompakt' });
    expect(screen.getByRole('status')).toHaveTextContent('Verbunden');
    expect(screen.queryByText('Verbunden', { ignore: '[role="status"]' })).toBeNull();
    unmount();
    zeige({ status: 'offline', variante: 'kompakt' });
    expect(screen.getByTestId('vs')).toHaveTextContent('Offline');
    expect(screen.getByText('Offline', { ignore: '[role="status"]' })).toBeVisible();
  });

  it('@SL-168 H10 Laptop: role="status" umschließt nur Wort und Zähler, nie den Knopf; kein Innenabstand um den Knopf', () => {
    zeige({ wartende: 3, onVerbinden: vi.fn() });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Offline');
    expect(status).toHaveTextContent('3 Einträge warten');
    expect(within(status).queryByRole('button')).toBeNull();
    expect(screen.getByTestId('vs-verbinden').closest('[role="status"]')).toBeNull();
    // die Hülle gibt dem Knopf keinen Rand aus Innenabstand: die Anzeige wird nicht höher als der Knopf
    expect(screen.getByTestId('vs').style.padding).toMatch(/^0(px)?$/);
  });

  it('@SL-168 Handy ohne Netz: EINE Pille als Knopf – oben „Verbinden“, darunter klein „Offline“ und die wartenden Einträge', async () => {
    const onVerbinden = vi.fn();
    zeige({ variante: 'kompakt', wartende: 3, onVerbinden });
    const knopf = screen.getByRole('button', { name: 'Verbinden' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(knopf).toHaveTextContent('Verbinden');
    expect(knopf).toHaveTextContent('Offline');
    expect(knopf).toHaveTextContent('3 Einträge warten');
    expect(knopf.style.minHeight).toBe('var(--touch-target-minimum)');
    await userEvent.click(knopf);
    expect(onVerbinden).toHaveBeenCalledTimes(1);
  });

  it('@SL-168 H10 Handy ohne Netz: role="status" steht neben dem Knopf (Text „Offline, 3 Einträge warten“), nicht um ihn', () => {
    zeige({ variante: 'kompakt', wartende: 3, onVerbinden: vi.fn() });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Offline, 3 Einträge warten');
    expect(within(status).queryByRole('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Verbinden' }).closest('[role="status"]')).toBeNull();
    expect(screen.getByTestId('vs')).toHaveAttribute('data-status', 'offline');
  });

  it('@SL-168 Handy ohne Netz ohne wartende Einträge: nur „Verbinden“ und „Offline“, keine Zählung', () => {
    zeige({ variante: 'kompakt', wartende: 0, onVerbinden: vi.fn() });
    expect(screen.getByRole('button', { name: 'Verbinden' })).not.toHaveTextContent('warten');
    expect(screen.getByRole('status')).toHaveTextContent(/^Offline$/);
  });

  it('@SL-168 Gegenbeispiel Handy: mit Netz zeigt auch die kompakte Pille keinen Knopf', () => {
    zeige({ variante: 'kompakt', status: 'online', wartende: 3, onVerbinden: vi.fn() });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('@SL-168 H12 die Live-Region bleibt in jedem Zustand dasselbe Element (nur der Inhalt wechselt), sonst sagen Bildschirmleser „Verbinde …“, „Offline“ und „Verbunden“ nicht an', () => {
    const { rerender } = zeige({ status: 'online', variante: 'kompakt' });
    const region = screen.getByRole('status');
    const schritte: Array<Partial<React.ComponentProps<typeof VerbindungsStatus>>> = [
      { status: 'offline', variante: 'kompakt', wartende: 3, onVerbinden: vi.fn() },
      { status: 'offline', variante: 'normal', wartende: 3, onVerbinden: vi.fn() },
      { status: 'offline', variante: 'kompakt' },
      { status: 'offline', variante: 'kompakt', wartende: 3, onVerbinden: vi.fn(), verbindet: true },
      { status: 'offline', variante: 'normal', wartende: 3, onVerbinden: vi.fn(), verbindet: true },
      { status: 'online', variante: 'normal' },
    ];
    for (const schritt of schritte) {
      rerender(<VerbindungsStatus status="offline" texte={texte} testId="vs" {...schritt} />);
      expect(screen.getAllByRole('status')).toHaveLength(1);
      expect(screen.getByRole('status')).toBe(region);
    }
    expect(region).toHaveTextContent('Verbunden');
  });

  it('@SL-168 H12 sichtbare Texte sind für Bildschirmleser verborgen (die Ansage trägt sie), der Knopf bleibt erreichbar', () => {
    zeige({ wartende: 3, onVerbinden: vi.fn() });
    expect(screen.getByText('3 Einträge warten', { ignore: '[role="status"]' }).closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Verbinden' }).closest('[aria-hidden="true"]')).toBeNull();
  });

  it('@SL-168 Verbinde …: in DERSELBEN Pille steht „Verbinde …“ statt „Verbinden“, Wort und Zähler bleiben, die Ansage sagt „Verbinde …“; Tippen startet keinen zweiten Versuch', async () => {
    const onVerbinden = vi.fn();
    const { rerender } = zeige({ variante: 'kompakt', wartende: 3, onVerbinden });
    const knopf = screen.getByTestId('vs-verbinden');
    rerender(<VerbindungsStatus status="offline" texte={texte} testId="vs" variante="kompakt" wartende={3} onVerbinden={onVerbinden} verbindet />);
    expect(screen.getByTestId('vs-verbinden')).toBe(knopf);
    expect(knopf).toHaveTextContent('Verbinde …');
    expect(knopf).not.toHaveTextContent('Verbinden');
    expect(knopf).toHaveTextContent('Offline');
    expect(knopf).toHaveTextContent('3 Einträge warten');
    expect(screen.getByRole('status')).toHaveTextContent('Verbinde …');
    expect(knopf).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(knopf);
    expect(onVerbinden).not.toHaveBeenCalled();
  });

  it('@SL-168 Verbinde … am Laptop: der Knopf-Abschnitt der Pille zeigt „Verbinde …“, role="status" bleibt neben dem Knopf', () => {
    zeige({ wartende: 3, onVerbinden: vi.fn(), verbindet: true });
    expect(screen.getByTestId('vs-verbinden')).toHaveTextContent('Verbinde …');
    expect(screen.getByRole('status')).toHaveTextContent('Verbinde …');
    expect(screen.getByRole('button', { name: 'Verbinde …' }).closest('[role="status"]')).toBeNull();
  });

  it('@SL-168 Gegenbeispiele: ohne Versuch steht „Verbinden“ (nie „Verbinde …“), mit Netz erscheint auch bei verbindet kein Knopf und keine „Wieder verbunden“-Meldung', () => {
    const { unmount } = zeige({ wartende: 3, onVerbinden: vi.fn() });
    expect(screen.getByTestId('vs-verbinden')).toHaveTextContent('Verbinden');
    expect(screen.getByTestId('vs-verbinden')).not.toHaveAttribute('aria-disabled');
    unmount();
    zeige({ status: 'online', onVerbinden: vi.fn(), verbindet: true });
    expect(screen.queryByTestId('vs-verbinden')).toBeNull();
    expect(screen.getByTestId('vs')).not.toHaveTextContent(/Wieder verbunden|Verbinde/);
  });
});
