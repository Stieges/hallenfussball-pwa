/**
 * catchUp (RC7, V9): Nachladen bestätigter Ereignisse und Projektion
 * von match_events-Zeilen in EngineEvent (exakt wie Server in 003:490-503).
 */
import { EventTypeSchema, type EngineEvent } from '../types';

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

/** 003 liefert `team_id::text` und `target_event_id::text` in Kleinbuchstaben (I8). */
function lowerOrNull(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toLowerCase();
}

export function rowToEngineEvent(row: ConfirmedRow): EngineEventWithSeq {
  const id = row.id.toString().toLowerCase();
  // I8: keine erfundene Zeit -- `recorded_at` ist in der DB NOT NULL, fehlende Werte
  // verdecken nur Fehler.
  const time = row.client_time ?? row.recorded_at ?? null;
  if (time === null) {
    throw new Error(`match_events-Zeile ${id}: weder client_time noch recorded_at gesetzt`);
  }
  return {
    id,
    type: EventTypeSchema.parse(row.type),
    actor: 'leitung',
    at: Math.floor(Date.parse(time)),
    section: row.section ?? null,
    clockMs: row.clock_ms ?? null,
    teamId: lowerOrNull(row.team_id),
    targetId: lowerOrNull(row.target_event_id),
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
    // C4: Netz- und RLS-Fehler werden vom Client als `error` geliefert, nicht als
    // Ausnahme -- sie muessen trotzdem wirken. Ein Fehler mitten beim Blättern
    // laesst die gesamte Lese scheitern, ein Teilergebnis wird nie ausgeliefert.
    if (result.error) {
      throw result.error;
    }
    const rows: ConfirmedRow[] = result.data ?? [];
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
