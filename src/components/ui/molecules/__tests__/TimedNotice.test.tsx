/** Energiespar-Hinweis (@ME-006): kleiner Hinweis in einer Ecke, unten rechts (verdeckt die Kopfzeile der Live-Folie nicht). */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimedNotice } from '../TimedNotice';

describe('TimedNotice', () => {
  it('steht unten rechts, nicht oben', () => {
    render(<TimedNotice text="Hinweis" durationMs={1000} testId="n" />);
    const el = screen.getByTestId('n');
    expect(el.style.bottom).not.toBe('');
    expect(el.style.right).not.toBe('');
    expect(el.style.top).toBe('');
  });
});
