/**
 * Gold der Medaillen (Review #405 M-2, VISUAL-DESIGN § 5): Rand und Symbol brauchen ≥ 3 : 1 gegen die Fläche. Das helle Thema
 * nimmt ein kräftigeres Gold (Gold-700), das dunkle bleibt `#FFD700`. Werte aus `global.css`, nicht abgeschrieben.
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, resolveToken, type ThemeName } from '../../test/contrast';
import { semanticColorsDark } from '../colors/semantic';
import { semanticColorsLight } from '../colors/semantic-light';

const MIN_NON_TEXT_CONTRAST = 3;

describe('Medaillen-Gold (Token medalGold)', () => {
  it.each(['dark', 'light'] as ThemeName[])('Gold gegen Seitenhintergrund (und helle Fläche) ≥ 3 : 1 (%s)', (theme) => {
    const gold = resolveToken(theme, 'var(--color-medal-gold)');
    // die Fläche des dunklen Themas ist halbdurchsichtig (rgba): dort gilt der Seitenhintergrund
    if (theme === 'light') {
      expect(contrastRatio(gold, resolveToken(theme, 'var(--color-surface)'))).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
    }
    expect(contrastRatio(gold, resolveToken(theme, 'var(--color-background)'))).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
  });

  it('Gegenbeispiel: das dunkle Gold #FFD700 wäre auf Weiß mit 1,4 : 1 zu schwach', () => {
    expect(contrastRatio('#FFD700', '#FFFFFF')).toBeLessThan(MIN_NON_TEXT_CONTRAST);
  });

  it.each([['dark', '#FFD700'], ['light', '#A16207']] as const)('Wert (%s) ist %s und gleich in global.css und in den TS-Token', (theme, hex) => {
    expect(resolveToken(theme, 'var(--color-medal-gold)').toLowerCase()).toBe(hex.toLowerCase());
    const ts = theme === 'dark' ? semanticColorsDark : semanticColorsLight;
    expect(ts.medalGold.toLowerCase()).toBe(hex.toLowerCase());
  });
});
