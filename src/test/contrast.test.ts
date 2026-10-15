/**
 * @OB-055 — Selbsttest des Kontrast-Helfers.
 * Gegenbeispiele: durchsichtige Werte gelten als nicht deckend, zu schwacher
 * Kontrast fällt durch. Ohne diese Tests könnte der Baustein-Test grün sein,
 * obwohl der Helfer nichts prüft.
 */
import { describe, it, expect } from 'vitest';
import {
  contrastRatio,
  isOpaque,
  meetsContrast,
  readThemeTokens,
  resolveToken,
  MIN_TEXT_CONTRAST,
} from './contrast';

describe('Kontrast-Helfer (@OB-055)', () => {
  it('Gegenbeispiel: ein durchsichtiger Testwert wird als nicht deckend erkannt', () => {
    expect(isOpaque('rgba(255, 255, 255, 0.08)')).toBe(false);
    expect(isOpaque('#1E293B')).toBe(true);
  });

  it('Gegenbeispiel: zu schwacher Kontrast fällt durch die Schwelle 4,5 : 1', () => {
    expect(MIN_TEXT_CONTRAST).toBe(4.5);
    expect(meetsContrast('#777777', '#7a7a7a')).toBe(false);
    expect(meetsContrast('#000000', '#FFFFFF')).toBe(true);
  });

  it('rechnet WCAG-Kontrast korrekt (Schwarz auf Weiß = 21 : 1)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('liest die Token aus global.css (dunkel: Fläche ist #1E293B)', () => {
    expect(readThemeTokens('dark')['--color-surface-elevated']).toBe('#1E293B');
  });

  it('löst das Theme hell über das Override-Block auf (Fläche #FFFFFF)', () => {
    expect(resolveToken('light', 'var(--color-surface-elevated)')).toBe('#FFFFFF');
  });
});
