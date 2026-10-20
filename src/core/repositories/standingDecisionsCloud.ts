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
import { parseStandingDecisions } from '../models/schemas/StandingDecisionSchema';
import { parsePlacementsToPlayOut } from '../standings/playOutPlaces';

type Client = NonNullable<typeof supabase>;

const CONFLICT = 'Turnier-Daten wurden zwischenzeitlich verändert.';

/** Schreibt EIN Feld des `config` mit Versionsprüfung; das übrige `config` bleibt, wie es in der Cloud steht. */
async function writeConfigField(
  client: Client,
  tournamentId: string,
  context: 'updateStandingDecisions' | 'updatePlacementsToPlayOut',
  field: string,
  value: unknown,
  expectedVersion: number,
): Promise<void> {
  const { data: row, error: readError } = await client
    .from('tournaments').select('config, version').eq('id', tournamentId).single();
  if (readError !== null) {
    throw new RepositoryError(context, readError.message, readError);
  }
  if ((row.version ?? 0) !== expectedVersion) {
    throw new OptimisticLockError(CONFLICT);
  }
  const current = row.config !== null && typeof row.config === 'object' && !Array.isArray(row.config) ? row.config : {};
  const config = { ...current, [field]: value } as unknown as Json;
  const { data: updated, error: writeError } = await client
    .from('tournaments')
    .update({ config, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('id', tournamentId)
    .eq('version', expectedVersion)
    .select('id');
  if (writeError !== null) {
    throw new RepositoryError(context, writeError.message, writeError);
  }
  if (updated.length === 0) {
    throw new OptimisticLockError(CONFLICT);
  }
}

export function writeStandingDecisionsToCloud(
  client: Client,
  tournamentId: string,
  decisions: StandingDecision[],
  expectedVersion: number,
): Promise<void> {
  // Nur, was das Schema kennt: Altwerte mit Person, Zeit und Grund aus einer lokalen Kopie kommen nie ins config (@W2A-072).
  return writeConfigField(client, tournamentId, 'updateStandingDecisions', 'standingDecisions', parseStandingDecisions(decisions) ?? [], expectedVersion);
}

/**
 * Fixrunde TB-6: schreibt NUR `config.placementsToPlayOut` (Einstellung „Plätze ausspielen“), mit Versionsprüfung. Entscheidungen
 * im `config` (etwa die einer anderen Person) bleiben unberührt – kein Voll-Speichern aus einem veralteten lokalen Stand.
 */
export function writePlacementsToPlayOutToCloud(
  client: Client,
  tournamentId: string,
  places: number[],
  expectedVersion: number,
): Promise<void> {
  return writeConfigField(client, tournamentId, 'updatePlacementsToPlayOut', 'placementsToPlayOut', parsePlacementsToPlayOut(places), expectedVersion);
}
