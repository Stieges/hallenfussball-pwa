/**
 * Aufgabe 1.1 (Spielanzeige), RF5: Schrift im Abzeichen ≥ 4,5 : 1 auf der Abzeichen-Fläche in allen Themes,
 * Live-Fläche und Rahmen des Verlängerungs-Abzeichens ≥ 3 : 1 zum Hintergrund (@OB-066).
 * Die Farbpaare sind die, die `MatchStatusBadge` aus `cssVars` bezieht (siehe `badgeColors`).
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, MIN_TEXT_CONTRAST, MIN_UI_CONTRAST, over, resolveToken, type ThemeName } from '../../../../test/contrast';
import { badgeColors } from '../matchStatusBadgeStyle';
import type { MatchBadgeState } from '../../../../core/view/badge';

const THEMES: ThemeName[] = ['dark', 'light', 'high-contrast'];
const STATES: MatchBadgeState[] = ['live', 'pause', 'halftime', 'overtime', 'shootout', 'ended', 'cancelled'];

function resolved(theme: ThemeName, value: string): string {
  return resolveToken(theme, value);
}

describe('MatchStatusBadge Kontrast', () => {
  it.each(THEMES.flatMap((t) => STATES.map((s) => [t, s] as const)))('@OB-066 %s · %s: Schrift ≥ 4,5 : 1 auf der Fläche', (theme, state) => {
    const background = resolved(theme, 'var(--color-background)');
    const colors = badgeColors(state);
    const flaeche = over(resolved(theme, colors.bg), background);
    expect(contrastRatio(resolved(theme, colors.fg), flaeche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(THEMES)('@OB-039 %s: die Live-Fläche hebt sich vom Hintergrund ab (≥ 3 : 1)', (theme) => {
    const background = resolved(theme, 'var(--color-background)');
    expect(contrastRatio(resolved(theme, badgeColors('live').bg), background)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it.each(THEMES)('@OB-066 %s: Verlängerung und Strafstoßschießen tragen einen Rahmen ≥ 3 : 1 (Fläche allein trägt sie nicht)', (theme) => {
    const background = resolved(theme, 'var(--color-background)');
    const border = badgeColors('overtime').border;
    expect(border).toBeDefined();
    expect(contrastRatio(resolved(theme, border ?? ''), background)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });
});
