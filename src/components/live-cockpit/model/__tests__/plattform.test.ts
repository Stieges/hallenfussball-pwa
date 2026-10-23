import { describe, it, expect } from 'vitest';
import { istApple } from '../plattform';

describe('istApple (Tasten-Hinweis „Cmd+Z“ statt „Strg+Z“, Plan 3.6)', () => {
  it.each(['MacIntel', 'macOS', 'iPhone', 'iPad', 'iPod'])('%s → Apple', (plattform) => {
    expect(istApple(plattform)).toBe(true);
  });
  it.each(['Win32', 'Windows', 'Linux x86_64', 'Android', ''])('Gegenbeispiel „%s“ → nicht Apple', (plattform) => {
    expect(istApple(plattform)).toBe(false);
  });
});
