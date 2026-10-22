/**
 * Prüfzahl-Baustein (A-17b, @HE-001): die Zahl steht in Ziffern (Farbe trägt keine Bedeutung), `big` ist die Größe des
 * Warteschirms (`scoreSizes.sm`), `regular` die der Zeilen. Kein festes Maß, keine feste Farbe (nur Tokens).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CheckNumberBadge } from '../CheckNumberBadge';

describe('CheckNumberBadge', () => {
  it('zeigt die Zahl als Ziffern', () => {
    render(<CheckNumberBadge value={47} />);
    expect(screen.getByTestId('check-number').textContent).toBe('47');
  });

  it('big nutzt die Ergebnis-Schriftgröße, regular die Titelgröße', () => {
    const { rerender } = render(<CheckNumberBadge value={47} size="big" />);
    expect(screen.getByTestId('check-number').style.fontSize).toBe('var(--font-size-score-sm)');
    rerender(<CheckNumberBadge value={47} />);
    expect(screen.getByTestId('check-number').style.fontSize).toBe('var(--font-size-xl)');
  });

  it('Gegenbeispiel: ohne label kein role/aria-label, mit label gesprochener Text', () => {
    const { rerender } = render(<CheckNumberBadge value={47} />);
    expect(screen.getByTestId('check-number').getAttribute('aria-label')).toBeNull();
    rerender(<CheckNumberBadge value={47} label="Prüfzahl 47" />);
    expect(screen.getByRole('img', { name: 'Prüfzahl 47' })).toBeTruthy();
  });

  it('Quelltext enthält keine festen Farben und Pixelmaße', () => {
    const src = readFileSync(join(__dirname, '..', 'CheckNumberBadge.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\b\d+px\b/);
  });
});
