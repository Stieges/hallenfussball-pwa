/**
 * C-LIVE-STAND-BEENDET-FEHLT (@LZ-003): Die Anpfiff-Sperre fragt den Cloud-Stand strikt ab.
 *
 * Szenario @LZ-003 „Tom hat das erste Gruppenspiel angepfiffen -> weder Festlegen zurücknehmen
 * noch löschen“. Ein beendetes Spiel hat `live_state = null` (der Server leert es), steht aber auf
 * `match_status = 'finished'` -- es ist angepfiffen worden. Die Abfrage `hasStartedMatches`
 * liest deshalb den Status (nicht `live_state`) und wirft bei Lesefehlern, statt „keins“ zu melden.
 *
 * Gegenbeispiel: nur geplante Spiele -> false.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const result: { value: { data: unknown; error: unknown } } = { value: { data: [], error: null } };
  const calls: { statuses: readonly string[] | null; tournamentId: string | null } = {
    statuses: null,
    tournamentId: null,
  };
  // Der Fake ist ein Server in klein: er liefert nur Zeilen, deren Status in der angefragten Liste steht.
  let rows: Array<{ id: string; match_status: string; live_state: unknown }> = [];
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((_column: string, value: string) => {
      calls.tournamentId = value;
      return builder;
    }),
    in: vi.fn((_column: string, statuses: readonly string[]) => {
      calls.statuses = statuses;
      return builder;
    }),
    limit: vi.fn(() => {
      if (result.value.error) {
        return Promise.resolve(result.value);
      }
      const hits = rows.filter((r) => (calls.statuses ?? []).includes(r.match_status));
      return Promise.resolve({ data: hits.map((r) => ({ id: r.id })), error: null });
    }),
  };
  const supabaseMock = { from: vi.fn(() => builder), channel: vi.fn(), removeChannel: vi.fn() };
  return {
    supabaseMock,
    calls,
    result,
    setRows: (r: typeof rows) => {
      rows = r;
    },
  };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

describe('C-LIVE-STAND-BEENDET-FEHLT: hasStartedMatches (@LZ-003)', () => {
  beforeEach(() => {
    hoisted.result.value = { data: [], error: null };
    hoisted.calls.statuses = null;
    hoisted.setRows([]);
  });

  it('@LZ-003 Zeile „das erste Gruppenspiel ist schon beendet“: ein beendetes Spiel (live_state null) zählt als angepfiffen', async () => {
    hoisted.setRows([
      { id: 'm1', match_status: 'finished', live_state: null },
      { id: 'm2', match_status: 'scheduled', live_state: null },
    ]);
    const repo = new SupabaseLiveMatchRepository();

    await expect(repo.hasStartedMatches('t1')).resolves.toBe(true);
    expect(hoisted.calls.tournamentId).toBe('t1');
  });

  it('@LZ-003 laufendes und pausiertes Spiel zählen als angepfiffen', async () => {
    const repo = new SupabaseLiveMatchRepository();
    for (const status of ['running', 'paused']) {
      hoisted.setRows([{ id: 'm1', match_status: status, live_state: {} }]);
      await expect(repo.hasStartedMatches('t1')).resolves.toBe(true);
    }
  });

  it('Gegenbeispiel: nur geplante, wartende oder abgesetzte Spiele (auch mit live_state) sind nicht angepfiffen', async () => {
    hoisted.setRows([
      { id: 'm1', match_status: 'scheduled', live_state: {} },
      { id: 'm2', match_status: 'waiting', live_state: null },
      { id: 'm3', match_status: 'skipped', live_state: null },
    ]);
    const repo = new SupabaseLiveMatchRepository();

    await expect(repo.hasStartedMatches('t1')).resolves.toBe(false);
  });

  it('@LZ-003 Zeile „der Stand der Spiele ist gerade nicht lesbar“: Lesefehler wird geworfen, nicht als „keins angepfiffen“ gemeldet', async () => {
    hoisted.result.value = { data: null, error: { message: 'network down' } };
    const repo = new SupabaseLiveMatchRepository();

    await expect(repo.hasStartedMatches('t1')).rejects.toThrow();
  });
});
