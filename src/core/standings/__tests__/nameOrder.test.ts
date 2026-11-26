/**
 * Task 1 „Tabellen sortieren“: Namensregel DIN 5007-2 (Ö wie Oe), Record `2026-11-25_tabellen-sortieren`.
 */
import { describe, expect, it } from 'vitest';
import { compareNames } from '../nameOrder';

const sortiert = (namen: string[]): string[] => [...namen].sort(compareNames);

describe('compareNames (DIN 5007-2)', () => {
  it('@TS-007 deutsche Schreibweise, ganzer Name, Groß/Klein egal', () => {
    expect(sortiert(['SV Österberg', 'FC Zell', 'sc Nord', 'SV Oberau'])).toEqual(['FC Zell', 'sc Nord', 'SV Oberau', 'SV Österberg']);
  });

  it('@TS-008 „SV Ölberg“ steht vor „SV Ofenbach“ (Ö wie Oe)', () => {
    expect(compareNames('SV Ölberg', 'SV Ofenbach')).toBeLessThan(0);
    expect(sortiert(['SV Ofenbach', 'SV Ölberg'])).toEqual(['SV Ölberg', 'SV Ofenbach']);
  });

  it('@TS-008 „SV Röthenbach“ und „SV Roethenbach“ sind gleich (0), der Platz entscheidet', () => {
    expect(compareNames('SV Röthenbach', 'SV Roethenbach')).toBe(0);
  });

  it('@TS-008 ä, ü, ß und Großbuchstaben: Ä=Ae, Ü=Ue, ß=ss', () => {
    expect(compareNames('Äpfel', 'Aepfel')).toBe(0);
    expect(compareNames('ÜBER', 'ueber')).toBe(0);
    expect(compareNames('Straße', 'Strasse')).toBe(0);
    expect(compareNames('Ärger', 'Aeger')).toBeGreaterThan(0);
  });

  it('@TS-008 zerlegtes Ö (O + Trema, wie macOS es liefert) sortiert wie Oe', () => {
    const zerlegt = 'SV O\u0308lberg';
    expect(compareNames(zerlegt, 'SV Ofenbach')).toBeLessThan(0);
    expect(compareNames(zerlegt, 'SV Oelberg')).toBe(0);
  });
});
