/**
 * @SL-241 die Bedingung, unter der die Spielzeit klein in die Kopfzeile der Tafel wandert: Handy UND vor dem Anpfiff (sonst nichts, auch nicht die Leibchen-Karte); jede Mutation lässt einen Test rot werden.
 */
import { describe, it, expect } from 'vitest';
import { spielzeitKlein } from '../spielzeitKlein';
import type { CockpitPhase } from '../cockpitPhase';

const phase = (zustand: CockpitPhase['zustand']): CockpitPhase => ({ zustand } as CockpitPhase);

describe('@SL-241 spielzeitKlein', () => {
  it('Handy, vor dem Anpfiff: ja (mit und ohne Leibchen-Karte)', () => {
    expect(spielzeitKlein({ isMobile: true, phase: phase('vorAnpfiff') })).toBe(true);
  });
  it('Gegenbeispiel Tablet und Laptop (kein Handy): nein, bleibt groß wie in @SL-197', () => {
    expect(spielzeitKlein({ isMobile: false, phase: phase('vorAnpfiff') })).toBe(false);
  });
  it.each(['laeuft', 'pausiert', 'halbzeitpause', 'strafstoss', 'entscheidung', 'abgepfiffen'] as const)('Gegenbeispiel %s (nach dem Anpfiff): nein, die große Uhr läuft', (zustand) => {
    expect(spielzeitKlein({ isMobile: true, phase: phase(zustand) })).toBe(false);
  });
});
