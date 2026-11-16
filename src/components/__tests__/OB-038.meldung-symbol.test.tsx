/**
 * @OB-038 Beispielzeile „eine kurze Meldung am Bildschirmrand (Erfolg, Fehler, Warnung, Hinweis)“ → ein gezeichnetes Symbol vor dem Text.
 * Gilt für die Meldung der App und für die des Cockpits; kein Textzeichen als Symbolersatz, das Schließen-Kreuz hat einen Namen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from '../ui/Toast/Toast';
import { Toast as CockpitToast } from '../live-cockpit/components/Toast/Toast';
import { OHNE_SYMBOLERSATZ } from '../../test/symbolText';

const noop = vi.fn();

describe('@OB-038 kurze Meldung am Bildschirmrand (Erfolg, Fehler, Warnung, Hinweis)', () => {
  it.each(['success', 'error', 'warning', 'info'] as const)('%s: ein gezeichnetes Symbol vor dem Text, kein Textzeichen', (type) => {
    render(<Toast id="t" type={type} message="Gespeichert" onDismiss={noop} duration={0} />);
    const symbol = screen.getByTestId('toast-icon');
    expect(symbol.querySelector('svg')).not.toBeNull();
    expect(symbol.textContent).toBe('');
    const meldung = screen.getByRole('alert');
    expect(meldung.textContent).toBe('Gespeichert');
    expect(meldung.textContent).not.toMatch(OHNE_SYMBOLERSATZ);
  });

  it.each(['success', 'error', 'warning', 'info'] as const)('Cockpit-Meldung %s: gezeichnetes Symbol, Schließen als Kreuz-Symbol mit Namen', (type) => {
    render(<CockpitToast toast={{ id: 't', type, message: 'Tor erfasst' }} onDismiss={noop} />);
    expect(screen.getByTestId('toast-icon').querySelector('svg')).not.toBeNull();
    const schliessen = screen.getByRole('button', { name: /dismissAriaLabel/ });
    expect(schliessen.querySelector('svg')).not.toBeNull();
    expect(schliessen.textContent).toBe('');
    expect(screen.getByText('Tor erfasst').parentElement!.textContent).not.toMatch(OHNE_SYMBOLERSATZ);
  });

  it('die vier Stufen haben vier verschiedene Zeichnungen', () => {
    const formen = (['success', 'error', 'warning', 'info'] as const).map((type) => {
      const { unmount } = render(<Toast id="t" type={type} message="x" onDismiss={noop} duration={0} />);
      const d = screen.getByTestId('toast-icon').querySelector('svg')!.innerHTML;
      unmount();
      return d;
    });
    expect(new Set(formen).size).toBe(4);
  });
});

