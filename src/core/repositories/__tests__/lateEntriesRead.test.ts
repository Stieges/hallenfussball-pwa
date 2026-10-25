/**
 * R3-4 „Nach dem Ende eingetroffen“ lesen (`late_entries`, nur Turnierleitung, Server 20261113_003). Erwartungen aus dem Gherkin
 * (@LZ-039, @LZ-040) und aus E8 (Name aus der Mitgliederliste; nie eine E-Mail), nicht am Code abgelesen.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { readLateEntries } from '../lateEntriesRead';

type Rows = { data: unknown[] | null; error: { message: string } | null };

/** Ein `from(...).select(...)`-Kettenstück je Tabelle, wie postgrest-js sie liefert (nur die benutzten Aufrufe). */
function client(tables: Record<string, Rows>): SupabaseClient<Database> {
  const chain = (rows: Rows) => {
    const node: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'not']) { node[name] = vi.fn(() => node); }
    node.then = (resolve: (value: Rows) => unknown) => resolve(rows);
    return node;
  };
  return { from: vi.fn((table: string) => chain(tables[table] ?? { data: [], error: null })) } as unknown as SupabaseClient<Database>;
}

const ZEILE = {
  id: 7, match_id: 'm15', event_id: 'e1', actor: 'tom', device_id: null, received_at: '2026-11-28T12:21:00+00:00',
  event: { id: 'e1', type: 'GOAL', teamId: 'ost', section: 1, clockMs: 60000, at: 1795953840000, payload: { playerNumber: 7 } },
};

describe('@LZ-039 Ein nach dem Abschluss angekommener Eintrag wird gelesen', () => {
  it('Tor von Tom: Art, Team, Nummer, Gerätezeit, Ankunft und Name aus der Mitgliederliste', async () => {
    const result = await readLateEntries(client({
      late_entries: { data: [ZEILE], error: null },
      tournament_collaborators: { data: [{ user_id: 'tom', label: ' Tom ' }, { user_id: 'maria', label: '' }], error: null },
    }), 't1');
    expect(result).toEqual({ ok: true, entries: [{
      id: 7, matchId: 'm15', eventId: 'e1', type: 'GOAL', teamId: 'ost', playerNumber: 7, recordedAt: 1795953840000,
      actor: 'tom', actorName: 'Tom', receivedAt: '2026-11-28T12:21:00+00:00',
    }] });
  });

  it('E8: ohne Namen in der Mitgliederliste bleibt der Name leer (die Oberfläche zeigt „Helfer-Gerät“), nie die Kennung', async () => {
    const result = await readLateEntries(client({ late_entries: { data: [ZEILE], error: null } }), 't1');
    expect(result.ok && result.entries[0].actorName).toBeNull();
  });

  it('eine unlesbare Zeile fällt weg, die übrigen bleiben (nichts bricht die Liste)', async () => {
    const result = await readLateEntries(client({ late_entries: { data: [{ id: 'kaputt' }, ZEILE], error: null } }), 't1');
    expect(result.ok && result.entries.map((e) => e.id)).toEqual([7]);
  });
});

describe('Fehlerpolitik: wirft nie', () => {
  it('Lesefehler, kein Client oder ausgelöste Ausnahme → { ok: false }', async () => {
    expect(await readLateEntries(client({ late_entries: { data: null, error: { message: 'x' } } }), 't1')).toEqual({ ok: false });
    expect(await readLateEntries(null, 't1')).toEqual({ ok: false });
    const wirft = { from: () => { throw new Error('Netz'); } } as unknown as SupabaseClient<Database>;
    expect(await readLateEntries(wirft, 't1')).toEqual({ ok: false });
  });
});
