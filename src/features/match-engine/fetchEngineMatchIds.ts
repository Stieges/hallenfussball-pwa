/**
 * W3: Sammelabfrage "welche Spiele dieses Turniers haben Engine-Ereignisse" -- eine Abfrage
 * je Turnier-Laden statt einer je Spiel. Nur `match_id` wird selektiert.
 *
 * Schmale, selbst definierte Client-Schnittstelle (K8, gleiches Muster wie
 * supabaseFetchConfirmed.ts): der echte, generierte Client ist zuweisungskompatibel, ein Test-
 * Doppel kann diese Kette direkt implementieren, ohne Bezug zum generierten Schema.
 */
export interface EngineMatchIdsQueryClient {
  from(table: 'match_events'): {
    select(query: string): {
      not(column: string, operator: string, value: unknown): {
        in(column: string, values: string[]): PromiseLike<{ data: { match_id: string }[] | null; error: unknown }>;
      };
    };
  };
}

export async function fetchEngineMatchIds(
  client: EngineMatchIdsQueryClient,
  matchIds: readonly string[],
): Promise<Set<string>> {
  if (matchIds.length === 0) {
    return new Set();
  }
  const result = await client
    .from('match_events')
    .select('match_id')
    .not('event_format', 'is', null)
    .in('match_id', [...matchIds]);
  if (result.error) {
    throw result.error;
  }
  return new Set((result.data ?? []).map((row) => row.match_id));
}
