/**
 * catchUp (RC7, V9): Nachladen bestätigter Ereignisse und Projektion
 * von match_events-Zeilen in EngineEvent (exakt wie Server in 003:490-503).
 * Hinweis: EngineEvent-Record erzeugt architekturbedingte TS-Warnungen.
 */
import type { EngineEvent } from '../types';

export interface EngineEventWithSeq extends EngineEvent {
  seq: number;
}

export interface ConfirmedRow {
  id: string;
  type: string;
  client_time?: string | null;
  recorded_at?: string | null;
  section?: number | null;
  clock_ms?: number | null;
  team_id?: string | null;
  target_event_id?: string | null;
  payload: Record<string, unknown>;
  seq: number;
  event_format?: number | null;
  review_state?: string | null;
}

export function rowToEngineEvent(row: ConfirmedRow): EngineEventWithSeq {
  const id = row.id.toString().toLowerCase();
  const at = Math.floor(
    Date.parse(row.client_time ?? row.recorded_at ?? new Date().toISOString())
  );
  return {
    id,
    type: row.type as EngineEvent['type'],
    actor: 'leitung',
    at,
    section: row.section ?? null,
    clockMs: row.clock_ms ?? null,
    teamId: row.team_id ?? null,
    targetId: row.target_event_id ?? null,
    payload: row.payload,
    seq: row.seq,
  };
}

export interface FetchConfirmedOptions {
  pageSize?: number;
}

export async function fetchConfirmedSince(
  query: {
    from: (table: string) => {
      select: (...cols: string[]) => {
        eq: (col: string, val: unknown) => {
          not: (col: string, op: string, val: unknown) => {
            is: (col: string, val: unknown) => {
              gt: (col: string, val: number) => {
                order: (col: string, opts?: { ascending?: boolean }) => {
                  limit: (n: number) => Promise<{ data: ConfirmedRow[] | null; error: unknown }>;
                };
              };
            };
          };
        };
      };
    };
  },
  matchId: string,
  watermarkSeq: number,
  pageSize = 500,
): Promise<{ events: EngineEventWithSeq[]; newWatermark: number }> {
  const events: EngineEventWithSeq[] = [];
  let currentWatermark = watermarkSeq;
  let hasMore = true;
  while (hasMore) {
    const result = await query.from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .not('event_format', 'is', null)
      .is('review_state', null)
      .gt('seq', currentWatermark)
      .order('seq')
      .limit(pageSize);
    const rows = (result.data ?? []);
    if (rows.length < pageSize) {
      hasMore = false;
    }
    for (const row of rows) {
      events.push(rowToEngineEvent(row));
      currentWatermark = Math.max(currentWatermark, row.seq);
    }
    if (rows.length === 0) {
      hasMore = false;
    }
  }
  return { events: events.sort((a, b) => a.seq - b.seq), newWatermark: currentWatermark };
}
