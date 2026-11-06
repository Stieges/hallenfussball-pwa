/**
 * Initialen im Team-Abzeichen sind lesbar, auch bei weißen und gelben Trikots (C-ZUSCHAUER-INITIALEN-WEISS, Durchsicht Z5; Farbregel
 * @ZM-159, Kontrast @OB-055): Schrift mindestens 4,5 : 1 zur Füllung, kräftiger Rand bei sehr heller oder sehr dunkler Füllung,
 * Initialen mindestens 11 px. Erwartung aus der Anforderung (Kontrast nach WCAG), nicht aus dem Code abgelesen.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamAvatar } from '../TeamAvatar';
import { contrastRatio, MIN_TEXT_CONTRAST } from '../../../test/contrast';
import { fontSizes } from '../../../design-tokens';

const zeigen = (name: string, primary: string, size: 'xs' | 'sm' = 'sm') => {
  render(<TeamAvatar team={{ name, colors: { primary, secondary: '#000000' } }} size={size} data-testid="avatar" />);
  const outer = screen.getByTestId('avatar');
  const kreis = outer.firstElementChild as HTMLElement;
  return { kreis, initialen: kreis.querySelector('div') as HTMLElement };
};

describe('Z5 Initialen im Team-Abzeichen: Schrift nach Kontrast', () => {
  it.each([
    ['weiß', '#FFFFFF'], ['gelb', '#FFEB3B'], ['Signalgelb', '#FDE047'], ['hellgrau', '#D1D5DB'], ['schwarz', '#000000'],
    ['mittelgrau', '#777777'], ['Gold', '#D69E2E'], ['Orange', '#C05621'], ['Rot', '#C53030'], ['Blau', '#2B6CB0'], ['Grün', '#2F855A'], ['Kurzform ohne Raute-Paar #fc0', '#fc0'],
  ])('%s: Schriftfarbe hat zur Füllung mindestens 4,5 : 1', (_name, fill) => {
    const { kreis } = zeigen('Team Sechs', fill);
    const fuellung = fill.length === 4 ? `#${fill[1]}${fill[1]}${fill[2]}${fill[2]}${fill[3]}${fill[3]}` : fill;
    expect(kreis.style.backgroundColor).not.toBe('');
    expect(contrastRatio(kreis.style.color, fuellung)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('weißes Trikot: weißer Kreis mit dunkler Schrift und sichtbarem Rand (2 px in kräftiger Textfarbe)', () => {
    const { kreis, initialen } = zeigen('Team Sechs', '#FFFFFF');
    expect(initialen).toHaveTextContent('TS');
    expect(kreis.style.border).toContain('2px solid');
    expect(kreis.style.border).toContain('--color-text-secondary');
  });

  it('gelbes Trikot bekommt ebenfalls den kräftigen Rand (Gelb hebt sich vom hellen Grund nicht ab)', () => {
    const { kreis } = zeigen('Gelbe Blitze', '#FFEB3B');
    expect(kreis.style.border).toContain('2px solid');
  });

  it('Gegenbeispiel: eine kräftige Mittelfarbe behält den dünnen Rand', () => {
    const { kreis } = zeigen('Rote Teufel', '#C53030');
    expect(kreis.style.border).not.toContain('2px solid');
    expect(kreis.style.border).toContain('1px solid');
  });

  it('unbekanntes Farbformat bleibt wie bisher: weiße Schrift, dünner Rand, kein Absturz', () => {
    const { kreis } = zeigen('Team Sechs', 'rgb(10, 20, 30)');
    expect(kreis.style.color).toBe('rgb(255, 255, 255)');
    expect(kreis.style.border).not.toContain('2px solid');
  });
});

describe('Z16 Initialen mindestens 11 px', () => {
  it('auch im kleinsten Abzeichen (24 px) steht die Schrift im Token „fontSizes.xs“ (0,6875 rem = 11 px)', () => {
    const { kreis } = zeigen('Team Sechs', '#2B6CB0', 'xs');
    expect(kreis.style.fontSize).toContain('--font-size-xs');
    expect(parseFloat(fontSizes.xs) * 16).toBeGreaterThanOrEqual(11);
  });

  it('Gegenbeispiel: im 32-px-Abzeichen bleibt die Schrift proportional (13 px)', () => {
    const { kreis } = zeigen('Team Sechs', '#2B6CB0', 'sm');
    expect(kreis.style.fontSize).toBe('13px');
  });
});
