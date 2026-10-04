import { describe, it, expect } from 'vitest';
import { selectDisplayableSlides, SPIELPLAN_FALLBACK_SLIDE } from './slideProgramme';

describe('selectDisplayableSlides – Spielplan-Rückfall (F11)', () => {
  it('liefert den Spielplan-Rückfall, wenn nichts Darstellbares übrig ist und kein QR möglich ist', () => {
    const result = selectDisplayableSlides([{ id: 'alt', type: 'altbestand' }], { qrMoeglich: false });
    expect(result).toEqual([SPIELPLAN_FALLBACK_SLIDE]);
  });
});
