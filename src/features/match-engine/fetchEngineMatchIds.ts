/**
 * W3: Sammelabfrage "welche Spiele dieses Turniers haben Engine-Ereignisse" -- eine Abfrage
 * je Turnier-Laden statt einer je Spiel. Nur `match_id` wird selektiert.
 *
 * I3 (Review Fixrunde 1): liefert eine ZEILE JE EREIGNIS, nicht je Spiel -- bei mehr als
 * `PAGE_SIZE` Engine-Ereignissen in einem Turnier (PostgREST `max_rows`) schnitt die Abfrage sonst
 * still ab, bevor alle betroffenen Spiele erfasst waren. Blaettert jetzt per `range()` bis eine
 * Seite kuerzer als `PAGE_SIZE` ist (gleiches Muster wie `fetchConfirmedSince`/`makeFetchConfirmed`);
 * `match_id` wird ueber ein `Set` dedupliziert.
 *
 * N-m4 (Re-Review Fixrunde 1): OHNE `order(...)` garantiert Postgres ueber getrennte Abfragen
 * (jede Seite ist ein eigener Aufruf) KEINE stabile Reihenfolge -- Zeilen koennten zwischen zwei
 * Seiten uebersprungen ODER doppelt geliefert werden (Duplikate faengt das `Set` ab, uebersprungene
 * nicht). `order('id')` sortiert nach der eindeutigen Primaerspalte, nicht nach `match_id` (das
 * wiederholt sich je Ereignis und waere fuer sich allein nicht eindeutig genug fuer stabiles
 * Offset-Blaettern).
 *
 * Schmale, selbst definierte Client-Schnittstelle (K8, gleiches Muster wie
 * supabaseFetchConfirmed.ts): der echte, generierte Client ist zuweisungskompatibel, ein Test-
 * Doppel kann diese Kette direkt implementieren, ohne Bezug zum generierten Schema.
 */
export interface EngineMatchIdsQueryClient {
  from(table: 'match_events'): {
    select(query: string): {
      not(column: string, operator: string, value: unknown): {
        in(column: string, values: string[]): {
          order(column: string, options?: { ascending?: boolean }): {
            range(from: number, to: number): PromiseLike<{ data: { match_id: string }[] | null; error: unknown }>;
          };
        };
      };
    };
  };
}

const PAGE_SIZE = 500;

export async function fetchEngineMatchIds(
  client: EngineMatchIdsQueryClient,
  matchIds: readonly string[],
): Promise<Set<string>> {
  if (matchIds.length === 0) {
    return new Set();
  }
  const ids = new Set<string>();
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const result = await client
      .from('match_events')
      .select('match_id')
      .not('event_format', 'is', null)
      .in('match_id', [...matchIds])
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) {
      throw result.error;
    }
    const rows = result.data ?? [];
    for (const row of rows) {
      ids.add(row.match_id);
    }
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return ids;
}
