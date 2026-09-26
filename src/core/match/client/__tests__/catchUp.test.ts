import { describe, it, expect } from 'vitest';
import { rowToEngineEvent, fetchConfirmedSince } from '../catchUp';

describe('catchUp', () => {
  describe('rowToEngineEvent', () => {
    it('projektiert eine Zeile exakt wie die Server-Projektion (003:490-503)', () => {
      const row = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        type: 'GOAL',
        client_time: '2026-09-26T12:00:00.123Z',
        recorded_at: '2026-09-26T12:00:00Z',
        section: 1,
        clock_ms: 120000,
        team_id: 'team-a-id',
        target_event_id: null,
        payload: { playerNumber: 7 },
        seq: 42,
        event_format: 1,
        review_state: null,
      };
      const event = rowToEngineEvent(row);
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
      const row = {
        id: '1',
        type: 'PAUSE',
        client_time: null,
        recorded_at: '2026-09-26T13:00:00Z',
        section: null,
        clock_ms: 0,
        team_id: null,
        target_event_id: null,
        payload: {},
        seq: 1,
        event_format: 1,
        review_state: null,
      };
      const event = rowToEngineEvent(row);
      expect(event.at).toBe(Math.floor(Date.parse('2026-09-26T13:00:00Z')));
    });

    it('rundet Mikrosekunden auf ms ab (floor)', () => {
      const row = {
        id: 'm1',
        type: 'MATCH_START',
        client_time: '2026-09-26T10:00:00.999Z',
        recorded_at: null,
        section: null,
        clock_ms: null,
        team_id: null,
        target_event_id: null,
        payload: {},
        seq: 0,
        event_format: 1,
        review_state: null,
      };
      const event = rowToEngineEvent(row);
      expect(event.at).toBe(Math.floor(Date.parse('2026-09-26T10:00:00.999Z')));
    });

    it('normalisiert id zu kleinbuchstaben', () => {
      const row = {
        id: 'ABC-123',
        type: 'RESUME',
        client_time: null,
        recorded_at: '2026-01-01T00:00:00Z',
        section: 1,
        clock_ms: 0,
        team_id: null,
        target_event_id: null,
        payload: {},
        seq: 5,
        event_format: 1,
        review_state: null,
      };
      const event = rowToEngineEvent(row);
      expect(event.id).toBe('abc-123');
    });
  });

  describe('fetchConfirmedSince', () => {
    it('blättert über 3 Seiten', async () => {
      const pages = [
        [
          { id: 'e1', type: 'GOAL', seq: 1, client_time: '2026-01-01T00:00:01Z', payload: {}, event_format: 1, review_state: null },
        ],
        [
          { id: 'e2', type: 'PAUSE', seq: 2, client_time: '2026-01-01T00:00:02Z', payload: {}, event_format: 1, review_state: null },
        ],
        [
          { id: 'e3', type: 'RESUME', seq: 3, client_time: '2026-01-01T00:00:03Z', payload: {}, event_format: 1, review_state: null },
        ],
      ];
      let pageIndex = 0;
      const mockQuery = {
        from: () => ({
          select: () => ({
            eq: () => ({
              not: () => ({
                is: () => ({
                  gt: () => ({
                    order: () => ({
                      limit: async () => {
                        const data = pageIndex < pages.length ? pages[pageIndex++] : [];
                        return { data, error: null };
                      },
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      const result = await fetchConfirmedSince(mockQuery, 'm1', 0, 1);
      expect(result.events.length).toBe(3);
      expect(result.newWatermark).toBe(3);
    });

    it('liefert leeres Ergebnis bei keinem Daten', async () => {
      const mockQuery = {
        from: () => ({
          select: () => ({
            eq: () => ({
              not: () => ({
                is: () => ({
                  gt: () => ({
                    order: () => ({
                      limit: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
      const result = await fetchConfirmedSince(mockQuery, 'm1', 5, 500);
      expect(result.events).toEqual([]);
      expect(result.newWatermark).toBe(5);
    });
  });
});
