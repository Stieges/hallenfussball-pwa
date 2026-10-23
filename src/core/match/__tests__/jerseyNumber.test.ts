/** @SL-172 Eine Rückennummer ist eine ganze Zahl von 1 bis 99 (Tabelle des Szenariogrundrisses + Grenzen). */
import { describe, expect, it } from 'vitest';
import { isJerseyNumber, parseJerseyNumberInput } from '../jerseyNumber';

describe('@SL-172 parseJerseyNumberInput', () => {
  it.each([['7', 7], ['99', 99], ['1', 1], ['07', 7], [' 12 ', 12]])('%j gilt als Nummer %s', (eingabe, nummer) => {
    expect(parseJerseyNumberInput(eingabe)).toBe(nummer);
  });
  it.each([['0'], ['100'], ['7a'], ['a'], ['-3'], ['4.5'], ['1e1'], ['0x10'], ['999'], ['1000'], ['٣']])('%j wird abgewiesen', (eingabe) => {
    expect(parseJerseyNumberInput(eingabe)).toBe('ungueltig');
  });
  it('leer ist keine Eingabe, kein Fehler', () => {
    expect(parseJerseyNumberInput('')).toBeNull();
    expect(parseJerseyNumberInput('  ')).toBeNull();
  });
});

describe('@SL-172 isJerseyNumber', () => {
  it.each([[1, true], [99, true], [0, false], [100, false], [7.5, false], [Number.NaN, false], ['7', false], [undefined, false], [null, false]])('%j → %s', (wert, erwartet) => {
    expect(isJerseyNumber(wert)).toBe(erwartet);
  });
});
