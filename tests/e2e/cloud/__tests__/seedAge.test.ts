import { describe, expect, it } from 'vitest';
import { isSeedTooOld, MIN_REMAINING_MS } from '../seedAge';

const DURATION_S = 600;

describe('isSeedTooOld (C3b-3a Probe 6, "Seed zu alt")', () => {
  it('frisch geseedet (60 s seit Anpfiff) ist nicht zu alt', () => {
    expect(isSeedTooOld(60_000, DURATION_S)).toBe(false);
  });

  it('knapp vor der Grenze (Restzeit genau MIN_REMAINING_MS + 1 s) ist nicht zu alt', () => {
    expect(isSeedTooOld(DURATION_S * 1000 - MIN_REMAINING_MS - 1000, DURATION_S)).toBe(false);
  });

  it('Gegenbeispiel: Restzeit genau MIN_REMAINING_MS ist zu alt', () => {
    expect(isSeedTooOld(DURATION_S * 1000 - MIN_REMAINING_MS, DURATION_S)).toBe(true);
  });

  it('Gegenbeispiel: Uhr bereits abgelaufen (61 min bei 10 min Spielzeit) ist zu alt', () => {
    expect(isSeedTooOld(61 * 60_000, DURATION_S)).toBe(true);
  });
});
