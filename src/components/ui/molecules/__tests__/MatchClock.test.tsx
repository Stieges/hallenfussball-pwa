/**
 * Aufgabe 5.1a (Spielanzeige): Molekül `MatchClock` – nur Restzeit, Abschnitt klein (@OB-067, @ZM-162, @ZM-040, @OB-066).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../../test/realDeI18n';
await initRealDeI18n();

import { cssVars, displayFontSizes } from '../../../../design-tokens';
import { MatchClock } from '../MatchClock';
import type { SpectatorClock } from '../../../../core/view';

const clock = (over: Partial<SpectatorClock> = {}): SpectatorClock =>
  ({ remaining: '1:50', sectionKey: 'secondHalf', section: 2, sections: 2, stopped: false, expired: false, ...over });

describe('MatchClock', () => {
  it('@OB-067 Restzeit in Schriftstärke 800 mit gleich breiten Ziffern', () => {
    render(<MatchClock clock={clock()} size="card" />);
    const zeit = screen.getByTestId('match-clock');
    expect(zeit).toHaveTextContent('1:50');
    expect(zeit.style.fontWeight).toBe(cssVars.fontWeights.extrabold);
    expect(zeit.style.fontVariantNumeric).toBe('tabular-nums');
  });

  it('@ZM-162 nur die Restzeit: „1:50“ mit „Restzeit · 2. Halbzeit“ klein, nirgends 4:10 oder 10:10', () => {
    const { container } = render(<MatchClock clock={clock()} size="card" />);
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('2. Halbzeit');
    expect(container.textContent).toContain('Restzeit');
    expect(container.textContent).not.toMatch(/4:10|10:10/);
  });

  it('@ZM-040 angehaltene Uhr bei 2:20 in der 1. Halbzeit: „2:20“ und „1. Halbzeit“ (gedämpft markiert)', () => {
    render(<MatchClock clock={clock({ remaining: '2:20', sectionKey: 'firstHalf', section: 1, stopped: true })} size="card" />);
    expect(screen.getByTestId('match-clock')).toHaveTextContent('2:20');
    expect(screen.getByTestId('match-clock')).toHaveAttribute('data-stopped', 'true');
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('1. Halbzeit');
  });

  it('@OB-066 Pause: „Pause · Halbzeit“ mit der Pausen-Restzeit; Pause vor der Verlängerung mit eigenem Wort', () => {
    const { rerender } = render(<MatchClock clock={clock({ remaining: '1:00', sectionKey: 'halftimeBreak', section: 1 })} size="card" />);
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('Halbzeit');
    expect(screen.getByText(/^Pause/)).toBeInTheDocument();
    rerender(<MatchClock clock={clock({ remaining: '0:40', sectionKey: 'breakBeforeOvertime' })} size="card" />);
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('Pause vor der Verlängerung');
  });

  it('@OB-066 „Pause nach dem 1. von 4 Abschnitten“ und „Abschnitt 3 von 4“ mit den Zahlen', () => {
    const { rerender } = render(<MatchClock clock={clock({ remaining: '0:45', sectionKey: 'sectionBreak', section: 1, sections: 4 })} size="card" />);
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('Pause nach dem 1. von 4 Abschnitten');
    rerender(<MatchClock clock={clock({ remaining: '3:20', sectionKey: 'sectionOfN', section: 3, sections: 4 })} size="card" />);
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('Abschnitt 3 von 4');
  });

  it('@OB-066 Spielzeit abgelaufen, noch nicht abgepfiffen: 0:00 und „Spielzeit abgelaufen – Ergebnis folgt“', () => {
    render(<MatchClock clock={clock({ remaining: '0:00', expired: true })} size="card" />);
    expect(screen.getByTestId('match-clock')).toHaveTextContent('0:00');
    expect(screen.getByTestId('match-clock-expired')).toHaveTextContent('Spielzeit abgelaufen – Ergebnis folgt');
  });

  it('@OB-066 Gegenbeispiel: ohne Restzeit (Pause ohne Pausen-Daten) steht nur das Abschnittswort, keine Ziffern und kein „abgelaufen“', () => {
    render(<MatchClock clock={clock({ remaining: null, sectionKey: 'halftimeBreak' })} size="card" />);
    expect(screen.queryByTestId('match-clock')).toBeNull();
    expect(screen.queryByTestId('match-clock-expired')).toBeNull();
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('Halbzeit');
  });

  it('@OB-066 Gegenbeispiel: ohne Restzeit und ohne Abschnitt wird nichts gezeichnet', () => {
    const { container } = render(<MatchClock clock={clock({ remaining: null, sectionKey: null })} size="card" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('@OB-067 Größen: Karte in fontSizes.xl, Monitor in displayFontSizes.clockXL', () => {
    const { rerender } = render(<MatchClock clock={clock()} size="card" />);
    expect(screen.getByTestId('match-clock').style.fontSize).toBe(cssVars.fontSizes.xl);
    rerender(<MatchClock clock={clock()} size="display" />);
    expect(screen.getByTestId('match-clock').style.fontSize).toBe(displayFontSizes.clockXL);
  });
});
