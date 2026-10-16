/**
 * NoMatchDisplay (B-44a3): keine festen Werte, kein deutscher Festtext (i18n), Maße aus Tokens.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoMatchDisplay } from '../NoMatchDisplay';
import { displayNoMatch } from '../../../design-tokens';
import de from '../../../i18n/locales/de/monitor.json';
import en from '../../../i18n/locales/en/monitor.json';

describe('NoMatchDisplay', () => {
  it('Texte kommen aus i18n (Schlüssel im Test), nicht aus Festtext', () => {
    const { container } = render(<NoMatchDisplay />);
    expect(container.textContent).toContain('liveMatch.noRunningMatch');
    expect(container.textContent).toContain('liveMatch.tablesShownMessage');
    expect(container.textContent).not.toContain('Kein laufendes Spiel');
    expect(container.textContent).not.toContain('Tabellen werden');
  });

  it('Schlüssel gibt es in Deutsch und Englisch', () => {
    expect(de.liveMatch.noRunningMatch).toBeTruthy();
    expect(en.liveMatch.noRunningMatch).toBeTruthy();
    expect(de.liveMatch.tablesShownMessage).toBeTruthy();
    expect(en.liveMatch.tablesShownMessage).toBeTruthy();
  });

  it('eine übergebene Meldung ersetzt den Titel', () => {
    render(<NoMatchDisplay message="Pause" />);
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('Schriftgrößen aus den Tokens (xl)', () => {
    render(<NoMatchDisplay size="xl" />);
    expect(screen.getByTestId('no-match-title').style.fontSize).toBe(displayNoMatch.xl.title);
    expect(screen.getByTestId('no-match-text').style.fontSize).toBe(displayNoMatch.xl.text);
    expect(screen.getByTestId('no-match-icon').style.fontSize).toBe(displayNoMatch.xl.icon);
  });
});
