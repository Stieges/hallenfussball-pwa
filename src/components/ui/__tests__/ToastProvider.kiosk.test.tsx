/**
 * B-19a (@ME-003, @OB-028): Auf Kiosk-Routen erscheinen keine Toasts. Meldungen entfallen still; ohne Kiosk-Flag
 * bleibt der Toast wie bisher sichtbar.
 */
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '../Toast';

function Ausloeser() {
  const { showInfo } = useToast();
  return <button type="button" onClick={() => showInfo('Neue App-Version wird geladen')}>melden</button>;
}

describe('Toasts auf Kiosk-Routen (B-19a, @ME-003)', () => {
  it('@ME-003: auf der Kiosk-Route entsteht kein Toast', () => {
    render(<ToastProvider suppressed><Ausloeser /></ToastProvider>);
    act(() => { screen.getByRole('button', { name: 'melden' }).click(); });
    expect(screen.queryByText('Neue App-Version wird geladen')).toBeNull();
  });

  it('Gegenbeispiel: ohne Kiosk-Flag erscheint der Toast wie bisher', () => {
    render(<ToastProvider><Ausloeser /></ToastProvider>);
    act(() => { screen.getByRole('button', { name: 'melden' }).click(); });
    expect(screen.getByText('Neue App-Version wird geladen')).toBeInTheDocument();
  });
});
