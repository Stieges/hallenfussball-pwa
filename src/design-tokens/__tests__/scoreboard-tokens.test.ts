import { describe, it, expect } from 'vitest';
import { contrastRatio, isOpaque, resolveToken, MIN_TEXT_CONTRAST, MIN_UI_CONTRAST, type ThemeName } from '../../test/contrast';
import { cssVars } from '../cssVars';

const THEMES: ThemeName[] = ['dark', 'light', 'high-contrast'];

describe('Tafel-Tokens (Spec § 8.2, Entscheidung 2)', () => {
  it.each(THEMES)('%s: Tafel-Fläche ist deckend', (theme) => {
    expect(isOpaque(resolveToken(theme, 'var(--color-scoreboard-bg)'))).toBe(true);
  });

  it.each(THEMES)('%s: Schrift der Tafel ≥ 4,5 : 1, gedämpfte Schrift ≥ 4,5 : 1, Live/Hervorhebung ≥ 3 : 1', (theme) => {
    const bg = resolveToken(theme, 'var(--color-scoreboard-bg)');
    expect(contrastRatio(resolveToken(theme, 'var(--color-scoreboard-text)'), bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(resolveToken(theme, 'var(--color-scoreboard-text-muted)'), bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(resolveToken(theme, 'var(--color-scoreboard-live)'), bg)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(contrastRatio(resolveToken(theme, 'var(--color-scoreboard-highlight)'), bg)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it.each(THEMES)('%s: Schlussphasen-Farbe der Uhr (Violett, G17) ≥ 4,5 : 1 und weder Live-Rot noch Hervorhebung', (theme) => {
    const bg = resolveToken(theme, 'var(--color-scoreboard-bg)');
    const violett = resolveToken(theme, 'var(--color-scoreboard-final-phase)');
    expect(contrastRatio(violett, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(violett).not.toBe(resolveToken(theme, 'var(--color-scoreboard-live)'));
    expect(violett).not.toBe(resolveToken(theme, 'var(--color-scoreboard-highlight)'));
  });

  it.each(THEMES)('%s: Meldezeile ≥ 4,5 : 1', (theme) => {
    expect(contrastRatio(resolveToken(theme, 'var(--color-notice-line-text)'), resolveToken(theme, 'var(--color-notice-line-bg)')))
      .toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('cssVars kennt die Tafel-Größen', () => {
    expect(cssVars.sizing.scoreboardClockCompact).toBe('var(--sizing-scoreboard-clock-compact)');
    expect(cssVars.sizing.noticeLineHeight).toBe('var(--sizing-notice-line-height)');
  });

  it('Gegenbeispiel: die Tafel nutzt nicht die normale Fläche (eigene Tokens, kein Alias auf surface)', () => {
    expect(resolveToken('light', 'var(--color-scoreboard-bg)')).not.toBe(resolveToken('light', 'var(--color-surface)'));
  });
});
