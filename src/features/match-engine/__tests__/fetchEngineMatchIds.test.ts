import { describe, it, expect } from 'vitest';
import { fetchEngineMatchIds, type EngineMatchIdsQueryClient } from '../fetchEngineMatchIds';

function fakeClient(result: { data: { match_id: string }[] | null; error: unknown }): {
  client: EngineMatchIdsQueryClient;
  calls: { ids?: string[] };
} {
  const calls: { ids?: string[] } = {};
  const client: EngineMatchIdsQueryClient = {
    from: () => ({
      select: () => ({
        not: () => ({
          in: (_column, ids) => {
            calls.ids = ids;
            return Promise.resolve(result);
          },
        }),
      }),
    }),
  };
  return { client, calls };
}

describe('fetchEngineMatchIds (W3)', () => {
  it('liefert eine Menge der match_id, ohne Netzaufruf bei leerer Liste', async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    const ids = await fetchEngineMatchIds(client, []);
    expect(ids.size).toBe(0);
    expect(calls.ids).toBeUndefined();
  });

  it('gibt die gefundenen match_id als Set zurueck', async () => {
    const { client, calls } = fakeClient({ data: [{ match_id: 'm1' }, { match_id: 'm2' }], error: null });
    const ids = await fetchEngineMatchIds(client, ['m1', 'm2', 'm3']);
    expect(ids).toEqual(new Set(['m1', 'm2']));
    expect(calls.ids).toEqual(['m1', 'm2', 'm3']);
  });

  it('wirft bei einem Abfragefehler', async () => {
    const { client } = fakeClient({ data: null, error: new Error('RLS') });
    await expect(fetchEngineMatchIds(client, ['m1'])).rejects.toThrow('RLS');
  });
});
