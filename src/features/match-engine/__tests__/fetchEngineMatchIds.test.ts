import { describe, it, expect } from 'vitest';
import { fetchEngineMatchIds, type EngineMatchIdsQueryClient } from '../fetchEngineMatchIds';

function fakeClient(pages: Array<{ data: { match_id: string }[] | null; error: unknown }>): {
  client: EngineMatchIdsQueryClient;
  calls: { ids?: string[]; ranges: { from: number; to: number }[] };
} {
  let index = 0;
  const calls: { ids?: string[]; ranges: { from: number; to: number }[] } = { ranges: [] };
  const client: EngineMatchIdsQueryClient = {
    from: () => ({
      select: () => ({
        not: () => ({
          in: (_column, ids) => {
            calls.ids = ids;
            return {
              range: (from: number, to: number) => {
                calls.ranges.push({ from, to });
                const page = index < pages.length ? pages[index] : { data: [], error: null };
                index += 1;
                return Promise.resolve(page);
              },
            };
          },
        }),
      }),
    }),
  };
  return { client, calls };
}

describe('fetchEngineMatchIds (W3)', () => {
  it('liefert eine Menge der match_id, ohne Netzaufruf bei leerer Liste', async () => {
    const { client, calls } = fakeClient([{ data: [], error: null }]);
    const ids = await fetchEngineMatchIds(client, []);
    expect(ids.size).toBe(0);
    expect(calls.ids).toBeUndefined();
  });

  it('gibt die gefundenen match_id als Set zurueck', async () => {
    const { client, calls } = fakeClient([{ data: [{ match_id: 'm1' }, { match_id: 'm2' }], error: null }]);
    const ids = await fetchEngineMatchIds(client, ['m1', 'm2', 'm3']);
    expect(ids).toEqual(new Set(['m1', 'm2']));
    expect(calls.ids).toEqual(['m1', 'm2', 'm3']);
  });

  it('wirft bei einem Abfragefehler', async () => {
    const { client } = fakeClient([{ data: null, error: new Error('RLS') }]);
    await expect(fetchEngineMatchIds(client, ['m1'])).rejects.toThrow('RLS');
  });

  it('I3: blaettert ueber mehr als eine Seitengroesse, ohne Zeilen abzuschneiden', async () => {
    const PAGE_SIZE = 500;
    // Erste Seite komplett voll (PAGE_SIZE Zeilen, viele davon dieselbe match_id -- ein Spiel mit
    // vielen Ereignissen), zweite Seite kuerzer -> Abbruchkriterium.
    const fullPage = Array.from({ length: PAGE_SIZE }, (_unused, i) => ({ match_id: `m${i % 3}` }));
    const shortPage = [{ match_id: 'm-last' }];
    const { client, calls } = fakeClient([
      { data: fullPage, error: null },
      { data: shortPage, error: null },
    ]);

    const ids = await fetchEngineMatchIds(client, ['irrelevant']);

    expect(ids).toEqual(new Set(['m0', 'm1', 'm2', 'm-last']));
    expect(calls.ranges).toEqual([
      { from: 0, to: PAGE_SIZE - 1 },
      { from: PAGE_SIZE, to: 2 * PAGE_SIZE - 1 },
    ]);
  });
});
