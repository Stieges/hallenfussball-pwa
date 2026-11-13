/**
 * @SL-241 die Bedingung, unter der die Spielzeit klein in die Kopfzeile der Tafel wandert: Handy UND Karte (oder Zeile) da UND vor dem Anpfiff; jede Mutation lässt einen Test rot werden.
 */
import { describe, it, expect } from 'vitest';
import { spielzeitKlein } from '../spielzeitKlein';
import type { CockpitPhase } from '../cockpitPhase';

const phase = (zustand: CockpitPhase['zustand']): CockpitPhase => ({ zustand } as CockpitPhase);

describe('@SL-241 spielzeitKlein', () => {
  it('Handy, Karte da, vor dem Anpfiff: ja', () => {
    expect(spielzeitKlein({ isMobile: true, hatLeibchenKarte: true, phase: phase('vorAnpfiff') })).toBe(true);
  });
  it('Gegenbeispiel ohne Karte: nein, die Spielzeit bleibt groß wie in @SL-197', () => {
    expect(spielzeitKlein({ isMobile: true, hatLeibchenKarte: false, phase: phase('vorAnpfiff') })).toBe(false);
  });
  it('Gegenbeispiel Tablet und Laptop (kein Handy): nein, bleibt groß', () => {
    expect(spielzeitKlein({ isMobile: false, hatLeibchenKarte: true, phase: phase('vorAnpfiff') })).toBe(false);
  });
  it.each(['laeuft', 'pausiert', 'halbzeitpause', 'strafstoss', 'entscheidung', 'abgepfiffen'] as const)('Gegenbeispiel %s (nach dem Anpfiff): nein, die große Uhr läuft', (zustand) => {
    expect(spielzeitKlein({ isMobile: true, hatLeibchenKarte: true, phase: phase(zustand) })).toBe(false);
  });
});
