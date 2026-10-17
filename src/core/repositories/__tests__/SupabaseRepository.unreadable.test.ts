/**
 * B-19b (@ME-032): Lässt sich eine empfangene Turnier-Antwort nicht abbilden, wirft `get` den Befund
 * UnreadableResponseError. Ein Abfragefehler der Datenbank bleibt RepositoryError (Rückfall ohne Netz).
 */
import { describe, expect, it, vi } from 'vitest';
import { RepositoryError, UnreadableResponseError } from '../../errors';

function chain(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select = vi.fn(self);
  obj.eq = vi.fn(self);
  obj.order = vi.fn(async () => result);
  obj.single = vi.fn(async () => result);
  return obj;
}

const tables: Record<string, unknown> = {};

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn((name: string) => tables[name]) },
}));

import { SupabaseRepository } from '../SupabaseRepository';

describe('SupabaseRepository.get – Abbilden der Antwort (B-19b, @ME-032)', () => {
  it('@ME-032: Antwort, die sich nicht abbilden lässt (Teams fehlen) → UnreadableResponseError', async () => {
    tables.tournaments = chain({ data: { id: 'tour-1' }, error: null });
    tables.teams = chain({ data: null, error: null });
    tables.matches = chain({ data: [], error: null });
    await expect(new SupabaseRepository().get('tour-1')).rejects.toBeInstanceOf(UnreadableResponseError);
  });

  it('Gegenbeispiel: Abfragefehler der Datenbank bleibt RepositoryError, nicht „unlesbar“', async () => {
    tables.tournaments = chain({ data: null, error: { message: 'Failed to fetch', code: 'PGRST000' } });
    tables.teams = chain({ data: [], error: null });
    tables.matches = chain({ data: [], error: null });
    const fehler = await new SupabaseRepository().get('tour-1').catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(RepositoryError);
    expect(fehler).not.toBeInstanceOf(UnreadableResponseError);
  });
});
