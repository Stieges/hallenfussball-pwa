/**
 * @OB-089 „Und der Text im Kasten ist nach Stufe AA lesbar“, hell wie dunkel. Gemessen werden die Paare (Schrift, getönte Fläche über
 * `--color-background`), die nach der Reparatur im Bild stehen. Schrift in der Signalfarbe auf der eigenen Tönung erreicht in der hellen
 * Darstellung 4,5 : 1 nicht (Fehler 4,1; Erfolg 3,4; Info 2,9) – deshalb steht der Text in den Kästen in `--color-text-primary`, Rand und
 * Symbol tragen die Farbe (wie im Baustein `InlineNotice`).
 */
import { describe, it, expect } from 'vitest';
import { MIN_TEXT_CONTRAST, contrastRatio, over, readThemeTokens, resolveToken, type ThemeName } from '../../../test/contrast';

const PAARE: [schrift: string, flaeche: string][] = [
  ['text-primary', 'error-light'],
  ['text-primary', 'error-subtle'],
  ['text-primary', 'warning-light'],
  ['text-primary', 'warning-selected'],
  ['text-primary', 'primary-light'],
  ['text-primary', 'primary-medium'],
  ['text-primary', 'success-light'],
  ['text-primary', 'info-light'],
  ['text-primary', 'status-live-bg'],
  ['text-primary', 'status-upcoming-bg'],
  ['text-primary', 'status-finished-bg'],
  ['primary', 'primary-light'], // Zähler „in Folien“, Filterchip: Signalfarbe nur dort, wo sie 4,5 : 1 erreicht
];

describe.each(['light', 'dark'] as ThemeName[])('@OB-089 getönte Kästen %s: Text mindestens 4,5 : 1', (theme) => {
  const tokens = readThemeTokens(theme);
  const wert = (name: string): string => resolveToken(theme, tokens[`--color-${name}`]);
  it.each(PAARE)('%s auf %s', (schrift, flaeche) => {
    const grund = wert('background');
    expect(contrastRatio(wert(schrift), over(wert(flaeche), grund))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
