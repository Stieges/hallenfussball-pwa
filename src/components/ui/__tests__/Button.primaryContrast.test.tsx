/**
 * Primär-Taste: Schrift auf Fläche mindestens 4,5 : 1 in jeder Darstellung.
 *
 * @OB-055 @OB-057 (Kontrast Text 4,5 : 1, Bedienelemente), Befund C-PRIMAER-VERLAUF-KONTRAST:
 * Die Variante `primary` lag auf einem Farbverlauf, Weiß darauf erreichte hell nur 3,23–3,77 : 1.
 * Gemessen wird am gerenderten Stil: Schrift- und Flächen-Token werden daraus gelesen und je
 * Darstellung gegen `global.css` gerechnet. Ein Verlauf als Fläche ist nicht rechenbar und fällt durch.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { MIN_TEXT_CONTRAST, contrastRatio, readThemeTokens, resolveToken, type ThemeName } from '../../../test/contrast';

function styleOf(el: HTMLElement): string {
  return el.getAttribute('style') ?? '';
}

describe('@OB-055 @OB-057 Primär-Taste: Vollfläche mit Schrift darauf', () => {
  it('Fläche ist die Vollfläche var(--color-primary), Schrift var(--color-on-primary), kein Verlauf', () => {
    render(<Button variant="primary">Weiter</Button>);
    const stil = styleOf(screen.getByRole('button'));
    expect(stil).toMatch(/background: var\(--color-primary\)/);
    expect(stil).toContain('color: var(--color-on-primary)');
    expect(stil).not.toContain('gradient');
  });

  for (const theme of ['light', 'dark', 'high-contrast'] as ThemeName[]) {
    it(`Primär-Taste ${theme}: Schrift auf Fläche mindestens 4,5 : 1`, () => {
      render(<Button variant="primary">Weiter</Button>);
      const stil = styleOf(screen.getByRole('button'));
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

  for (const theme of ['light', 'dark', 'high-contrast'] as ThemeName[]) {
    it(`Hover und Aktiv ${theme}: Schrift auf --color-primary-hover und -active mindestens 4,5 : 1`, () => {
      const tokens = readThemeTokens(theme);
      const schrift = resolveToken(theme, tokens['--color-on-primary']);
      for (const name of ['--color-primary-hover', '--color-primary-active']) {
        expect(contrastRatio(schrift, resolveToken(theme, tokens[name]))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
    });
  }
});
