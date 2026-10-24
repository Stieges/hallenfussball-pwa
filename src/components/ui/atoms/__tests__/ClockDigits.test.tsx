/**
 * ClockDigits (@SL-179): der Doppelpunkt der Uhr liegt auf einer festen Achse – Minuten links, Sekunden rechts davon, gleich viel Platz zu beiden Seiten.
 * Die Messung am Bild (≤ 1 px unter dem Doppelpunkt der Kästen) macht Playwright (`cockpit-tafel-masse.spec.ts`); hier die Struktur.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClockDigits } from '../ClockDigits';

describe('ClockDigits', () => {
  it.each(['9:26', '12:05', '0:07', '10:00'])('„%s“ steht als Minuten | Doppelpunkt | Sekunden mit dem Text unverändert', (text) => {
    render(<ClockDigits text={text} testId="uhr" />);
    expect(screen.getByTestId('uhr')).toHaveTextContent(text);
    const [min, sek] = text.split(':');
    const wurzel = screen.getByTestId('uhr');
    expect(wurzel.children).toHaveLength(3);
    expect(wurzel.children[0]).toHaveTextContent(min);
    expect(wurzel.children[1]).toHaveTextContent(':');
    expect(wurzel.children[2]).toHaveTextContent(sek);
  });

  it('die Achse: zwei gleich breite Spalten um den Doppelpunkt, Minuten rechtsbündig, Sekunden linksbündig – unabhängig von der Stellenzahl', () => {
    render(<ClockDigits text="12:05" testId="uhr" />);
    const wurzel = screen.getByTestId('uhr');
    expect(wurzel).toHaveStyle({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' });
    expect(wurzel.children[0]).toHaveStyle({ justifySelf: 'end' });
    expect(wurzel.children[2]).toHaveStyle({ justifySelf: 'start' });
  });

  it('trägt die Marke der Ziffern-Messung (cockpit.ziffern, @SL-178)', () => {
    render(<ClockDigits text="9:26" testId="uhr" />);
    expect(screen.getByTestId('uhr')).toHaveAttribute('data-ziffern', 'uhr');
  });

  it('Gegenbeispiel: Text ohne „m:ss“ (etwa „–“) erscheint unverändert, ohne Raster', () => {
    render(<ClockDigits text="–" testId="uhr" />);
    expect(screen.getByTestId('uhr')).toHaveTextContent('–');
    expect(screen.getByTestId('uhr').children).toHaveLength(0);
  });
});
