/**
 * Controller-Zusatz zu H3 (Daniel: Kasten um das Ergebnis zu eng): Ziffern haben Luft im Kasten,
 * Höhe höchstens 60 % der Kastenhöhe, seitlicher Abstand mindestens eine halbe Ziffernbreite,
 * auch bei zwei Stellen. Gilt für jede Auflösung, weil die Größe aus dem Kasten (cq-Einheiten) kommt.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ScoreBlock } from '../ScoreBlock';
import { scoreDigitFontSize, DIGIT_HEIGHT_MAX_OF_BOX, DIGIT_WIDTH_MAX_OF_BOX } from '../scoreDigitSize';

describe('Ziffern im Kasten haben Luft', () => {
  it('Ziffernhöhe höchstens 60 % der Kastenhöhe (Vorgabe-Token)', () => {
    expect(DIGIT_HEIGHT_MAX_OF_BOX).toBeLessThanOrEqual(0.6);
    expect(scoreDigitFontSize()).toContain(`${DIGIT_HEIGHT_MAX_OF_BOX * 100}cqh`);
  });

  it('zwei Stellen: seitlicher Abstand ≥ eine halbe Ziffernbreite (Ziffer ≈ 0,6 em, Kasten in Bruchteilen seiner Breite)', () => {
    const f = DIGIT_WIDTH_MAX_OF_BOX; // Ziffernhöhe in Kastenbreite-Einheiten (1 em = f Kastenbreite)
    const digitEm = 0.6;
    const margin = (1 - 2 * digitEm * f) / 2; // Abstand links und rechts, in Kastenbreite
    expect(margin).toBeGreaterThanOrEqual(0.5 * digitEm * f);
    expect(scoreDigitFontSize()).toContain(`${DIGIT_WIDTH_MAX_OF_BOX * 100}cqw`);
  });

  it('der Kasten ist ein Größen-Container (cq-Einheiten wirken)', () => {
    const { container } = render(<ScoreBlock score={12} backgroundColor="#1E40AF" position="home" />);
    const block = container.querySelector<HTMLElement>('[data-position="home"]')!;
    expect(block.style.containerType).toBe('size');
    expect(container.textContent).toBe('12');
  });
});
