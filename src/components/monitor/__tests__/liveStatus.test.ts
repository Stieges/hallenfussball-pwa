/** B-44a2 Kontrast: „BEENDET“-Marke mindestens 4,5 : 1 (@ZM-140, Anzeigetafel). Echte Theme-Werte, Marke liegt auf dem Hintergrund. */
import { describe, it, expect } from 'vitest';
import { monitorThemes } from '../../../design-tokens';
import { getContrastRatio } from '../../../design-tokens/display';
import { getStatusInfo } from '../liveStatus';

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const toHex = (c: Rgb) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** Deckt eine Farbe (hex oder rgba) über einen Untergrund. */
function composite(color: string, under: string): string {
  const m = /^rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/.exec(color);
  if (!m) { return color; }
  const a = parseFloat(m[4]);
  const u = hex(under);
  return toHex([0, 1, 2].map(i => parseFloat(m[i + 1]) * a + u[i] * (1 - a)) as Rgb);
}

const STATUS_BY_THEME = {
  dark: ['FINISHED', 'NOT_STARTED', 'RUNNING', 'PAUSED'],
  light: ['FINISHED', 'NOT_STARTED', 'RUNNING', 'PAUSED'],
} as const;

describe.each(['dark', 'light'] as const)('Marken im Theme %s', (name) => {
  const theme = monitorThemes[name];
  it.each(STATUS_BY_THEME[name])('%s: Text zu Marken-Hintergrund ≥ 4,5 : 1', (status) => {
    const info = getStatusInfo(status, theme);
    const bg = composite(info.bgColor, theme.background);
    expect(getContrastRatio(composite(info.color, bg), bg)).toBeGreaterThanOrEqual(4.5);
  });
});
