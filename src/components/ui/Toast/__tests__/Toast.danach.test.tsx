/**
 * @OB-087 Taste am Hinweis (Toast), nachträglicher Zustand und Neuöffnen:
 * - `busyLabel` mit `danach`: sobald das Versprechen erfüllt ist, gilt dessen Ergebnis – `note` gibt die Taste frei und nennt den Satz („Neue Fassung ist noch nicht da …“);
 *   ein neuer Tipp beginnt von vorn. Ohne `danach` bleibt die Taste, wie sie war (Gegenbeispiel).
 * - Ein Hinweis mit fester Kennung, der gerade ausblendet (300 ms), wird von einem neuen Hinweis mit derselben Kennung ersetzt statt verworfen.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ToastProvider, useToast, type ToastOptions } from '../ToastContext';
import type { ToastActionResult } from '../Toast';

function Ausloeser({ optionen, text = 'App aktualisieren' }: { optionen: ToastOptions; text?: string }) {
  const { showWarning } = useToast();
  return <button type="button" data-testid="zeige" onClick={() => { showWarning(text, optionen); }}>zeige</button>;
}
const zeige = (optionen: ToastOptions, text?: string) => {
  const r = render(<ToastProvider><Ausloeser optionen={optionen} text={text} /></ToastProvider>);
  fireEvent.click(screen.getByTestId('zeige'));
  return r;
};

beforeAll(async () => { await initRealDeI18n(); });

describe('@OB-087 Toast: nachträglicher Zustand (`danach`)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('nach der Frist meldet der Hinweis den Satz, die Taste ist wieder frei; ein neuer Tipp zeigt wieder die Arbeitsanzeige', async () => {
    let frist: (r: ToastActionResult) => void = () => undefined;
    const onClick = vi.fn((): ToastActionResult => ({ busyLabel: 'Lade...', danach: new Promise<ToastActionResult>((ok) => { frist = ok; }) }));
    zeige({ duration: 0, action: { label: 'Jetzt aktualisieren', onClick } });
    fireEvent.click(screen.getByTestId('toast-action'));
    expect(screen.getByTestId('toast-action')).toBeDisabled();
    expect(screen.getByTestId('toast-action')).toHaveTextContent('Lade...');
    expect(screen.queryByTestId('toast-action-note')).toBeNull();
    await act(async () => { frist({ note: 'Neue Fassung ist noch nicht da – bitte gleich noch einmal tippen.' }); });
    expect(screen.getByTestId('toast-action-note')).toHaveTextContent('Neue Fassung ist noch nicht da');
    expect(screen.getByTestId('toast-action')).toBeEnabled();
    expect(screen.getByTestId('toast-action')).toHaveTextContent('Jetzt aktualisieren');
    expect(screen.getByRole('alert')).toBeInTheDocument(); // der Hinweis bleibt stehen

    fireEvent.click(screen.getByTestId('toast-action')); // neuer Versuch
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('toast-action')).toBeDisabled();
    expect(screen.queryByTestId('toast-action-note')).toBeNull();
  });

  it('Gegenbeispiel: ohne `danach` bleibt die Taste gesperrt, auch nach langer Zeit (Bestand)', async () => {
    zeige({ duration: 0, action: { label: 'Jetzt aktualisieren', onClick: () => ({ busyLabel: 'Lade...' }) } });
    fireEvent.click(screen.getByTestId('toast-action'));
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
    expect(screen.getByTestId('toast-action')).toBeDisabled();
    expect(screen.queryByTestId('toast-action-note')).toBeNull();
  });

  it('ist der Hinweis zur Frist schon geschlossen, passiert nichts (kein Fehler, nichts bleibt zurück)', async () => {
    let frist: (r: ToastActionResult) => void = () => undefined;
    zeige({ duration: 0, action: { label: 'Jetzt aktualisieren', onClick: () => ({ busyLabel: 'Lade...', danach: new Promise<ToastActionResult>((ok) => { frist = ok; }) }) } });
    fireEvent.click(screen.getByTestId('toast-action'));
    fireEvent.click(screen.getByLabelText('Hinweis schließen'));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => { frist({ note: 'zu spät' }); });
    expect(screen.queryByTestId('toast-action-note')).toBeNull();
  });
});

describe('@OB-087 Toast: derselbe feste Hinweis während der Ausblendzeit', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ein neuer Hinweis mit derselben Kennung innerhalb der 300 ms Ausblendzeit geht nicht verloren', async () => {
    zeige({ id: 'app-veraltet', duration: 0, action: { label: 'Jetzt aktualisieren', onClick: vi.fn() } });
    fireEvent.click(screen.getByLabelText('Hinweis schließen')); // blendet aus
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    fireEvent.click(screen.getByTestId('zeige')); // neuer Hinweis, gleiche Kennung, mitten in der Ausblendzeit
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); // die alte Ausblendzeit ist längst um
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByTestId('toast-action')).toBeEnabled();
  });

  it('Gegenbeispiel: steht der Hinweis nicht im Ausblenden, bleibt es bei einem einzigen (feste Kennung), Arbeitsanzeige und Zustand bleiben', async () => {
    zeige({ id: 'app-veraltet', duration: 0, action: { label: 'Jetzt aktualisieren', onClick: () => ({ busyLabel: 'Lade...' }) } });
    fireEvent.click(screen.getByTestId('toast-action'));
    fireEvent.click(screen.getByTestId('zeige'));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByTestId('toast-action')).toHaveTextContent('Lade...');
  });

  it('Gegenbeispiel: ohne Neuöffnen verschwindet der geschlossene Hinweis nach der Ausblendzeit wie bisher', async () => {
    zeige({ id: 'app-veraltet', duration: 0 });
    fireEvent.click(screen.getByLabelText('Hinweis schließen'));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
