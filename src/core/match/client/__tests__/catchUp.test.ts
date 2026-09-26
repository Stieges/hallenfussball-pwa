import { describe, it, expect } from 'vitest';
import { rowToEngineEvent, fetchConfirmedSince, type ConfirmedRow } from '../catchUp';

function row(partial: Partial<ConfirmedRow> & Pick<ConfirmedRow, 'id' | 'type' | 'seq'>): ConfirmedRow {
  return {
    client_time: '2026-01-01T00:00:00Z',
    recorded_at: '2026-01-01T00:00:00Z',
    section: null,
    clock_ms: null,
    team_id: null,
    target_event_id: null,
    payload: {},
    event_format: 1,
    review_state: null,
    ...partial,
  };
}

/** Jeder Aufruf der Abfragekette wird aufgezeichnet (N3: Filterkette belegen). */
type ChainStep =
  | { op: 'from'; table: string }
  | { op: 'select'; cols: string[] }
  | { op: 'eq'; col: string; val: unknown }
  | { op: 'not'; col: string; optr: string; val: unknown }
  | { op: 'is'; col: string; val: unknown }
  | { op: 'gt'; col: string; val: number }
  | { op: 'order'; col: string }
  | { op: 'limit'; n: number };

/** Ketten-Mock in der Form des Supabase-Clients; `pages` werden von `limit()` nacheinander geliefert. */
function mockQuery(pages: Array<{ data: ConfirmedRow[] | null; error: unknown }>) {
  const steps: ChainStep[] = [];
  let index = 0;
  const query = {
    from: (table: string) => {
      steps.push({ op: 'from', table });
      return {
        select: (...cols: string[]) => {
          steps.push({ op: 'select', cols });
          return {
            eq: (col: string, val: unknown) => {
              steps.push({ op: 'eq', col, val });
              return {
                not: (col: string, optr: string, val: unknown) => {
                  steps.push({ op: 'not', col, optr, val });
                  return {
                    is: (col: string, val: unknown) => {
                      steps.push({ op: 'is', col, val });
                      return {
                        gt: (col: string, val: number) => {
                          steps.push({ op: 'gt', col, val });
                          return {
                            order: (col: string) => {
                              steps.push({ op: 'order', col });
                              return {
                                limit: async (n: number) => {
                                  steps.push({ op: 'limit', n });
                                  return index < pages.length ? pages[index++] : { data: [], error: null };
                                },
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  const pageCalls = (): number => steps.filter((step) => step.op === 'limit').length;
  return { query, steps, pageCalls };
}

describe('catchUp', () => {
  describe('rowToEngineEvent', () => {
    it('projektiert eine Zeile exakt wie die Server-Projektion (003:490-503)', () => {
      const event = rowToEngineEvent(
        row({
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          type: 'GOAL',
          client_time: '2026-09-26T12:00:00.123Z',
          recorded_at: '2026-09-26T12:00:00Z',
          section: 1,
          clock_ms: 120000,
          team_id: 'team-a-id',
          payload: { playerNumber: 7 },
          seq: 42,
        }),
      );
      expect(event.id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(event.type).toBe('GOAL');
      expect(event.actor).toBe('leitung');
      expect(event.at).toBe(Math.floor(Date.parse('2026-09-26T12:00:00.123Z')));
      expect(event.section).toBe(1);
      expect(event.clockMs).toBe(120000);
      expect(event.teamId).toBe('team-a-id');
      expect(event.payload).toEqual({ playerNumber: 7 });
      expect(event.seq).toBe(42);
    });

    it('verwendet recorded_at, wenn client_time null ist', () => {
      const event = rowToEngineEvent(
        row({ id: '1', type: 'PAUSE', client_time: null, recorded_at: '2026-09-26T13:00:00Z', seq: 1 }),
      );
      expect(event.at).toBe(Math.floor(Date.parse('2026-09-26T13:00:00Z')));
    });

    it('rundet echte Mikrosekunden auf ms ab (floor)', () => {
      const event = rowToEngineEvent(
        row({
          id: 'm1',
          type: 'MATCH_START',
          client_time: '2026-09-26T10:00:00.123456+00:00',
          recorded_at: null,
          seq: 0,
        }),
      );
      expect(event.at).toBe(Date.parse('2026-09-26T10:00:00.123Z'));
    });

    it('normalisiert id, teamId und targetId zu Kleinbuchstaben', () => {
      const event = rowToEngineEvent(
        row({
          id: 'ABC-123',
          type: 'RETRACT',
          team_id: 'TEAM-A-ID',
          target_event_id: 'TARGET-99',
          seq: 5,
        }),
      );
      expect(event.id).toBe('abc-123');
      expect(event.teamId).toBe('team-a-id');
      expect(event.targetId).toBe('target-99');
    });

    it('wirft, wenn weder client_time noch recorded_at gesetzt ist', () => {
      expect(() =>
        rowToEngineEvent(row({ id: 'z1', type: 'GOAL', client_time: null, recorded_at: null, seq: 1 })),
      ).toThrow();
    });

    it('wirft bei einem Ereignistyp ausserhalb der Engine-Enumeration', () => {
      expect(() => rowToEngineEvent(row({ id: 'z2', type: 'NOT_A_TYPE', seq: 1 }))).toThrow();
    });

    it('laesst teamId und targetId bei null unveraendert', () => {
      const event = rowToEngineEvent(row({ id: 'z3', type: 'GOAL', team_id: null, target_event_id: null, seq: 1 }));
      expect(event.teamId).toBeNull();
      expect(event.targetId).toBeNull();
    });
  });

  describe('fetchConfirmedSince', () => {
    it('blättert über 3 Seiten', async () => {
      const pages = [
        { data: [row({ id: 'e1', type: 'GOAL', seq: 1 })], error: null },
        { data: [row({ id: 'e2', type: 'PAUSE', seq: 2 })], error: null },
        { data: [row({ id: 'e3', type: 'RESUME', seq: 3 })], error: null },
      ];
      const { query } = mockQuery(pages);
      const result = await fetchConfirmedSince(query, 'm1', 0, 1);
      expect(result.events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
      expect(result.newWatermark).toBe(3);
    });

    it('bricht ab, sobald weniger als pageSize Zeilen kommen (2 Seiten)', async () => {
      const pages = [
        { data: [row({ id: 'p1', type: 'GOAL', seq: 7 }), row({ id: 'p2', type: 'GOAL', seq: 8 })], error: null },
        { data: [row({ id: 'p3', type: 'GOAL', seq: 9 })], error: null },
      ];
      const { query, pageCalls } = mockQuery(pages);
      const result = await fetchConfirmedSince(query, 'm1', 6, 2);
      expect(result.events.map((e) => e.seq)).toEqual([7, 8, 9]);
      expect(result.newWatermark).toBe(9);
      expect(pageCalls()).toBe(2);
    });

    it('wendet die RC7-Filterkette an und steigert den Wasserstand je Seite (N3)', async () => {
      const pages = [
        { data: [row({ id: 'p1', type: 'GOAL', seq: 7 }), row({ id: 'p2', type: 'GOAL', seq: 8 })], error: null },
        { data: [row({ id: 'p3', type: 'GOAL', seq: 9 })], error: null },
      ];
      const { query, steps } = mockQuery(pages);
      await fetchConfirmedSince(query, 'm1', 6, 2);

      expect(steps.filter((s) => s.op === 'from').map((s) => s.table)).toEqual(['match_events', 'match_events']);
      expect(steps.filter((s) => s.op === 'select')).toEqual([
        { op: 'select', cols: ['*'] },
        { op: 'select', cols: ['*'] },
      ]);
      expect(steps.filter((s) => s.op === 'eq')).toEqual([
        { op: 'eq', col: 'match_id', val: 'm1' },
        { op: 'eq', col: 'match_id', val: 'm1' },
      ]);
      expect(steps.filter((s) => s.op === 'not')).toEqual([
        { op: 'not', col: 'event_format', optr: 'is', val: null },
        { op: 'not', col: 'event_format', optr: 'is', val: null },
      ]);
      expect(steps.filter((s) => s.op === 'is')).toEqual([
        { op: 'is', col: 'review_state', val: null },
        { op: 'is', col: 'review_state', val: null },
      ]);
      expect(steps.filter((s) => s.op === 'gt')).toEqual([
        { op: 'gt', col: 'seq', val: 6 },
        { op: 'gt', col: 'seq', val: 8 },
      ]);
      expect(steps.filter((s) => s.op === 'order')).toEqual([
        { op: 'order', col: 'seq' },
        { op: 'order', col: 'seq' },
      ]);
      expect(steps.filter((s) => s.op === 'limit')).toEqual([
        { op: 'limit', n: 2 },
        { op: 'limit', n: 2 },
      ]);
    });

    it('liefert leeres Ergebnis bei keinen Daten', async () => {
      const { query } = mockQuery([{ data: [], error: null }]);
      const result = await fetchConfirmedSince(query, 'm1', 5, 500);
      expect(result.events).toEqual([]);
      expect(result.newWatermark).toBe(5);
    });

    it('wirft bei einem Fehler der Abfrage (Netzfehler)', async () => {
      const { query } = mockQuery([{ data: null, error: { message: 'Failed to fetch' } }]);
      await expect(fetchConfirmedSince(query, 'm1', 0, 500)).rejects.toThrow();
    });

    it('liefert bei einem Fehler mitten beim Blättern kein Teilergebnis zurück', async () => {
      const pages = [
        { data: [row({ id: 'e1', type: 'GOAL', seq: 1 })], error: null },
        { data: null, error: { message: 'connection reset' } },
      ];
      const { query } = mockQuery(pages);
      await expect(fetchConfirmedSince(query, 'm1', 0, 1)).rejects.toThrow();
    });
  });
});
