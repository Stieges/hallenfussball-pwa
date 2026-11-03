/**
 * `colors.surfacePaper`: die Papierfläche ist in jedem Thema Weiß (Vorschau von Grafiken wie im Druck, PDF-Paket T5).
 * Das Token steht in beiden semantischen Dateien, in cssVars und in allen Themen von global.css.
 */
import { describe, expect, it } from 'vitest';
import { readThemeTokens } from '../../test/contrast';
import { semanticColorsDark } from '../colors/semantic';
import { semanticColorsLight } from '../colors/semantic-light';
import { cssVars } from '../cssVars';

describe('colors.surfacePaper', () => {
  it('ist im dunklen und im hellen Thema Weiß (gleich, nicht themenabhängig)', () => {
    expect(semanticColorsDark.surfacePaper).toBe('#FFFFFF');
    expect(semanticColorsLight.surfacePaper).toBe('#FFFFFF');
  });

  it('hat die CSS-Variable --color-surface-paper, und sie ist in dunkel, hell und hohem Kontrast #FFFFFF', () => {
    expect(cssVars.colors.surfacePaper).toBe('var(--color-surface-paper)');
    for (const theme of ['dark', 'light', 'high-contrast'] as const) {
      expect(readThemeTokens(theme)['--color-surface-paper']?.toUpperCase()).toBe('#FFFFFF');
    }
  });

  it('Gegenbeispiel: die Themenfläche surfaceElevated ist im dunklen Thema nicht Weiß (Papier ist keine Themenfläche)', () => {
    expect(readThemeTokens('dark')['--color-surface-elevated']).not.toBe('#FFFFFF');
  });
});
