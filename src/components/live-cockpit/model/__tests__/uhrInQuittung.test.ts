/**
 * @SL-240 die Bedingung, unter der der Uhr-Bereich in die Quittungszeile wandert: Handy UND Endstand (sonst nichts, auch nicht die Leibchen-Karte); jede Mutation lässt einen Test rot werden.
 */
import { describe, it, expect } from 'vitest';
import { uhrInQuittung } from '../uhrInQuittung';
import type { CockpitPhase } from '../cockpitPhase';

const phase = (zustand: CockpitPhase['zustand']): CockpitPhase => ({ zustand } as CockpitPhase);

describe('@SL-240 uhrInQuittung', () => {
  it('Handy, Endstand: ja (mit und ohne Leibchen-Karte, die Bedingung kennt sie nicht)', () => {
    expect(uhrInQuittung({ isMobile: true, phase: phase('abgepfiffen') })).toBe(true);
  });
  it('Gegenbeispiel Tablet und Laptop (kein Handy): nein, der Uhr-Bereich bleibt wie in @SL-169', () => {
    expect(uhrInQuittung({ isMobile: false, phase: phase('abgepfiffen') })).toBe(false);
  });
  it.each(['vorAnpfiff', 'laeuft', 'pausiert', 'halbzeitpause', 'strafstoss', 'entscheidung'] as const)('Gegenbeispiel %s (nicht der Endstand): nein', (zustand) => {
    expect(uhrInQuittung({ isMobile: true, phase: phase(zustand) })).toBe(false);
  });
});
