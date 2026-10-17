/**
 * Wachhalten-Hinweis (@ME-006): kleiner Hinweis oben rechts, in der Höhe der Kopfzeile (Daniel 15.10.: oben rechts statt
 * unten, weil unten die Schiedsrichter-Zeile steht).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimedNotice } from '../TimedNotice';

describe('TimedNotice', () => {
  it('steht oben rechts, nicht unten (@ME-006)', () => {
    render(<TimedNotice text="Hinweis" durationMs={1000} testId="n" />);
    const el = screen.getByTestId('n');
    expect(el.style.top).not.toBe('');
    expect(el.style.right).not.toBe('');
    expect(el.style.bottom).toBe('');
    expect(el.style.left).toBe('');
  });

  it('Gegenbeispiel: Lage und Größe kommen aus Tokens, keine festen Pixel', () => {
    render(<TimedNotice text="Hinweis" durationMs={1000} testId="n" />);
    const el = screen.getByTestId('n');
    for (const wert of [el.style.top, el.style.right, el.style.fontSize, el.style.padding]) {
      expect(wert).not.toMatch(/\d+px/);
    }
  });
});
