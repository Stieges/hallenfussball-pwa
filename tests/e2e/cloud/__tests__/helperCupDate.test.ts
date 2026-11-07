import { describe, expect, it } from 'vitest';
import { localDateIso } from '../../../../src/core/view/time';
import { CLOUD_RUN_MAX_MS, helperCodeCutoffMs, helperJoinCupDate } from '../helperCupDate';

// Säen kurz vor Mitternacht deutscher Zeit (Lauf 42308242655: gesät 23:58, Helfer-Tests ab 00:00 → „Dieser Code ist abgelaufen“).
const SEED_TIMES: ReadonlyArray<readonly [string, string]> = [
  ['Winterzeit, 23:58 in Berlin', '2026-11-06T22:58:10Z'],
  ['Winterzeit, 23:59:59 in Berlin', '2026-11-06T22:59:59Z'],
  ['Sommerzeit, 23:59 in Berlin', '2026-07-01T21:59:00Z'],
  ['vor der Zeitumstellung im Frühjahr, 23:59 in Berlin', '2026-03-28T22:59:00Z'],
  ['vor der Zeitumstellung im Herbst, 23:59 in Berlin', '2026-10-24T21:59:00Z'],
  ['mittags', '2026-11-06T11:00:00Z'],
];

describe('helperCodeCutoffMs: Ende des Helfer-Codes wie helper_code_cutoff (20261110_008, @HE-010)', () => {
  it('Winterzeit: Turniertag 6.11. endet um 0:00 des 7.11. in Berlin = 23:00 UTC', () => {
    expect(helperCodeCutoffMs('2026-11-06')).toBe(Date.parse('2026-11-06T23:00:00Z'));
  });

  it('Sommerzeit: Turniertag 1.7. endet um 0:00 des 2.7. in Berlin = 22:00 UTC', () => {
    expect(helperCodeCutoffMs('2026-07-01')).toBe(Date.parse('2026-07-01T22:00:00Z'));
  });

  it('Tag der Umstellung im Herbst (25.10.): Ende um 0:00 des 26.10. in Winterzeit = 23:00 UTC', () => {
    expect(helperCodeCutoffMs('2026-10-25')).toBe(Date.parse('2026-10-25T23:00:00Z'));
  });
});

describe('helperJoinCupDate: der Helfer-Code der gesäten Helfer-Cups läuft während eines Laufs nie ab', () => {
  it.each(SEED_TIMES)('%s: Code gilt nach dem Säen noch länger als ein ganzer Lauf', (_label, seedIso) => {
    const seedNow = Date.parse(seedIso);
    expect(helperCodeCutoffMs(helperJoinCupDate(seedNow)) - seedNow).toBeGreaterThan(CLOUD_RUN_MAX_MS);
  });

  it('der Turniertag ist der Folgetag in Berlin, unabhängig von der Uhrzeit des Säens', () => {
    expect(helperJoinCupDate(Date.parse('2026-11-06T22:59:59Z'))).toBe('2026-11-07');
    expect(helperJoinCupDate(Date.parse('2026-11-06T23:00:00Z'))).toBe('2026-11-08');
    expect(helperJoinCupDate(Date.parse('2026-11-06T11:00:00Z'))).toBe('2026-11-07');
    expect(helperJoinCupDate(Date.parse('2026-03-28T22:59:00Z'))).toBe('2026-03-29'); // Nacht der Umstellung (23 Stunden)
  });

  it('Gegenbeispiel (bisheriger Seed): Turniertag „heute“ um 23:58 – der Code läuft nach 2 Minuten ab, mitten im Lauf', () => {
    const seedNow = Date.parse('2026-11-06T22:58:10Z');
    expect(helperCodeCutoffMs(localDateIso(new Date(seedNow))) - seedNow).toBeLessThan(CLOUD_RUN_MAX_MS);
  });
});
