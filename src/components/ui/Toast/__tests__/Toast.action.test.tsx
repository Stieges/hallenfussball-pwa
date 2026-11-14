/**
 * @OB-087 Taste am Hinweis (Toast): was der Tipp bewirkt. Rückgabe der Aktion: nichts → der Hinweis schließt (wie bisher); `busyLabel` → er bleibt
 * stehen, die Taste ist gesperrt und zeigt die Arbeitsanzeige, ein zweiter Tipp löst nichts doppelt aus; `note` → er bleibt stehen und sagt in einem
 * Satz, warum jetzt nichts geschieht. Feste Kennung (`id`): derselbe Hinweis steht nur einmal da.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast, type ToastOptions } from '../ToastContext';

function Ausloeser({ optionen, mal = 1 }: { optionen: ToastOptions; mal?: number }) {
  const { showWarning } = useToast();
  return <button type="button" data-testid="zeige" onClick={() => { for (let i = 0; i < mal; i += 1) { showWarning('App aktualisieren', optionen); } }}>zeige</button>;
}
const zeige = (optionen: ToastOptions, mal = 1) => {
  render(<ToastProvider><Ausloeser optionen={optionen} mal={mal} /></ToastProvider>);
  fireEvent.click(screen.getByTestId('zeige'));
};

describe('@OB-087 Taste am Hinweis', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Arbeitsanzeige: nach dem Tipp bleibt der Hinweis stehen, die Taste ist gesperrt und zeigt die Arbeitsanzeige; ein zweiter Tipp löst nichts doppelt aus', async () => {
    const onClick = vi.fn(() => ({ busyLabel: 'Lade...' }));
    zeige({ duration: 0, action: { label: 'Jetzt aktualisieren', onClick } });
    const taste = screen.getByTestId('toast-action');
    expect(taste).toHaveTextContent('Jetzt aktualisieren');
    fireEvent.click(taste);
    fireEvent.click(taste);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeInTheDocument(); // steht noch
    expect(screen.getByTestId('toast-action')).toBeDisabled();
    expect(screen.getByTestId('toast-action')).toHaveTextContent('Lade...');
    expect(screen.getByTestId('toast-action')).toHaveAttribute('aria-busy', 'true');
  });

  it('Satz statt Arbeitsanzeige: bei `note` bleibt der Hinweis stehen und nennt den Grund; die Taste bleibt bedienbar, nichts wirkt gesperrt', async () => {
    const onClick = vi.fn(() => ({ note: 'Dieses Gerät ist Hallen-Lautsprecher.' }));
    zeige({ duration: 0, action: { label: 'Jetzt aktualisieren', onClick } });
    fireEvent.click(screen.getByTestId('toast-action'));
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByTestId('toast-action-note')).toHaveTextContent('Hallen-Lautsprecher');
    expect(screen.getByTestId('toast-action')).toBeEnabled();
    expect(screen.getByTestId('toast-action')).toHaveTextContent('Jetzt aktualisieren');
  });

  it('Gegenbeispiel: eine Aktion ohne Rückgabe (alle bisherigen Hinweise) schließt den Hinweis wie bisher', async () => {
    const onClick = vi.fn();
    zeige({ duration: 0, action: { label: 'Rückgängig', onClick } });
    fireEvent.click(screen.getByTestId('toast-action'));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('feste Kennung: derselbe Hinweis steht nur einmal da, auch wenn er mehrfach geöffnet wird', () => {
    zeige({ id: 'app-veraltet', duration: 0, action: { label: 'Jetzt aktualisieren', onClick: vi.fn() } }, 3);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('Gegenbeispiel: ohne feste Kennung stapeln sich gleiche Hinweise (Bestand)', () => {
    zeige({ duration: 0 }, 3);
    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });
});
