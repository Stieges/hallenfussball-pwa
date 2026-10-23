/**
 * Die Quelle der Zuschauer-Seite (B-15): die Server-Funktion `public_tournament` (Adapter (b)). Seit dem Einspielen von
 * B-14 (`20261117_104`, live 23.10.) liest anon die Tabellen nicht mehr; der frühere Schalter `PUBLIC_TOURNAMENT_RPC`
 * entfällt (@ZM-021, @ZM-068, @ZM-109).
 */
import { createRpcPublicSource } from './rpcPublicSource';
import type { PublicTournamentSource } from './publicSource';

export const defaultPublicTournamentSource: PublicTournamentSource = createRpcPublicSource();
