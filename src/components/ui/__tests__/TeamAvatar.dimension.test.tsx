/**
 * Aufgabe 3.1 (Spielanzeige): `TeamAvatar` kennt eine Größe als Token-String (`dimension`), die Vorrang vor `size` hat.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { displayFontSizes } from '../../../design-tokens';
import { TeamAvatar } from '../TeamAvatar';

describe('TeamAvatar dimension', () => {
  it('TeamAvatar dimension hat Vorrang vor size', () => {
    render(<TeamAvatar team={{ name: 'FC Nord' }} size="xxl" dimension={displayFontSizes.teamName} data-testid="av" />);
    const av = screen.getByTestId('av');
    expect(av.style.width).toBe(displayFontSizes.teamName);
    expect(av.style.height).toBe(displayFontSizes.teamName);
  });

  it('Gegenbeispiel: ohne dimension gilt size (xxl = 120 px)', () => {
    render(<TeamAvatar team={{ name: 'FC Nord' }} size="xxl" data-testid="av" />);
    expect(screen.getByTestId('av').style.width).toBe('120px');
  });

  it('Initialen bleiben mit dimension sichtbar, Schrift folgt der Größe', () => {
    render(<TeamAvatar team={{ name: 'FC Nord' }} dimension={displayFontSizes.teamName} data-testid="av" />);
    expect(screen.getByText('FN')).toBeInTheDocument();
  });
});
