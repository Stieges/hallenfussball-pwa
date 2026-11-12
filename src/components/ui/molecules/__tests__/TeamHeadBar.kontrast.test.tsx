/**
 * Teamkopf: Name, „HEIM“/„GAST“ und Zeichen halten auf der Fläche des Kopfes mindestens 4,5 : 1 (@SL-225; Befund C-TEAMKOPF-WESTE-KONTRAST, Daniel 2026-11-12):
 * dieselbe Regel wie die Ziffer im Kasten (`fillTextColor`), für jede Leibchenfarbe (`bibColorPresets`) und jede Trikotfarbe (`wizardJerseyPresets`), mit und
 * ohne Weste, auch bei unbekannter Trikotfarbe (gestreift). Rechnerisch, nicht am Bild.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamHeadBar } from '../TeamHeadBar';
import { fillTextColor } from '../scoreBoxStyle';
import { FALLBACK_PATTERN, type BoxFill } from '../../../../core/models/scoreBoxColors';
import { bibColorPresets, wizardJerseyPresets } from '../../../../design-tokens/colors/palette';
import { getContrastRatio } from '../../../../design-tokens/display';

const BLAU = '#1565C0';
const umgerechnet = (farbe: string): string => farbe.toUpperCase();

describe('@SL-225 Schrift auf dem Teamkopf', () => {
  it.each(bibColorPresets.map((f) => [f]))('Leibchenfarbe %s (Weste über blauem Trikot): Schrift mindestens 4,5 : 1 zur Fläche', (farbe) => {
    const fill: BoxFill = { kind: 'vest', center: umgerechnet(farbe), stripes: BLAU };
    expect(getContrastRatio(fillTextColor(fill), fill.center)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(wizardJerseyPresets.map((f) => [f]))('Trikotfarbe %s ohne Weste: Schrift mindestens 4,5 : 1 zur Fläche', (farbe) => {
    expect(getContrastRatio(fillTextColor({ kind: 'solid', color: umgerechnet(farbe) }), farbe)).toBeGreaterThanOrEqual(4.5);
  });

  it('Gestreift (Trikotfarbe unbekannt): Schrift mindestens 4,5 : 1 zu beiden Grautönen', () => {
    const fill: BoxFill = { kind: 'striped', light: FALLBACK_PATTERN.light, dark: FALLBACK_PATTERN.dark };
    const text = fillTextColor(fill);
    expect(getContrastRatio(text, FALLBACK_PATTERN.light)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(text, FALLBACK_PATTERN.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('Gegenbeispiel: auf dunkler Fläche (Schwarz, Dunkelblau) steht helle Schrift, auf Gelb dunkle', () => {
    expect(fillTextColor({ kind: 'solid', color: '#000000' })).toBe('#FFFFFF');
    expect(fillTextColor({ kind: 'solid', color: '#0D1B4C' })).toBe('#FFFFFF');
    expect(fillTextColor({ kind: 'solid', color: '#FFCC00' })).toBe('#000000');
  });

  it.each([['kompakt', true], ['normal', false]])('%s: der Kopf einer gelben Weste hat EINE Fläche (Gelb), dunkle Schrift, die Streifen liegen neben dem Text, nicht darunter', (_name, kompakt) => {
    render(<TeamHeadBar name="TSV Waging 1" label="HEIM" fill={{ kind: 'vest', center: '#FFCC00', stripes: BLAU }} kompakt={kompakt} testId="kopf" nameTestId="kopfname" />);
    const kopf = screen.getByTestId('kopf');
    expect(kopf.style.color).toBe('rgb(0, 0, 0)');
    expect(kopf.style.backgroundColor).toBe('rgb(255, 204, 0)');
    if (kompakt) {
      // kein Farbverlauf mit der Trikotfarbe unter der Schrift: der Kontrast wird gegen Gelb gemessen
      expect(kopf.style.backgroundImage).toBe('');
      expect(kopf.querySelectorAll('[data-teil="streifen"]')).toHaveLength(2);
    }
  });
});
