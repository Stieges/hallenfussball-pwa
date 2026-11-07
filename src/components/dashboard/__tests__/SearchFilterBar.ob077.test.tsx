/**
 * @OB-077 Ein gesetzter Filter ist auch ohne Farbe erkennbar (Häkchen, fette Beschriftung, gefüllter Grund) und Vorlese-
 * Programme sagen „Läuft, gewählt“. @OB-002 Der Filter „Beendet“ gibt es im Reiter Turniere nicht (er zeigte nie etwas).
 * Befunde C-FILTER-AKTIV-UNSICHTBAR (Grund `var(--…)15` ist ungültiges CSS), C-FILTER-BEENDET-TOT.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cssVars } from '../../../design-tokens';
import { SearchFilterBar } from '../SearchFilterBar';

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

function zeige(activeFilters: Array<'running' | 'upcoming' | 'draft'>) {
  render(<SearchFilterBar searchQuery="" onSearchChange={vi.fn()} activeFilters={activeFilters} onFilterToggle={vi.fn()} />);
}

describe('@OB-077 gesetzter Filter ohne Farbe erkennbar', () => {
  it('„Läuft“ gesetzt: Häkchen, fett, gefüllter Grund; die anderen Chips nicht', () => {
    zeige(['running']);
    const laeuft = screen.getByTestId('filter-chip-running');
    const bereit = screen.getByTestId('filter-chip-upcoming');
    expect(laeuft.querySelector('svg')).not.toBeNull();
    expect(laeuft.style.fontWeight).toBe(cssVars.fontWeights.bold);
    expect(laeuft.style.background).toBe(cssVars.colors.primaryLight);
    expect(bereit.style.fontWeight).not.toBe(cssVars.fontWeights.bold);
    expect(bereit.style.background).not.toBe(cssVars.colors.primaryLight);
  });

  it('Graustufen-Probe: gesetzt und nicht gesetzt unterscheiden sich in mindestens zwei Merkmalen außer der Farbe (Gewicht, Häkchen-Symbol)', () => {
    zeige(['running']);
    const gesetzt = screen.getByTestId('filter-chip-running');
    const ungesetzt = screen.getByTestId('filter-chip-draft');
    expect(gesetzt.style.fontWeight).not.toBe(ungesetzt.style.fontWeight);
    expect(gesetzt.innerHTML).not.toBe(ungesetzt.innerHTML.replace('draft', 'running'));
    expect(gesetzt).toHaveAttribute('aria-pressed', 'true');
  });

  it('Vorlese-Programme: gesetzt heißt „<Filter>, gewählt“, nicht gesetzt nur der Name', () => {
    zeige(['running']);
    expect(screen.getByTestId('filter-chip-running')).toHaveAttribute('aria-label', 'dashboard:search.filterAriaLabelActive');
    expect(screen.getByTestId('filter-chip-upcoming')).toHaveAttribute('aria-label', 'dashboard:status.upcoming');
  });

  it('Gegenbeispiel: der Grund ist gültiges CSS, kein `var(--…)15`', () => {
    zeige(['running', 'upcoming', 'draft']);
    for (const id of ['running', 'upcoming', 'draft']) {
      expect(screen.getByTestId(`filter-chip-${id}`).style.background).not.toMatch(/\)\s*\d+$/);
    }
  });
});

describe('@OB-002 kein Filter „Beendet“ im Reiter Turniere', () => {
  it('es gibt genau drei Filter: Läuft, Bereit, Entwurf', () => {
    zeige([]);
    expect(screen.getAllByTestId(/^filter-chip-/).map((c) => c.getAttribute('data-testid'))).toEqual([
      'filter-chip-running', 'filter-chip-upcoming', 'filter-chip-draft',
    ]);
    expect(screen.queryByTestId('filter-chip-finished')).toBeNull();
  });
});
