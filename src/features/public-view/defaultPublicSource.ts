/**
 * Die Quelle der Zuschauer-Seite (B-15): heute der Weg über `getByShareCode` (Adapter (a)); die Server-Funktion
 * `public_tournament` (Adapter (b)) erst, wenn der Schalter `PUBLIC_TOURNAMENT_RPC` gesetzt ist – nach dem
 * Datenbank-Fenster von B-14.
 */
import { FEATURE_FLAGS } from '../../config/featureFlags';
import { createLegacyPublicSource } from './legacyPublicSource';
import { createRpcPublicSource } from './rpcPublicSource';
import type { PublicTournamentSource } from './publicSource';

export function selectPublicSource(rpcEnabled: boolean): PublicTournamentSource {
  return rpcEnabled ? createRpcPublicSource() : createLegacyPublicSource();
}

export const defaultPublicTournamentSource: PublicTournamentSource = selectPublicSource(FEATURE_FLAGS.PUBLIC_TOURNAMENT_RPC);
