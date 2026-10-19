/**
 * korrekturUhrstaende (B-08d): CLOCK_ADJUST-Stände. Testwerte aus @SL-011 (2. Abschnitt, 6 Minuten: 5:20 → 4:50)
 * und dem Pflichttest „echter Weg“ (clockMs = 360000 + 290000).
 */
import { describe, expect, it } from 'vitest';
import { korrekturUhrstaende } from '../zeitKorrektur';

describe('korrekturUhrstaende (B-08d)', () => {
  // 2. Abschnitt zu 6 Minuten: Abschnittsbeginn auf der Spieluhr bei 6:00, Grenze 6:00, gespielt 5:20.
  const zweiterAbschnitt = { limitClockMs: 720_000, sectionLimitMs: 360_000, sectionElapsedMs: 320_000 };

  it('@SL-011: 5:20 auf 4:50 ergibt clockMs = 360000 + 290000 und den bisherigen Stand 360000 + 320000', () => {
    expect(korrekturUhrstaende(zweiterAbschnitt, 290)).toEqual({ clockMs: 650_000, previousClockMs: 680_000 });
  });

  it('Gegenbeispiel: im ersten Abschnitt beginnt die Zählung bei 0', () => {
    const ersterAbschnitt = { limitClockMs: 360_000, sectionLimitMs: 360_000, sectionElapsedMs: 180_000 };
    expect(korrekturUhrstaende(ersterAbschnitt, 60)).toEqual({ clockMs: 60_000, previousClockMs: 180_000 });
  });
});
