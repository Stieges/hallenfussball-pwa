/**
 * Controller-Zusatz zu H3 (Daniel: Kasten um das Ergebnis zu eng): Ziffern haben Luft im Kasten,
 * Höhe höchstens 60 % der Kastenhöhe, seitlicher Abstand mindestens eine halbe Ziffernbreite,
 * auch bei zwei Stellen. Gilt für jede Auflösung, weil die Größe aus dem Kasten (cq-Einheiten) kommt.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ScoreBlock } from '../ScoreBlock';
import { scoreDigitFontSize, DIGIT_HEIGHT_MAX_OF_BOX } from '../scoreDigitSize';

describe('Ziffern im Kasten haben Luft', () => {
  it('Ziffernhöhe höchstens 60 % der Kastenhöhe (Vorgabe-Token)', () => {
    expect(DIGIT_HEIGHT_MAX_OF_BOX).toBeLessThanOrEqual(0.6);
    expect(scoreDigitFontSize()).toContain(`${DIGIT_HEIGHT_MAX_OF_BOX * 100}cqh`);
  });

  it('der Kasten ist ein Größen-Container (cq-Einheiten wirken)', () => {
    const { container } = render(<ScoreBlock score={12} backgroundColor="#1E40AF" position="home" />);
    const block = container.querySelector<HTMLElement>('[data-position="home"]')!;
    expect(block.style.containerType).toBe('size');
    expect(container.textContent).toBe('12');
  });
});
