/**
 * ColorDot (T5, @W3-040): reiner Anzeige-Tupfer einer Farbe. Kein Knopf, nicht fokussierbar, mit Textalternative.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { cssVars } from '../../../../design-tokens';
import { ColorDot } from '../ColorDot';

const zeige = (onParentClick = vi.fn()) => render(
  <div onClick={onParentClick}>
    <ColorDot color="#2A2576" label="Farbe für Spielplan und Aushang: Blau" testId="punkt" />
  </div>,
);

describe('ColorDot', () => {
  it('ist ein Bild mit Textalternative (role img + aria-label), kein Knopf', () => {
    zeige();
    const punkt = screen.getByTestId('punkt');
    expect(screen.getByRole('img', { name: 'Farbe für Spielplan und Aushang: Blau' })).toBe(punkt);
    expect(punkt.tagName).not.toBe('BUTTON');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('ist nicht fokussierbar (tabIndex −1, kein tabindex-Attribut)', () => {
    zeige();
    const punkt = screen.getByTestId('punkt');
    expect(punkt.tabIndex).toBe(-1);
    expect(punkt).not.toHaveAttribute('tabindex');
  });

  it('trägt die Farbe in data-accent und als Fläche', () => {
    zeige();
    const punkt = screen.getByTestId('punkt');
    expect(punkt).toHaveAttribute('data-accent', '#2A2576');
    expect(punkt).toHaveStyle({ background: '#2A2576' });
  });

  it('Kante aus dem Symbol-Token (32 px) und Rand aus dem Token, damit er auch auf hellem Grund steht', () => {
    zeige();
    const punkt = screen.getByTestId('punkt');
    expect(punkt.style.width).toBe(cssVars.iconSizes.lg);
    expect(punkt.style.height).toBe(cssVars.iconSizes.lg);
    expect(punkt.style.border).toContain(cssVars.colors.borderControl);
  });

  it('ein Klick bleibt ohne Wirkung am Tupfer selbst (kein Handler, nichts bekommt den Fokus)', () => {
    zeige();
    const punkt = screen.getByTestId('punkt');
    fireEvent.click(punkt);
    expect(document.activeElement).not.toBe(punkt);
    expect(punkt).toHaveAttribute('data-accent', '#2A2576');
  });
});
