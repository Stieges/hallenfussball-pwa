/**
 * Controller-Zusatz zu H3 (Daniel: Kasten um das Ergebnis zu eng): Ziffern haben Luft im Kasten,
 * Höhe höchstens 60 % der Kastenhöhe, seitlicher Abstand mindestens eine halbe Ziffernbreite,
 * auch bei zwei Stellen. Gilt für jede Auflösung, weil die Größe aus dem Kasten (cq-Einheiten) kommt.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBox } from '../../ui/molecules/ScoreBox';
import { scoreDigitFontSize, DIGIT_HEIGHT_MAX_OF_BOX } from '../scoreDigitSize';

describe('Ziffern im Kasten haben Luft', () => {
  it('Ziffernhöhe höchstens 60 % der Kastenhöhe (Vorgabe-Token)', () => {
    expect(DIGIT_HEIGHT_MAX_OF_BOX).toBeLessThanOrEqual(0.6);
    expect(scoreDigitFontSize()).toContain(`${DIGIT_HEIGHT_MAX_OF_BOX * 100}cqh`);
  });

  it('der Kasten ist ein Größen-Container (cq-Einheiten wirken)', () => {
    const { container } = render(
      <ScoreBox score={12} fill={{ kind: 'solid', color: '#1E40AF' }} size="display" background="#0f172a" textColor="#ffffff" ariaLabel="Heim: 12" testId="box" />,
    );
    const ziffernflaeche = screen.getByTestId('box-digits').parentElement!;
    expect(ziffernflaeche.style.containerType).toBe('size');
    expect(container.textContent).toBe('12');
  });
});
