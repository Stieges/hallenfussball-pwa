/**
 * PenaltyCard (Plan Cockpit v2 B3): @SL-186 – große Restzeit mit Etikett, Team und Nummer, Dauer und Beginn, Balken, Randstreifen in der Teamfarbe.
 * @SL-182: lange Namen brechen um, nie „…“. Testwerte aus dem Gherkin („DJK Otting, Nr. 9 · Zeitstrafe 2 Min · seit Spielzeit 3:18 · Restzeit 1:12“).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PenaltyCard } from '../PenaltyCard';

const FARBE = { kind: 'solid', color: '#2E7D32' } as const;
const fuellungIn = (container: HTMLElement): HTMLElement => {
  const element = container.querySelector<HTMLElement>('div[aria-hidden="true"] > div');
  if (!element) { throw new Error('Balken fehlt'); }
  return element;
};
const zeige = (aenderung: Partial<Parameters<typeof PenaltyCard>[0]> = {}) => render(
  <PenaltyCard testId="karte" etikett="Restzeit" rest="1:12" titel="DJK Otting, Nr. 9" unterzeile="Zeitstrafe 2 Min · seit Spielzeit 3:18" anteil={0.6} fill={FARBE} {...aenderung} />,
);

describe('PenaltyCard', () => {
  it('@SL-186 zeigt Restzeit groß mit Etikett, Team und Nummer, Dauer und Spielzeit des Beginns', () => {
    zeige();
    expect(screen.getByTestId('karte')).toHaveTextContent('Restzeit');
    expect(screen.getByTestId('karte-rest')).toHaveTextContent('1:12');
    expect(screen.getByTestId('karte-titel')).toHaveTextContent('DJK Otting, Nr. 9');
    expect(screen.getByTestId('karte')).toHaveTextContent('Zeitstrafe 2 Min · seit Spielzeit 3:18');
  });

  it('der Balken füllt sich zum Anteil, der noch zu verbüßen ist, und trägt die Warnfarbe (nie Rot)', () => {
    const { container } = zeige({ anteil: 0.6 });
    expect(screen.getByTestId('karte')).toHaveAttribute('data-anteil', '0.600');
    const fuellung = fuellungIn(container);
    expect(fuellung.style.width).toBe('60%');
    expect(fuellung.style.background).toContain('warning');
    expect(fuellung.style.background).not.toContain('error');
  });

  it('Anteile außerhalb von 0 bis 1 werden begrenzt', () => {
    const { container, unmount } = zeige({ anteil: 1.7 });
    expect(fuellungIn(container).style.width).toBe('100%');
    unmount();
    const zweite = zeige({ anteil: -0.3 });
    expect(fuellungIn(zweite.container).style.width).toBe('0%');
  });

  it('der Randstreifen trägt die Farbe des Ergebniskastens (@SL-176): einfarbig, mit Weste mit Streifen', () => {
    zeige();
    expect(screen.getByTestId('karte-streifen').style.backgroundColor).toBe('rgb(46, 125, 50)');
    const weste = render(<PenaltyCard testId="w" etikett="Restzeit" rest="0:40" titel="x" unterzeile="y" anteil={0.3} fill={{ kind: 'vest', center: '#2E7D32', stripes: '#FFFFFF' }} />);
    expect(weste.getByTestId('w-streifen').style.backgroundImage).toContain('linear-gradient');
  });

  it('@SL-182 ein langer Name steht vollständig da, bricht um und endet nie mit „…“', () => {
    const name = 'Eintracht Oberweiler-Niederstetten 1919 e. V., Nr. 9';
    zeige({ titel: name });
    const titel = screen.getByTestId('karte-titel');
    expect(titel).toHaveTextContent(name);
    expect(titel).toHaveAttribute('data-teamname');
    expect(titel.style.textOverflow).toBe('');
    expect(titel.style.whiteSpace).not.toBe('nowrap');
    expect(titel.textContent).not.toContain('…');
  });
});
