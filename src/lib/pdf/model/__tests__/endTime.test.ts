import { describe, expect, it } from 'vitest';
import { roundEndTime } from '../endTime';

describe('roundEndTime (@DR-031: „Ende ca.“ auf 5 Minuten gerundet)', () => {
  it('@DR-031 Endzeit auf 5 Minuten gerundet: 15:43 → 15:45', () => {
    expect(roundEndTime('15:43')).toBe('15:45');
  });

  it('@DR-031 Endzeit auf 5 Minuten gerundet: 15:42 → 15:40', () => {
    expect(roundEndTime('15:42')).toBe('15:40');
  });

  it('@DR-031 volle Marke bleibt: 15:45 → 15:45', () => {
    expect(roundEndTime('15:45')).toBe('15:45');
  });

  it('@DR-031 Stundenwechsel: 15:58 → 16:00', () => {
    expect(roundEndTime('15:58')).toBe('16:00');
  });

  it('@DR-031 kein Runden über Mitternacht: 23:58 → 23:55', () => {
    expect(roundEndTime('23:58')).toBe('23:55');
  });

  it('@DR-031 Grenze unten: 00:02 → 00:00', () => {
    expect(roundEndTime('00:02')).toBe('00:00');
  });

  it('@DR-031 ungültige Eingabe „25:00“ wirft', () => {
    expect(() => roundEndTime('25:00')).toThrow(Error);
  });

  it('@DR-031 ungültige Eingabe „9:30“ wirft (nicht zweistellig)', () => {
    expect(() => roundEndTime('9:30')).toThrow(Error);
  });
});
