/**
 * Daumenleiste: Hauptknopf als Vollfläche mit Schrift darauf, mindestens 4,5 : 1 in jeder Darstellung.
 *
 * @OB-055 @OB-057 (Kontrast Text 4,5 : 1, Bedienelemente), Befund C-PRIMAER-VERLAUF-KONTRAST (K8 PR 3):
 * `Button` primary liegt seit #274 auf `colors.primary`/`colors.onPrimary`; der Hauptknopf der Leiste lag noch auf
 * `gradients.primary` mit `colors.background` als Schrift. Gemessen wird am gerenderten Stil wie in
 * `Button.primaryContrast.test.tsx`: ein Verlauf als Fläche ist nicht rechenbar und fällt durch.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThumbBar } from '../ThumbBar';
import { MIN_TEXT_CONTRAST, contrastRatio, readThemeTokens, resolveToken, type ThemeName } from '../../../../test/contrast';

const leiste = () => render(
  <ThumbBar
    ariaLabel="Spielsteuerung"
    layout="daumen"
    slots={[
      { art: 'aktion', label: 'Pause', icon: null, onPress: vi.fn(), rolle: 'haupt', testId: 'bar-main' },
      { art: 'aktion', label: 'Mehr', icon: null, onPress: vi.fn(), rolle: 'mehr', testId: 'bar-more' },
    ]}
  />,
);

describe('@OB-055 @OB-057 Daumenleiste: Hauptknopf als Vollfläche (C-PRIMAER-VERLAUF-KONTRAST)', () => {
  it('Fläche ist die Vollfläche var(--color-primary), Schrift var(--color-on-primary), kein Verlauf', () => {
    leiste();
    const stil = screen.getByTestId('bar-main').getAttribute('style') ?? '';
    expect(stil).toMatch(/background: var\(--color-primary\)/);
    expect(stil).toContain('color: var(--color-on-primary)');
    expect(stil).not.toContain('gradient');
  });

  for (const theme of ['light', 'dark', 'high-contrast'] as ThemeName[]) {
    it(`Hauptknopf ${theme}: Schrift auf Fläche mindestens 4,5 : 1`, () => {
      leiste();
      const stil = screen.getByTestId('bar-main').getAttribute('style') ?? '';
      const schriftToken = /(?:^|;\s*)color: var\((--color-[a-z-]+)\)/.exec(stil)?.[1];
      const flaechenToken = /background: var\((--color-[a-z-]+)\)/.exec(stil)?.[1];
      expect(flaechenToken, 'Fläche muss ein Farb-Token sein, kein Verlauf').toBeDefined();
      expect(schriftToken).toBeDefined();
      const tokens = readThemeTokens(theme);
      const schrift = resolveToken(theme, tokens[schriftToken!]);
      const flaeche = resolveToken(theme, tokens[flaechenToken!]);
      expect(contrastRatio(schrift, flaeche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
  }

  it('Gegenbeispiel: ein Nebenknopf bleibt auf der Fläche var(--color-surface) mit Schrift var(--color-text-primary)', () => {
    leiste();
    const stil = screen.getByTestId('bar-more').getAttribute('style') ?? '';
    expect(stil).toMatch(/background: var\(--color-surface\)/);
    expect(stil).toContain('color: var(--color-text-primary)');
  });
});
