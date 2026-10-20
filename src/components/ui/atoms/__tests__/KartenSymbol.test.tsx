/**
 * KartenSymbol: Karten-Farben nur für Karten (Oberfläche E, Befund C-KARTE-GELB-ALS-WARNFARBE).
 * Gelb = cardYellow, Rot = cardRed, Gelb-Rot = beide diagonal geteilt, dünner Rand aus borderControl.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KartenSymbol } from '../KartenSymbol';

describe('Karten-Farben nur für Karten (Oberfläche E) – KartenSymbol', () => {
  it('Gelb zeigt cardYellow, Rot cardRed', () => {
    render(<><KartenSymbol art="YELLOW" /><KartenSymbol art="RED" /></>);
    expect(screen.getByTestId('karten-symbol-YELLOW').style.background).toContain('var(--color-card-yellow)');
    expect(screen.getByTestId('karten-symbol-RED').style.background).toContain('var(--color-card-red)');
  });

  it('Gelb-Rot zeigt beide Farben diagonal geteilt', () => {
    render(<KartenSymbol art="YELLOW_RED" />);
    const bg = screen.getByTestId('karten-symbol-YELLOW_RED').style.background;
    expect(bg).toContain('linear-gradient(135deg');
    expect(bg).toContain('var(--color-card-yellow)');
    expect(bg).toContain('var(--color-card-red)');
  });

  it('Gegenbeispiel: kein Kartensymbol nutzt warning, error oder accent; Quelle ohne feste Werte', () => {
    for (const art of ['YELLOW', 'YELLOW_RED', 'RED'] as const) {
      const { container, unmount } = render(<KartenSymbol art={art} />);
      expect(container.innerHTML).not.toMatch(/warning|error|accent/);
      unmount();
    }
    const quelle = readFileSync(resolve(process.cwd(), 'src/components/ui/atoms/KartenSymbol.tsx'), 'utf8')
      + readFileSync(resolve(process.cwd(), 'src/components/ui/atoms/kartenFlaeche.ts'), 'utf8');
    expect(quelle).not.toMatch(/#[0-9a-fA-F]{3,6}\b|colors\.(warning|error|accent)/);
  });
});
