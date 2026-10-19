import { describe, it, expect } from 'vitest';
import { abgelaufeneStrafen } from '../penaltyExpiry';

describe('abgelaufeneStrafen (@SL-096)', () => {
  it('@SL-096 eine Strafe mit Rest ≤ 1 s, die verschwindet, ist abgelaufen', () => {
    expect(abgelaufeneStrafen([{ id: 'p1', remainingMs: 800 }], [])).toEqual(['p1']);
  });
  it('Gegenbeispiel @SL-030: verschwindet sie mit Restzeit (Gegentor, Rücknahme), ist sie nicht „abgelaufen“', () => {
    expect(abgelaufeneStrafen([{ id: 'p1', remainingMs: 45_000 }], [])).toEqual([]);
  });
  it('Gegenbeispiel: eine Strafe, die weiterläuft, ist nicht abgelaufen', () => {
    expect(abgelaufeneStrafen([{ id: 'p1', remainingMs: 800 }], [{ id: 'p1' }])).toEqual([]);
  });
});
