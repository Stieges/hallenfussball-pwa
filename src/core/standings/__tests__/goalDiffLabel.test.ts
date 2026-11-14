/**
 * @ZM-205 Tordifferenz mit echtem Minuszeichen (U+2212) statt Bindestrich; Plus mit „+“, null ohne Vorzeichen.
 */
import { describe, expect, it } from 'vitest';
import { goalDiffLabel } from '../goalDiffLabel';

describe('@ZM-205 Anzeige der Tordifferenz', () => {
  it('Minus steht als „−“ (U+2212), Plus als „+“, null ohne Vorzeichen', () => {
    expect(goalDiffLabel(-3)).toBe('−3');
    expect(goalDiffLabel(4)).toBe('+4');
    expect(goalDiffLabel(0)).toBe('0');
  });

  it('Gegenbeispiel: nie der Bindestrich „-“ als Vorzeichen', () => {
    expect(goalDiffLabel(-12)).not.toContain('-');
    expect(goalDiffLabel(-12)).toBe('−12');
  });
});
