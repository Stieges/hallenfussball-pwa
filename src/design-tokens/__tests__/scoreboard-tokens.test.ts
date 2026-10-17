import { describe, it, expect } from 'vitest';
import { contrastRatio, isOpaque, over, resolveToken, MIN_TEXT_CONTRAST, MIN_UI_CONTRAST, type ThemeName } from '../../test/contrast';
import { cssVars } from '../cssVars';

const THEMES: ThemeName[] = ['dark', 'light', 'high-contrast'];

/** Meldezeile liegt auf `--tf-surface` über der Tafel (Mockup `.msg`), also gemischt, nicht die nackte Tafel. */
function meldezeileFlaeche(theme: ThemeName): string {
  return over(resolveToken(theme, 'var(--color-scoreboard-surface)'), resolveToken(theme, 'var(--color-scoreboard-bg)'));
}

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

  it.each(THEMES)('%s: Schlussphasen-Farbe der Uhr ist Violett #C4B5FD (Monitor v8) ≥ 4,5 : 1, weder Live-Rot noch Hervorhebung', (theme) => {
    const bg = resolveToken(theme, 'var(--color-scoreboard-bg)');
    const violett = resolveToken(theme, 'var(--color-scoreboard-final-phase)');
    expect(violett).toBe('#C4B5FD');
    expect(contrastRatio(violett, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(violett).not.toBe(resolveToken(theme, 'var(--color-scoreboard-live)'));
    expect(violett).not.toBe(resolveToken(theme, 'var(--color-scoreboard-highlight)'));
  });

  it.each(THEMES)('%s: Live-Rot ist nur Fläche, die Schrift darauf ist weiß (on-live) ≥ 4,5 : 1', (theme) => {
    const live = resolveToken(theme, 'var(--color-scoreboard-live)');
    expect(contrastRatio(resolveToken(theme, 'var(--color-scoreboard-on-live)'), live)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(THEMES)('%s: Schrift auf der Hervorhebung (on-highlight) ≥ 4,5 : 1', (theme) => {
    const hervorhebung = resolveToken(theme, 'var(--color-scoreboard-highlight)');
    expect(contrastRatio(resolveToken(theme, 'var(--color-scoreboard-on-highlight)'), hervorhebung)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(THEMES)('%s: Meldezeile (Fläche über der Tafel) ≥ 4,5 : 1 zur Schrift', (theme) => {
    expect(contrastRatio(resolveToken(theme, 'var(--color-notice-line-text)'), meldezeileFlaeche(theme)))
      .toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('Gegenbeispiel: die Meldezeile ist im hellen Thema dunkel, nicht die helle Fläche (--color-surface)', () => {
    expect(contrastRatio(meldezeileFlaeche('light'), resolveToken('light', 'var(--color-surface)')))
      .toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });

  it('hoher Kontrast: schwarze Fläche, gelbe Zweitschrift, weißer Rand (Entscheidung Fixrunde)', () => {
    expect(resolveToken('high-contrast', 'var(--color-scoreboard-bg)')).toBe('#000000');
    expect(resolveToken('high-contrast', 'var(--color-scoreboard-text-muted)')).toBe('#FFFF00');
    expect(resolveToken('high-contrast', 'var(--color-scoreboard-border)')).toBe('#FFFFFF');
  });

  it('cssVars kennt die Tafel-Größen (Mockup, fest in px)', () => {
    expect(cssVars.sizing.scoreboardClockCompact).toBe('var(--font-size-score-xs)');
    expect(cssVars.sizing.scoreboardClockWide).toBe('var(--font-size-score-md)');
    expect(cssVars.sizing.scoreboardScoreCompact).toBe('var(--font-size-score-sm)');
    expect(cssVars.sizing.noticeLineHeightCompact).toBe('var(--sizing-notice-line-height-compact)');
    expect(cssVars.sizing.noticeLineHeightRegular).toBe('var(--sizing-notice-line-height-regular)');
  });

  it('Gegenbeispiel: die Tafel nutzt nicht die normale Fläche (eigene Tokens, kein Alias auf surface)', () => {
    expect(resolveToken('light', 'var(--color-scoreboard-bg)')).not.toBe(resolveToken('light', 'var(--color-surface)'));
  });
});
