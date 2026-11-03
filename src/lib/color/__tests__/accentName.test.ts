/**
 * T5 (PDF-Paket PR 2): Farbname unter dem Tupfer in den Stammdaten (@W3-040, „Farbe nie allein“, VISUAL-DESIGN § 7).
 * Der Name kommt aus dem Farbton der Akzentfarbe; die Schlüssel stehen in `wizard:step3.graphics.accent.names`.
 */
import { describe, expect, it } from 'vitest';
import { printAccent } from '../../../design-tokens/print';
import { accentNameKey } from '../accentName';

describe('accentNameKey', () => {
  it.each([
    ['#2A2576', 'blue'], // Blau des TSV-Wappens (Beispiel @W3-040)
    ['#B09200', 'yellow'], // Gelb #FFD400, für den Druck abgedunkelt (@DR-041)
    [printAccent.fallback, 'green'], // Grün der App
    ['#B91C1C', 'red'],
    ['#C2410C', 'orange'],
    ['#7C3AED', 'purple'],
    ['#BE185D', 'pink'],
    ['#0F766E', 'teal'],
  ] as const)('%s heißt %s', (hex, key) => {
    expect(accentNameKey(hex)).toBe(key);
  });

  it('dunkles Orange ist Braun, kräftiges Orange bleibt Orange (Gegenbeispiel)', () => {
    expect(accentNameKey('#7C4A1E')).toBe('brown');
    expect(accentNameKey('#EA580C')).toBe('orange');
  });

  it('ohne Sättigung ist es Grau, egal welcher Farbton (Gegenbeispiel)', () => {
    expect(accentNameKey('#555555')).toBe('gray');
    expect(accentNameKey('#6B6B70')).toBe('gray');
  });

  it('Rot liegt über die Nullgrenze hinweg (350° und 5°)', () => {
    expect(accentNameKey('#B91C3A')).toBe('red');
    expect(accentNameKey('#B9301C')).toBe('red');
  });
});
