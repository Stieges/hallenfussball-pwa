/**
 * C-HALBZEIT-NICHT-LAUFEND: „angepfiffen“ heißt laufend ODER unterbrochen (Halbzeit), @ZP-093.
 */
import { describe, it, expect } from 'vitest';
import { isMatchInProgress } from '../status';

describe('isMatchInProgress (C-HALBZEIT-NICHT-LAUFEND, @ZP-093)', () => {
  it('laufend und unterbrochen (Halbzeit) gelten als angepfiffen', () => {
    expect(isMatchInProgress('running')).toBe(true);
    expect(isMatchInProgress('paused')).toBe(true);
  });

  it('Gegenbeispiel: geplante, beendete, ausgefallene und fehlende Status gelten nicht als angepfiffen', () => {
    for (const s of ['scheduled', 'waiting', 'finished', 'skipped', undefined]) {
      expect(isMatchInProgress(s)).toBe(false);
    }
  });
});
