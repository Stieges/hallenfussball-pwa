/**
 * Abzeichen auf der dunklen Cockpit-Tafel (Aufgabe 1.3, @OB-065 „dieselbe Farbe“, @OB-066 Wort je Zustand).
 * Nur „Ende“ und „ausgefallen“ ändern sich auf der Tafel (Schrift und Rahmen aus den Tafel-Tokens); alle übrigen
 * Zustände bleiben wie auf der Spielkarte. Ohne Angabe der Fläche gilt die App-Fläche (Spielkarte, Monitor unverändert).
 */
import { describe, expect, it } from 'vitest';
import { cssVars } from '../../../../design-tokens';
import { contrastRatio, MIN_TEXT_CONTRAST, over, resolveToken, type ThemeName } from '../../../../test/contrast';
import { badgeColorsFor, kickoffColorFor } from '../matchStatusBadgeStyle';
import type { MatchBadgeState } from '../../../../core/view/badge';

const THEMES: ThemeName[] = ['dark', 'light', 'high-contrast'];
const ALLE_ZUSTAENDE: MatchBadgeState[] = ['live', 'pause', 'halftime', 'overtime', 'shootout', 'ended', 'cancelled'];

describe('@OB-065 Abzeichen auf der Tafel: Farbe nur für Ende und ausgefallen', () => {
  it('@OB-065 (a) „Ende“ auf der Tafel trägt die Tafel-Schrift, nicht die App-Schrift', () => {
    expect(badgeColorsFor('ended', undefined, 'scoreboard').fg).toBe(cssVars.colors.scoreboardTextMuted);
    expect(badgeColorsFor('cancelled', undefined, 'scoreboard').fg).toBe(cssVars.colors.scoreboardTextMuted);
  });

  it('@OB-065 (a) Gegenbeispiel: ohne Tafel-Fläche bleibt „Ende“ auf der App-Schrift der Spielkarte', () => {
    expect(badgeColorsFor('ended', undefined, 'app').fg).toBe(cssVars.colors.textSecondary);
    expect(badgeColorsFor('ended', undefined).fg).toBe(cssVars.colors.textSecondary);
  });

  it('@OB-065 (a) „Ende“ auf der Tafel hat einen Rahmen in der Tafel-Schrift; auf der App-Fläche keinen', () => {
    expect(badgeColorsFor('ended', undefined, 'scoreboard').border).toBe(cssVars.colors.scoreboardTextMuted);
    expect(badgeColorsFor('ended', undefined, 'app').border).toBeUndefined();
  });

  it.each(['live', 'pause', 'halftime', 'overtime', 'shootout'] as const)('@OB-065 (b) %s auf der Tafel ist identisch zur Spielkarte', (state) => {
    expect(badgeColorsFor(state, undefined, 'scoreboard')).toEqual(badgeColorsFor(state, undefined, 'app'));
  });

  it('@OB-065 (b) Monitor-Farben (tone) haben Vorrang und ändern sich mit der Tafel-Fläche nicht', () => {
    const tone = { liveBg: '#111111', liveFg: '#EEEEEE', neutralBg: '#222222', neutralFg: '#DDDDDD' };
    expect(badgeColorsFor('ended', tone, 'scoreboard')).toEqual(badgeColorsFor('ended', tone, 'app'));
  });

  it.each(THEMES)('@OB-066 %s: „Ende“ auf der dunklen Tafel ≥ 4,5 : 1 zur Fläche darunter', (theme) => {
    const tafel = resolveToken(theme, cssVars.colors.scoreboardBg);
    const colors = badgeColorsFor('ended', undefined, 'scoreboard');
    const flaeche = over(resolveToken(theme, colors.bg), tafel);
    expect(contrastRatio(resolveToken(theme, colors.fg), flaeche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(THEMES.flatMap((t) => ALLE_ZUSTAENDE.map((s) => [t, s] as const)))('@OB-066 %s · %s auf der Tafel: Schrift ≥ 4,5 : 1', (theme, state) => {
    const tafel = resolveToken(theme, cssVars.colors.scoreboardBg);
    const colors = badgeColorsFor(state, undefined, 'scoreboard');
    const flaeche = over(resolveToken(theme, colors.bg), tafel);
    expect(contrastRatio(resolveToken(theme, colors.fg), flaeche)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});

describe('@OB-065 Anstoßzeit auf der Tafel: lesbar in jedem Thema', () => {
  it.each(THEMES)('@OB-066 %s: Anstoßzeit auf der dunklen Tafel ≥ 4,5 : 1', (theme) => {
    const tafel = resolveToken(theme, cssVars.colors.scoreboardBg);
    expect(contrastRatio(resolveToken(theme, kickoffColorFor('scoreboard')), tafel)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('@OB-065 Tafel: die Anstoßzeit steht in der Tafel-Schrift', () => {
    expect(kickoffColorFor('scoreboard')).toBe(cssVars.colors.scoreboardTextMuted);
  });

  it('@OB-065 Gegenbeispiel: auf der App-Fläche bleibt die Anstoßzeit in textSecondary', () => {
    expect(kickoffColorFor('app')).toBe(cssVars.colors.textSecondary);
    expect(kickoffColorFor()).toBe(cssVars.colors.textSecondary);
  });
});

describe('@OB-068 überfällig auf der Tafel: lesbar in jedem Thema', () => {
  it.each(THEMES)('@OB-068 %s: „überfällig“ auf der dunklen Tafel ≥ 4,5 : 1', (theme) => {
    const tafel = resolveToken(theme, cssVars.colors.scoreboardBg);
    expect(contrastRatio(resolveToken(theme, cssVars.colors.scoreboardHighlight), tafel)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
