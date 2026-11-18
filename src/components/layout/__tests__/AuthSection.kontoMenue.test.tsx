/**
 * @AN-058: Das Konto-Menü liegt deckend über der Seite und seine Einträge sind mindestens 44 Bildpunkte hoch.
 * Befund C-KONTOMENUE-DURCHSICHTIG: Hintergrund war `surface` (im dunklen Thema Weiß mit 5 % Deckkraft), die Einträge 38 px hoch.
 * Die berechnete Deckkraft im echten Browser prüft tests/e2e/auth-slow/konto-menue-an058.spec.ts; hier gilt der Vertrag des Stils.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthSection } from '../AuthSection';
import { cssVars } from '../../../design-tokens';
import { semanticColorsDark as semanticColors } from '../../../design-tokens/colors/semantic';
import { semanticColorsLight } from '../../../design-tokens/colors/semantic-light';

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'acc-1', name: 'Olli Beispiel', email: 'olli@example.test' },
    isAuthenticated: true, isGuest: false, isLoading: false, logout: vi.fn(), connectionState: 'online', reconnect: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../../../hooks/useCompactHeader', () => ({ useCompactHeader: () => true }));
vi.mock('../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));

const EINTRAEGE = ['auth-profile-button', 'auth-settings-button', 'auth-logout-button'] as const;

function oeffneMenue(): HTMLElement {
  render(<AuthSection onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />);
  fireEvent.click(screen.getByTestId('auth-avatar-button'));
  return screen.getByTestId('auth-dropdown-menu');
}

describe('@AN-058 Konto-Menü: deckend und treffbar', () => {
  it('der Hintergrund ist das deckende Token surfaceSolid, nicht die durchscheinende Fläche surface', () => {
    const menue = oeffneMenue();
    expect(menue.style.background).toBe(cssVars.colors.surfaceSolid);
    expect(menue.style.background).not.toBe(cssVars.colors.surface);
  });

  it('das deckende Token ist in beiden Themen wirklich deckend (Gegenbeispiel: surface ist es im dunklen Thema nicht)', () => {
    const alpha = (farbe: string): number => (farbe.startsWith('rgba') ? Number(farbe.replace(/.*,\s*([\d.]+)\)/, '$1')) : 1);
    expect(alpha(semanticColors.surfaceSolid)).toBe(1);
    expect(alpha(semanticColorsLight.surfaceSolid)).toBe(1);
    expect(alpha(semanticColors.surface)).toBeLessThan(1);
  });

  it.each(EINTRAEGE)('der Eintrag %s ist mindestens 44 Bildpunkte hoch', (testId) => {
    oeffneMenue();
    expect(screen.getByTestId(testId).style.minHeight).toBe(cssVars.touchTargets.minimum);
  });
});
