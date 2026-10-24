/** Eine Regel fuer Cloud oder nur Geraet (@W1-037): jede Bedingung einzeln. */
import { describe, it, expect } from 'vitest';
import { usesCloudRepository } from '../usesCloudRepository';

describe('usesCloudRepository', () => {
  it('Konto + Supabase eingerichtet -> Cloud', () => {
    expect(usesCloudRepository({ globalRole: 'user' }, true)).toBe(true);
  });
  it('kein Nutzer -> Geraet', () => {
    expect(usesCloudRepository(null, true)).toBe(false);
  });
  it('lokaler Gast -> Geraet', () => {
    expect(usesCloudRepository({ globalRole: 'guest' }, true)).toBe(false);
  });
  it('Supabase nicht eingerichtet -> Geraet', () => {
    expect(usesCloudRepository({ globalRole: 'user' }, false)).toBe(false);
  });
});
