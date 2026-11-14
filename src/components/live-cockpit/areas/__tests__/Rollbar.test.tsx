/**
 * Rollbar: nur eine Fläche, die wirklich rollt, ist mit der Tastatur erreichbar (WCAG 2.1.1, axe `scrollable-region-focusable`).
 * Szenario: @SL-215 (Karte über „Weiter“ macht den Inhalt höher), @SL-206.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Rollbar } from '../Rollbar';

function mass(hoehe: number, sichtbar: number): void {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(hoehe);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(sichtbar);
}

afterEach(() => { vi.restoreAllMocks(); });

describe('Rollbar', () => {
  it('@SL-215 rollt die Fläche (Inhalt höher als sichtbar), steht sie in der Tab-Reihenfolge', () => {
    mass(700, 500);
    render(<Rollbar als="main" testId="flaeche">inhalt</Rollbar>);
    expect(screen.getByTestId('flaeche')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('flaeche').tagName).toBe('MAIN');
  });

  it('Gegenbeispiel: passt der Inhalt, bleibt die Tab-Reihenfolge wie bisher (kein Tabstopp)', () => {
    mass(500, 500);
    render(<Rollbar als="div" testId="flaeche">inhalt</Rollbar>);
    expect(screen.getByTestId('flaeche')).not.toHaveAttribute('tabindex');
  });

  it('ein Bildpunkt Rundungsunterschied zählt nicht als Rollen', () => {
    mass(501, 500);
    render(<Rollbar als="div" testId="flaeche">inhalt</Rollbar>);
    expect(screen.getByTestId('flaeche')).not.toHaveAttribute('tabindex');
  });

  it('keine weiche Kante und keine Marke dafür: eine Rollfläche blendet nie Tasten oder Text aus (VISUAL-DESIGN Regel 1)', () => {
    mass(700, 500);
    render(<Rollbar als="div" testId="flaeche">inhalt</Rollbar>);
    expect(screen.getByTestId('flaeche')).not.toHaveAttribute('data-rollt-viel');
    expect(screen.getByTestId('flaeche').style.maskImage ?? '').toBe('');
  });
});
