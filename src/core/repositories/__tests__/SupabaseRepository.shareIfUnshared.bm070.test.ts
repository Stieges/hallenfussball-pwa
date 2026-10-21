/**
 * @BM-070 „… der Freigabe-Code bleibt derselbe – Aushang und QR-Code gelten weiter“ (Review CA-3–5 Auflage 2):
 * Der Teilen-Rückfall schreibt den Code des Geräts in EINER bedingten Anweisung (`share_code IS NULL`). Die Fake-Cloud wertet
 * die Filter der Anweisung aus; ohne Bedingung überschriebe das UPDATE Ollis Code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

const cloud = vi.hoisted(() => {
  const state = { row: null as Row | null, failUpdate: false };

  function builder(): Record<string, unknown> {
    const filters: Array<(row: Row) => boolean> = [];
    let patch: Row | null = null;
    let single = false;
    const self: Record<string, unknown> = {};
    const chain = (fn: (...args: never[]) => void) => (...args: never[]) => { fn(...args); return self; };
    self.update = chain((values: Row) => { patch = values; });
    self.select = chain(() => undefined);
    self.eq = chain((col: string, value: unknown) => { filters.push((r) => r[col] === value); });
    self.is = chain((col: string, value: unknown) => { filters.push((r) => r[col] === value); });
    self.maybeSingle = chain(() => { single = true; });
    self.then = (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) => {
      if (patch !== null && state.failUpdate) {
        return Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint "tournaments_share_code_key"', code: '23505' } }).then(resolve, reject);
      }
      const row = state.row;
      const hit = row !== null && filters.every((f) => f(row));
      if (patch !== null) {
        if (hit) { state.row = { ...row, ...patch }; }
        return Promise.resolve({ data: hit ? [{ id: row.id }] : [], error: null }).then(resolve, reject);
      }
      const data = hit ? { ...row } : null;
      return Promise.resolve({ data: single ? data : (data ? [data] : []), error: null }).then(resolve, reject);
    };
    return self;
  }
  return { state, client: { from: () => builder(), auth: { getUser: vi.fn() } } };
});

vi.mock('../../../lib/supabase', () => ({ supabase: cloud.client, isSupabaseConfigured: true }));

import { SupabaseRepository } from '../SupabaseRepository';
import { RepositoryError } from '../../errors';

const SHARE = { shareCode: 'MAR234', shareCodeCreatedAt: '2026-11-01T10:00:00.000Z' };

beforeEach(() => {
  cloud.state.failUpdate = false;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('@BM-070 SupabaseRepository.shareIfUnshared: Rückfall-Teilen überschreibt keinen Cloud-Code', () => {
  it('Olli hat schon geteilt (OLI234): die Zeile bleibt, Ergebnis ist der Cloud-Stand', async () => {
    cloud.state.row = { id: 'T', is_public: true, share_code: 'OLI234', share_code_created_at: '2026-10-01T08:00:00.000Z' };
    const result = await new SupabaseRepository().shareIfUnshared('T', SHARE);

    expect(cloud.state.row).toMatchObject({ is_public: true, share_code: 'OLI234', share_code_created_at: '2026-10-01T08:00:00.000Z' });
    expect(result).toEqual({ applied: false, cloud: { isPublic: true, shareCode: 'OLI234', shareCodeCreatedAt: '2026-10-01T08:00:00.000Z' } });
  });

  it('Gegenbeispiel: ohne Cloud-Code setzt der Rückfall Code, Zeitpunkt und „öffentlich“', async () => {
    cloud.state.row = { id: 'T', is_public: false, share_code: null, share_code_created_at: null };
    const result = await new SupabaseRepository().shareIfUnshared('T', SHARE);

    expect(result).toEqual({ applied: true });
    expect(cloud.state.row).toMatchObject({ is_public: true, share_code: 'MAR234', share_code_created_at: '2026-11-01T10:00:00.000Z' });
  });

  it('Zeile nicht lesbar (z. B. ausgetragen, privat): nichts geschrieben, Cloud-Stand unbekannt', async () => {
    cloud.state.row = null;
    expect(await new SupabaseRepository().shareIfUnshared('T', SHARE)).toEqual({ applied: false, cloud: null });
  });

  it('Kollision mit dem Code eines anderen Turniers (23505) wird geworfen, nicht verschluckt', async () => {
    cloud.state.row = { id: 'T', is_public: false, share_code: null, share_code_created_at: null };
    cloud.state.failUpdate = true;
    await expect(new SupabaseRepository().shareIfUnshared('T', SHARE)).rejects.toBeInstanceOf(RepositoryError);
  });
});
