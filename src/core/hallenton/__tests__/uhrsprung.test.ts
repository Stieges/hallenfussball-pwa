/**
 * Uhrsprung erkennen (Brief Task 4): springt die Geräteuhr (`Date.now`) gegen die stetige Uhr (`performance.now`), muss
 * neu abgeglichen und neu geplant werden – sonst liegt der Ton um den Sprung daneben (@HT-010, @HT-004).
 */
import { describe, expect, it } from 'vitest';
import { UHRSPRUNG_SCHWELLE_MS, uhrsprungMs } from '..';

describe('@HT-010 Uhrsprung erkennen: Date.now gegen performance.now', () => {
  it('@HT-010 laufen beide Uhren gleich, gibt es keinen Sprung', () => {
    expect(uhrsprungMs({ wandMs: 1_000_000, monoMs: 500 }, { wandMs: 1_010_000, monoMs: 10_500 })).toBeNull();
  });

  it('@HT-010 kleine Abweichung unter der Schwelle ist kein Sprung', () => {
    expect(uhrsprungMs({ wandMs: 0, monoMs: 0 }, { wandMs: 1000 + UHRSPRUNG_SCHWELLE_MS, monoMs: 1000 })).toBeNull();
  });

  it('@HT-010 stellt das System die Uhr 20 s vor, meldet die Erkennung den Sprung (+20 000 ms)', () => {
    expect(uhrsprungMs({ wandMs: 0, monoMs: 0 }, { wandMs: 21_000, monoMs: 1000 })).toBe(20_000);
  });

  it('@HT-010 auch ein Sprung zurück wird erkannt', () => {
    expect(uhrsprungMs({ wandMs: 100_000, monoMs: 0 }, { wandMs: 95_000, monoMs: 1000 })).toBe(-6000);
  });
});
