/**
 * Nächstliegender Name der Trikot-Palette zu einer beliebigen Farbe (Grund-Zeile der Karte im Endstand, „Beide spielen Blau“, @SL-215).
 */
import { describe, expect, it } from 'vitest';
import { naechsterTrikotFarbName } from '../kitChoice';
import { palette } from '../../../design-tokens/colors/palette';

describe('naechsterTrikotFarbName', () => {
  it.each([
    ['#1565C0', 'blue'], ['#C62828', 'red'], ['#2E7D32', 'green'], ['#FFEB3B', 'yellow'], ['#FF9800', 'orange'], ['#F5F5F5', 'white'], ['#212121', 'black'],
  ])('@SL-215 %s heißt %s', (hex, name) => { expect(naechsterTrikotFarbName(hex)).toBe(name); });

  it('jede Farbe der Palette heißt wie ihr eigener Schlüssel', () => {
    for (const [key, hex] of Object.entries(palette.jersey)) {
      if (key === 'neonGreen') { continue; }
      expect(naechsterTrikotFarbName(hex)).toBe(key);
    }
  });

  it('Gegenbeispiel: ohne gültige Farbe kein Name', () => {
    expect(naechsterTrikotFarbName(undefined)).toBeNull();
    expect(naechsterTrikotFarbName('keine')).toBeNull();
  });
});
