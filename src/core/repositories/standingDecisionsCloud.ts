/**
 * Cloud-Schreibweg der Gleichstands-Entscheidungen (Paket TB, Plan v2 § 3.2, R-TB-5): schreibt NUR
 * `config.standingDecisions` mit Versionsprüfung (Muster `SupabaseRepository.updateTournamentMetadata`). Das übrige
 * `config` wird unverändert übernommen (gelesen in derselben Version; ändert es sich dazwischen, greift die
 * Versionsprüfung). Rechte: RLS `tournaments_update_v3` (Eigentümer/Co-Admin), Helfer abgelehnt (@W2A-050).
 */
import type { supabase } from '../../lib/supabase';
import type { StandingDecision } from '../../types/tournament';
import type { Json } from '../../types/supabase';
import { OptimisticLockError, RepositoryError } from '../errors';

type Client = NonNullable<typeof supabase>;

const CONFLICT = 'Turnier-Daten wurden zwischenzeitlich verändert.';

export async function writeStandingDecisionsToCloud(
  client: Client,
  tournamentId: string,
  decisions: StandingDecision[],
  expectedVersion: number,
): Promise<void> {
  const { data: row, error: readError } = await client
    .from('tournaments').select('config, version').eq('id', tournamentId).single();
  if (readError !== null) {
    throw new RepositoryError('updateStandingDecisions', readError.message, readError);
  }
  if ((row.version ?? 0) !== expectedVersion) {
    throw new OptimisticLockError(CONFLICT);
  }
  const current = row.config !== null && typeof row.config === 'object' && !Array.isArray(row.config) ? row.config : {};
  const config = { ...current, standingDecisions: decisions } as unknown as Json;
  const { data: updated, error: writeError } = await client
    .from('tournaments')
    .update({ config, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('id', tournamentId)
    .eq('version', expectedVersion)
    .select('id');
  if (writeError !== null) {
    throw new RepositoryError('updateStandingDecisions', writeError.message, writeError);
  }
  if (updated.length === 0) {
    throw new OptimisticLockError(CONFLICT);
  }
}
