/**
 * NextMatchRow (Plan LT-3): Zeile „Nächstes“ neutral, mit Trikotfarb-Punkten, Leibchen-Zeichen, Vorwarnungs-Rahmen.
 * Szenarien: @SL-160 (Farbpunkte, Leibchen-Zeichen ohne Text), @SL-161 (ohne Farbe nur der Name), @SL-155/@SL-156 (Rahmen, Blinken),
 * Befund C-COCKPIT-NAECHSTES-WIE-FEHLER (keine Fehlerfarbe).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextMatchRow, type NextMatchRowProps } from '../NextMatchRow';

const basis = (extra: Partial<NextMatchRowProps> = {}): NextMatchRowProps => ({
  label: 'Nächstes:', spielText: 'Spiel 13', anstossText: 'Anstoß 15:15', leibchen: null, modus: 'normal', blinken: false, testId: 'next',
  teams: [{ name: 'TSV West', farbe: '#C62828' }, { name: 'SG Mitte', farbe: '#FFFFFF' }], ...extra,
});

describe('NextMatchRow', () => {
  it('zeigt „Nächstes:“, Spiel, beide Namen und die Anstoßzeit', () => {
    render(<NextMatchRow {...basis()} />);
    const zeile = screen.getByTestId('next');
    expect(zeile).toHaveTextContent('Nächstes:');
    expect(zeile).toHaveTextContent('Spiel 13');
    expect(zeile).toHaveTextContent('TSV West');
    expect(zeile).toHaveTextContent('SG Mitte');
    expect(zeile).toHaveTextContent('Anstoß 15:15');
  });

  it('@SL-160 Rot/Weiß: zwei Farbpunkte in der Trikotfarbe, kein Leibchen-Zeichen', () => {
    render(<NextMatchRow {...basis()} />);
    expect(screen.getByTestId('next-punkt-0').style.background).toMatch(/rgb\(198, 40, 40\)|#C62828/i);
    expect(screen.getByTestId('next-punkt-1')).toBeInTheDocument();
    expect(screen.queryByTestId('next-leibchen')).toBeNull();
  });

  it('@SL-160 Blau/Navy: Leibchen-Zeichen ohne sichtbaren Text, mit Namen für Hilfstechnik', () => {
    render(<NextMatchRow {...basis({ leibchen: { ariaLabel: 'Leibchen nötig, die Farben sind zu ähnlich' } })} />);
    const z = screen.getByRole('img', { name: 'Leibchen nötig, die Farben sind zu ähnlich' });
    expect(z).toBeInTheDocument();
    expect(z).toHaveTextContent('');
  });

  it('@SL-161 ohne Farbe vor SG Mitte: ein Farbpunkt, der Name steht trotzdem da', () => {
    render(<NextMatchRow {...basis({ teams: [{ name: 'TSV West', farbe: '#C62828' }, { name: 'SG Mitte', farbe: null }] })} />);
    expect(screen.getByTestId('next-punkt-0')).toBeInTheDocument();
    expect(screen.queryByTestId('next-punkt-1')).toBeNull();
    expect(screen.getByTestId('next')).toHaveTextContent('SG Mitte');
  });

  it('Farbpunkte sind dekorativ (aria-hidden)', () => {
    render(<NextMatchRow {...basis()} />);
    expect(screen.getByTestId('next-punkt-0')).toHaveAttribute('aria-hidden', 'true');
  });

  it('C-COCKPIT-NAECHSTES-WIE-FEHLER normal: Rahmen dünn in Randfarbe, Fläche neutral, keine Fehlerfarbe im Stil', () => {
    render(<NextMatchRow {...basis()} />);
    const stil = screen.getByTestId('next').getAttribute('style') ?? '';
    expect(stil).toContain('var(--color-border)');
    expect(stil).not.toContain('--color-error');
    expect(stil).not.toContain('--color-error-light');
    expect(screen.getByTestId('next')).toHaveAttribute('data-modus', 'normal');
  });

  it('@SL-155 Vorwarnung: Rahmen in der Warn-Rahmenfarbe, mittel breit; Fläche bleibt neutral, kein zusätzlicher Text', () => {
    const { container } = render(<NextMatchRow {...basis({ modus: 'vorwarnung' })} />);
    const stil = screen.getByTestId('next').getAttribute('style') ?? '';
    expect(stil).toContain('var(--color-next-warn-border)');
    expect(stil).toContain('2px');
    expect(stil).not.toContain('--color-error');
    expect(screen.getByTestId('next')).toHaveAttribute('data-modus', 'vorwarnung');
    expect(container.textContent).toBe(render(<NextMatchRow {...basis()} />).container.textContent);
  });

  it('@SL-155 blinken: das Attribut data-blinken ist gesetzt; Gegenbeispiel @SL-156 ohne Blinken nicht', () => {
    const { unmount } = render(<NextMatchRow {...basis({ modus: 'vorwarnung', blinken: true })} />);
    expect(screen.getByTestId('next')).toHaveAttribute('data-blinken', 'true');
    unmount();
    render(<NextMatchRow {...basis({ modus: 'vorwarnung', blinken: false })} />);
    expect(screen.getByTestId('next')).not.toHaveAttribute('data-blinken');
  });

  it('Wechsel-Countdown (LT-4): Text und Balken mit Anteil', () => {
    render(<NextMatchRow {...basis({ modus: 'wechsel', wechsel: { text: 'Wechsel in 12 s', anteil: 0.4 } })} />);
    expect(screen.getByText('Wechsel in 12 s')).toBeInTheDocument();
    expect(screen.getByTestId('next-wechsel-balken').style.transform).toBe('scaleX(0.4)');
  });
});
