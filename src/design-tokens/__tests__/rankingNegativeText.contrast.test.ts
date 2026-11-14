/**
 * @ZM-205 Negative Tordifferenz in der Tabelle: Schrift `rankingNegativeText` hat mindestens 4,5 : 1, hell wie dunkel, auf der normalen Zeilenfläche
 * UND auf der Hervorhebungsfläche `rankingHighlightBg` (halbtransparent über der Fläche). Werte aus `global.css`, nicht abgeschrieben.
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, MIN_TEXT_CONTRAST, parseColor, resolveToken, type ThemeName } from '../../test/contrast';
import { semanticColorsDark } from '../colors/semantic';
import { semanticColorsLight } from '../colors/semantic-light';

const THEMEN: ThemeName[] = ['light', 'dark'];

function ueber(vorne: string, hinten: string): string {
  const v = parseColor(vorne);
  const h = parseColor(hinten);
  const kanal = (a: number, b: number): number => Math.round(a * v.a + b * (1 - v.a));
  const hex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${hex(kanal(v.r, h.r))}${hex(kanal(v.g, h.g))}${hex(kanal(v.b, h.b))}`;
}

describe('@ZM-205 negative Tordifferenz: Kontrast der Schrift', () => {
  it.each(THEMEN)('auf der normalen Zeilenfläche mindestens 4,5 : 1 (%s)', (thema) => {
    const schrift = resolveToken(thema, 'var(--color-ranking-negative-text)');
    const flaeche = resolveToken(thema, 'var(--color-background)');
    expect(contrastRatio(schrift, flaeche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(THEMEN)('auf der Hervorhebungsfläche (rankingHighlightBg über der Fläche) mindestens 4,5 : 1 (%s)', (thema) => {
    const schrift = resolveToken(thema, 'var(--color-ranking-negative-text)');
    const grund = ueber(resolveToken(thema, 'var(--color-ranking-highlight-bg)'), resolveToken(thema, 'var(--color-background)'));
    expect(contrastRatio(schrift, grund)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(THEMEN)('Gegenbeispiel: das bisherige Fehler-Rot (`error`) schafft die Hervorhebungsfläche nicht (%s)', (thema) => {
    const fehler = resolveToken(thema, 'var(--color-error)');
    const grund = ueber(resolveToken(thema, 'var(--color-ranking-highlight-bg)'), resolveToken(thema, 'var(--color-background)'));
    expect(contrastRatio(fehler, grund)).toBeLessThan(MIN_TEXT_CONTRAST);
  });

  it('TS-Token und global.css stimmen überein', () => {
    expect(resolveToken('dark', 'var(--color-ranking-negative-text)').toLowerCase()).toBe(semanticColorsDark.rankingNegativeText.toLowerCase());
    expect(resolveToken('light', 'var(--color-ranking-negative-text)').toLowerCase()).toBe(semanticColorsLight.rankingNegativeText.toLowerCase());
  });
});
