/**
 * Spielanzeige 2.3 Fixrunde 2: Tokens der Spielanzeige. Anker-Test: die Hex-Werte stehen wörtlich im Gherkin
 * (@ZM-153 `#1565C0`, `#C62828`, `#0D1B4C`; @ZM-159 Abstände 44,8 / 26,3 / 25,3 gelten nur mit genau diesen Werten).
 * Ändert jemand den Token, ohne das Gherkin zu ändern, wird dieser Test rot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { palette } from '../colors/palette';
import { cssVars } from '../cssVars';

const css = readFileSync(join(__dirname, '..', '..', 'styles', 'global.css'), 'utf8');

describe('@ZM-153 Anker: Farben der Spielanzeige = Gherkin', () => {
  it.each([
    ['blue', '#1565C0'],
    ['red', '#C62828'],
    ['navy', '#0D1B4C'],
    ['black', '#000000'],
  ] as const)('@ZM-153 palette.kit.%s ist %s', (name, hex) => {
    expect(palette.kit[name]).toBe(hex);
  });

  it('@ZM-153 Gelb und Weiß sind die vorhandenen Paletten-Werte, keine Duplikate', () => {
    expect(palette.yellow[400]).toBe('#FACC15');
    expect(palette.neutral[0]).toBe('#FFFFFF');
    expect(Object.values(palette.kit)).not.toContain('#FACC15');
    expect(Object.values(palette.kit)).not.toContain('#FFFFFF');
  });

  it('Gegenbeispiel: Gast-Rot ist nicht das Fehler-Rot red[600]', () => {
    expect(palette.kit.red).not.toBe(palette.red[600]);
  });
});

describe('Größen und Deckkraft der Spielanzeige', () => {
  it('Token zeigen auf ihre CSS-Variablen, die in global.css stehen', () => {
    expect(cssVars.sizing.qrPlaceholder).toBe('var(--sizing-qr-placeholder)');
    expect(cssVars.sizing.scorePreviewWidth).toBe('var(--sizing-score-preview-width)');
    expect(cssVars.sizing.scorePreviewHeight).toBe('var(--sizing-score-preview-height)');
    expect(cssVars.opacity.disabled).toBe('var(--opacity-disabled)');
    for (const name of ['--sizing-qr-placeholder: 150px;', '--opacity-disabled: 0.5;']) {
      expect(css).toContain(name);
    }
  });

  it('Vorschau-Kästen sind aus der Primär-Touchgröße abgeleitet (112 × 84 bei 56 px)', () => {
    expect(css).toContain('--sizing-score-preview-width: calc(var(--touch-target-primary) * 2);');
    expect(css).toContain('--sizing-score-preview-height: calc(var(--touch-target-primary) * 1.5);');
    expect(css).toContain('--touch-target-primary: 56px;');
  });
});
