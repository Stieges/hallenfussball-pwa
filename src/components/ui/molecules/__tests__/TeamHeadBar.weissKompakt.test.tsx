/**
 * Team-Kopf und Kasten eines weißen Teams (Cockpit-Paket K4, @ZM-159 analog): Schrift nach Kontrast (≥ 4,5 : 1), am Handy und am Laptop.
 * Handy-Kopf (K5/K11, @SL-061, @OB-058): „Heim“/„Gast“ in der ersten Zeile, Name ohne Wortbruch, Weste als schmale Streifen.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamHeadBar } from '../TeamHeadBar';
import { ScoreBox } from '../ScoreBox';
import { getContrastRatio } from '../../../../design-tokens/display';

const WEISS = { kind: 'solid', color: '#FFFFFF' } as const;
const WEISS_MIT_GELB = { kind: 'vest', center: '#FFCC00', stripes: '#FFFFFF' } as const;
const NAME_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

const farbeVon = (el: HTMLElement): string => {
  const [r, g, b] = (el.style.color.match(/\d+/g) ?? []).map(Number);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

describe('K4 weißes Team: Schrift mit Kontrast', () => {
  it.each([[false], [true]])('Kopf (kompakt=%s) auf Weiß: Schrift Schwarz, Kontrast ≥ 4,5 : 1', (kompakt) => {
    render(<TeamHeadBar name="FC Teisendorf" label="Heim" fill={WEISS} kompakt={kompakt} testId="kopf" nameTestId="name" />);
    const schrift = farbeVon(screen.getByTestId('kopf'));
    expect(getContrastRatio('#FFFFFF', schrift)).toBeGreaterThanOrEqual(4.5);
  });

  it('Kasten auf Weiß: Ziffer mit Kontrast ≥ 4,5 : 1', () => {
    render(<ScoreBox score={0} fill={WEISS} size="cockpit" background="#0F172A" textColor="#FFFFFF" ariaLabel="FC Teisendorf: 0" testId="box" />);
    expect(getContrastRatio('#FFFFFF', screen.getByTestId('box').getAttribute('data-digit-color') ?? '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('K5/K11 Handy-Kopf', () => {
  it('„Heim“ steht vor dem Namen im Fluss (erste Zeile), der Name trennt nie mitten im Wort', () => {
    render(<TeamHeadBar name={NAME_50} label="Gast" fill={WEISS} kompakt testId="kopf" nameTestId="name" />);
    const kopf = screen.getByTestId('kopf');
    expect(kopf.firstElementChild).toHaveTextContent('Gast');
    expect((kopf.firstElementChild as HTMLElement).style.float).toBe('right');
    expect(screen.getByTestId('name').style.overflowWrap).toBe('normal');
    expect(screen.getByTestId('name').style.hyphens).toBe('manual');
    // Review #448 P1: die Leerzeichen stehen zwischen den Wörtern, nicht in ihnen – nur dort darf die Zeile umbrechen
    const woerter = [...screen.getByTestId('name').querySelectorAll('span')].map((w) => w.textContent ?? '');
    expect(woerter).toEqual(['Sportgemeinschaft', 'Fußballfreunde', 'Nordheim-Süd', '1921']);
    expect(screen.getByTestId('name')).toHaveTextContent(NAME_50);
  });

  it('Weste: schmale Streifen fester Breite statt eines Anteils der Fläche (der Name behält die Breite)', () => {
    render(<TeamHeadBar name="FC Teisendorf" label="Heim" fill={WEISS_MIT_GELB} kompakt bib={{ ariaLabel: 'Spiel mit Leibchen' }} testId="kopf" nameTestId="name" />);
    const kopf = screen.getByTestId('kopf');
    expect(kopf.style.backgroundImage).toContain('var(--spacing-sm)');
    expect(kopf.style.backgroundImage).not.toContain('%,');
    expect(screen.getByRole('img', { name: 'Spiel mit Leibchen' })).toBeInTheDocument();
  });

  it('@OB-058 auch am Laptop kein Wortbruch im Namen (overflow-wrap normal)', () => {
    render(<TeamHeadBar name="TSV Waging" label="Heim" fill={WEISS_MIT_GELB} breit testId="kopf" nameTestId="name" />);
    expect(screen.getByTestId('name').style.overflowWrap).toBe('normal');
  });
});
