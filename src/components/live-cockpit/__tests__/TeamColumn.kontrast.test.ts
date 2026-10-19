/** @SL-061 Tor-Knopf (VISUAL-DESIGN § 5): Schrift „auf Primär“ auf der vollen Primärfläche mindestens 4,5 : 1, hell, dunkel und hoher Kontrast. */
import { describe, it, expect } from 'vitest';
import { contrastRatio, MIN_TEXT_CONTRAST, resolveToken, type ThemeName } from '../../../test/contrast';

const THEMEN: ThemeName[] = ['light', 'dark', 'high-contrast'];

describe('Tor-Knopf der Team-Spalte: Kontrast', () => {
  it.each(THEMEN)('%s: „auf Primär“ auf Primär ≥ 4,5 : 1', (theme) => {
    const fläche = resolveToken(theme, 'var(--color-primary)');
    const schrift = resolveToken(theme, 'var(--color-on-primary)');
    expect(contrastRatio(schrift, fläche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('Gegenbeispiel: die Schriftfarbe der normalen Knöpfe auf der Primärfläche wäre zu schwach (Messung greift)', () => {
    const fläche = resolveToken('light', 'var(--color-primary)');
    const schwach = resolveToken('light', 'var(--color-text-muted)');
    expect(contrastRatio(schwach, fläche)).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});
