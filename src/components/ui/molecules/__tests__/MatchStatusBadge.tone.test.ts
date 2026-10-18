/**
 * Aufgabe 1.2 (Spielanzeige), @OB-066: Schrift im Monitor-Abzeichen ≥ 4,5 : 1 auf der Fläche je Monitor-Theme
 * (Nachfolger der Tests „Marken im Theme“ aus `liveStatus.test.ts`); die Fläche liegt auf dem Hintergrund des Themes.
 */
import { describe, expect, it } from 'vitest';
import { monitorThemes } from '../../../../design-tokens';
import { getContrastRatio } from '../../../../design-tokens/display';
import { monitorBadgeTone } from '../matchStatusBadgeStyle';

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const toHex = (c: Rgb): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
function composite(color: string, under: string): string {
  const m = /^rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/.exec(color);
  if (!m) { return color; }
  const a = parseFloat(m[4]);
  const u = hex(under);
  return toHex([0, 1, 2].map((i) => parseFloat(m[i + 1]) * a + u[i] * (1 - a)) as Rgb);
}

describe.each(['dark', 'light'] as const)('Monitor-Abzeichen im Theme %s', (name) => {
  const theme = monitorThemes[name];
  const tone = monitorBadgeTone(theme);

  it('@OB-066 Live: Schrift auf Live-Rot ≥ 4,5 : 1', () => {
    const bg = composite(tone.liveBg, theme.background);
    expect(getContrastRatio(composite(tone.liveFg, bg), bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('@OB-066 Pause, Halbzeit, Verlängerung, Strafstoßschießen, Ende, ausgefallen: Schrift auf neutraler Fläche ≥ 4,5 : 1', () => {
    const bg = composite(tone.neutralBg, theme.background);
    expect(getContrastRatio(composite(tone.neutralFg, bg), bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('@OB-039 Gegenbeispiel: die Live-Fläche ist nicht die neutrale Fläche und nicht grün', () => {
    expect(tone.liveBg).not.toBe(tone.neutralBg);
    expect(tone.liveBg.toLowerCase()).not.toBe(theme.liveBadgeText.toLowerCase());
  });
});
