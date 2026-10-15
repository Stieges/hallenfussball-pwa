/**
 * @OB-021 (B-43b2) — Das Trainer-Abzeichen ist hell und dunkel lesbar: Beschriftung gegen
 * die Abzeichen-Fläche mindestens 4,5 : 1 (aufgelöste Werte aus global.css, vorher hell 3,23 : 1).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleBadge } from '../RoleBadge';
import { contrastRatio, resolveToken, MIN_TEXT_CONTRAST, type ThemeName } from '../../../../test/contrast';

const THEMES: ThemeName[] = ['light', 'dark'];

describe('@OB-021 B-43b2 – Rollen-Abzeichen Trainer lesbar', () => {
  it.each(THEMES)('Trainer-Abzeichen im Theme %s: Beschriftung mindestens 4,5 : 1', (theme) => {
    render(<RoleBadge role="trainer" />);
    const badge = screen.getAllByText(/./).find((el) => el.style.background || el.style.backgroundColor);
    expect(badge, 'Abzeichen mit eigener Fläche').toBeDefined();
    const bg = resolveToken(theme, badge!.style.backgroundColor || badge!.style.background);
    const fg = resolveToken(theme, badge!.style.color);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('Gegenbeispiel: die alte Paarung (info + Weiß) lag hell unter 4,5 : 1', () => {
    expect(contrastRatio('#FFFFFF', resolveToken('light', 'var(--color-info)'))).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});
