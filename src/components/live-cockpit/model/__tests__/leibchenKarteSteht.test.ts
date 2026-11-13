/**
 * Die Tafel richtet sich (@SL-240, @SL-241) nach dem, was von der Leibchen-Karte wirklich im Bild steht; jede Mutation lässt einen Test rot werden.
 */
import { describe, it, expect } from 'vitest';
import { leibchenKarteSteht } from '../leibchenKarteSteht';

describe('leibchenKarteSteht', () => {
  it('Leibchen nötig, nichts gewählt: die Karte steht', () => {
    expect(leibchenKarteSteht({ gewaehlt: null, nurFestlegen: false })).toBe(true);
  });
  it('Wahl getroffen: die Zeile steht', () => {
    expect(leibchenKarteSteht({ gewaehlt: { art: 'keine' }, nurFestlegen: true })).toBe(true);
  });
  it('Gegenbeispiel: kein Leibchen nötig, nichts gewählt: nur der Knopf „festlegen“, die Tafel bleibt', () => {
    expect(leibchenKarteSteht({ gewaehlt: null, nurFestlegen: true })).toBe(false);
  });
  it('Gegenbeispiel: keine Daten (kein nächstes Spiel): nein', () => {
    expect(leibchenKarteSteht(null)).toBe(false);
  });
});
