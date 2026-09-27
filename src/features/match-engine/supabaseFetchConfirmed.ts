/**
 * K8: `fetchConfirmed`-Implementierung fuer den echten Supabase-Client.
 *
 * `fetchConfirmedSince` (`src/core/match/client/catchUp.ts`) ist gegen eine schmale,
 * generische Abfragekette typisiert, damit sie ohne Supabase-Abhaengigkeit testbar bleibt.
 * Der generierte Client ist strukturell reichhaltiger (literale Spalten-Unions, `Json`-Payload,
 * `PostgrestFilterBuilder` statt echtem `Promise`) -- eine strukturelle Bruecke dorthin wuerde
 * `as any` an mehreren Stellen erzwingen. Diese Funktion bildet dieselbe Abfrage (Tabelle, Filter,
 * Sortierung, Blaetterung, `rowToEngineEvent`-Zuordnung) direkt gegen den echten Client nach --
 * exakt der Vertrag aus 003:490-503, RPC-Antwort bleibt per zod (`rowToEngineEvent`) geprueft.
 */
import type { Database } from '../../types/supabase';
import { rowToEngineEvent, type ConfirmedRow, type EngineEventWithSeq } from '../../core/match/client';

type MatchEventsRow = Database['public']['Tables']['match_events']['Row'];
type MatchEventsPage = PromiseLike<{ data: MatchEventsRow[] | null; error: unknown }>;

/**
 * Schmaler Ausschnitt von `SupabaseClient<Database>`, genau die eine Kette, die diese Datei
 * braucht (K8) -- Methoden-Kurzschreibweise (nicht Pfeil-Eigenschaften), damit der echte Client
 * (literale Spalten-Unions) hier zuweisungskompatibel bleibt, ohne `as any`.
 */
export interface MatchEventsQueryClient {
  from(table: 'match_events'): {
    select(query: string): {
      eq(column: string, value: string): {
        not(column: string, operator: string, value: unknown): {
          is(column: string, value: unknown): {
            gt(column: string, value: number): {
              order(column: string, options?: { ascending?: boolean }): {
                limit(count: number): MatchEventsPage;
              };
            };
          };
        };
      };
    };
  };
}

const PAGE_SIZE = 500;

/** `payload` kommt als `Json` (DB-Constraint erzwingt ein Objekt); `rowToEngineEvent` erwartet `Record<string, unknown>`. */
function toConfirmedRow(row: Database['public']['Tables']['match_events']['Row']): ConfirmedRow {
  const payload: Record<string, unknown> =
    row.payload !== null && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? row.payload
      : {};
  return {
    id: row.id,
    type: row.type,
    client_time: row.client_time,
    recorded_at: row.recorded_at,
    section: row.section,
    clock_ms: row.clock_ms,
    team_id: row.team_id,
    target_event_id: row.target_event_id,
    payload,
    seq: row.seq,
    event_format: row.event_format,
    review_state: row.review_state,
  };
}

export function makeFetchConfirmed(
  client: MatchEventsQueryClient,
): (matchId: string, watermarkSeq: number) => Promise<{ events: EngineEventWithSeq[]; newWatermark: number }> {
  return async (matchId, watermarkSeq) => {
    const events: EngineEventWithSeq[] = [];
    let currentWatermark = watermarkSeq;
    let hasMore = true;
    while (hasMore) {
      const result = await client
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .not('event_format', 'is', null)
        .is('review_state', null)
        .gt('seq', currentWatermark)
        .order('seq', { ascending: true })
        .limit(PAGE_SIZE);
      if (result.error) {
        throw result.error;
      }
      const rows = result.data ?? [];
      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      }
      for (const row of rows) {
        events.push(rowToEngineEvent(toConfirmedRow(row)));
        currentWatermark = Math.max(currentWatermark, row.seq);
      }
      if (rows.length === 0) {
        hasMore = false;
      }
    }
    events.sort((a, b) => a.seq - b.seq);
    return { events, newWatermark: currentWatermark };
  };
}
