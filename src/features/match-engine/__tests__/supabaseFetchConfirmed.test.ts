import { describe, it, expect } from 'vitest';
import { makeFetchConfirmed, type MatchEventsQueryClient } from '../supabaseFetchConfirmed';
import type { Database } from '../../../types/supabase';

type MatchEventsRow = Database['public']['Tables']['match_events']['Row'];

function row(partial: Partial<MatchEventsRow> & Pick<MatchEventsRow, 'id' | 'type' | 'seq'>): MatchEventsRow {
  return {
    base_seq: null,
    client_time: '2026-01-01T00:00:00Z',
    clock_ms: null,
    control_epoch: null,
    created_at: null,
    event_format: 1,
    incomplete: null,
    is_deleted: null,
    is_public: null,
    match_id: 'm1',
    owner_id: null,
    payload: {},
    period: null,
    player_id: null,
    recorded_at: '2026-01-01T00:00:00Z',
    review_state: null,
    score_away: 0,
    score_home: 0,
    section: null,
    target_event_id: null,
    team_id: null,
    timestamp_seconds: 0,
    version: 1,
    ...partial,
  };
}

/** Chain-Mock in Client-Form (K8): implementiert `MatchEventsQueryClient` direkt, kein Bezug zum echten Client. */
function fakeClient(pages: Array<{ data: MatchEventsRow[] | null; error: unknown }>): {
  client: MatchEventsQueryClient;
  calls: { matchId: string; watermark: number }[];
} {
  let index = 0;
  const calls: { matchId: string; watermark: number }[] = [];
  const client: MatchEventsQueryClient = {
    from: () => ({
      select: () => ({
        eq: (_column, matchId) => ({
          not: () => ({
            is: () => ({
              gt: (_column2, watermark) => {
                calls.push({ matchId, watermark });
                return {
                  order: () => ({
                    limit: () => Promise.resolve(index < pages.length ? pages[index++] : { data: [], error: null }),
                  }),
                };
              },
            }),
          }),
        }),
      }),
    }),
  };
  return { client, calls };
}

describe('makeFetchConfirmed (Supabase-Adapter, K8)', () => {
  it('bildet Zeilen auf EngineEventWithSeq ab und liefert den neuen Wasserstand', async () => {
    const { client, calls } = fakeClient([
      { data: [row({ id: 'e1', type: 'GOAL', seq: 3, team_id: 'teamA' })], error: null },
    ]);
    const fetchConfirmed = makeFetchConfirmed(client);

    const result = await fetchConfirmed('m1', 0);

    expect(result.newWatermark).toBe(3);
    expect(result.events).toEqual([
      expect.objectContaining({ id: 'e1', type: 'GOAL', seq: 3, teamId: 'teama' }),
    ]);
    expect(calls).toEqual([{ matchId: 'm1', watermark: 0 }]);
  });

  it('blaettert bis eine Seite kleiner als das Limit ist', async () => {
    const full = Array.from({ length: 2 }, (_unused, i) => row({ id: `p-${i}`, type: 'GOAL', seq: i + 1 }));
    const { client, calls } = fakeClient([
      { data: full, error: null },
      { data: [], error: null },
    ]);
    const fetchConfirmed = makeFetchConfirmed(client);

    const result = await fetchConfirmed('m1', 0);
    expect(result.events).toHaveLength(2);
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('Fehler der Abfrage werden geworfen, kein Teilergebnis', async () => {
    const { client } = fakeClient([{ data: null, error: new Error('RLS') }]);
    const fetchConfirmed = makeFetchConfirmed(client);
    await expect(fetchConfirmed('m1', 0)).rejects.toThrow('RLS');
  });
});
