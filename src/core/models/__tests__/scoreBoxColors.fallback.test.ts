/**
 * Fallback-Muster „Trikotfarbe unbekannt“ (@ZM-203, @ZM-204): Zielwerte des Gherkin, vom Test gemessen.
 * Ziffer weiß mit mindestens 4,5 : 1 zu BEIDEN Grautönen (@ZM-203); die beiden Grautöne unterscheiden sich mindestens 1,8 : 1 (@ZM-204,
 * Zielwert als Hypothese, hier gemessen). Das Muster ist weder Blau noch Rot noch Weiß noch Schwarz (kein Ausweichen).
 */
import { describe, expect, it } from 'vitest';
import { FALLBACK_PATTERN } from '../scoreBoxColors';
import { getContrastRatio } from '../../../design-tokens/display';
import { palette } from '../../../design-tokens/colors/palette';

describe('@ZM-203 Grautöne des Fallback-Musters', () => {
  it.each([['hell', FALLBACK_PATTERN.light], ['dunkel', FALLBACK_PATTERN.dark]])('@ZM-203 weiße Ziffer auf dem %s Ton: mindestens 4,5 : 1', (_name, ton) => {
    expect(getContrastRatio('#FFFFFF', ton)).toBeGreaterThanOrEqual(4.5);
  });

  it('@ZM-204 die beiden Grautöne unterscheiden sich messbar (mindestens 1,8 : 1)', () => {
    expect(getContrastRatio(FALLBACK_PATTERN.light, FALLBACK_PATTERN.dark)).toBeGreaterThanOrEqual(1.8);
  });

  it('@ZM-203 Gegenbeispiel: ein einziger Grauton wäre kein Muster – hell und dunkel sind verschieden', () => {
    expect(FALLBACK_PATTERN.light).not.toBe(FALLBACK_PATTERN.dark);
  });

  it('@ZM-203 weder Blau noch Rot noch Weiß noch Schwarz', () => {
    const verboten = [palette.kit.blue, palette.kit.red, palette.neutral[0], palette.kit.black];
    expect(verboten).not.toContain(FALLBACK_PATTERN.light);
    expect(verboten).not.toContain(FALLBACK_PATTERN.dark);
  });
});
