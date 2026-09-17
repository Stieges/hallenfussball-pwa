
import { SupabaseRepository } from '../repositories/SupabaseRepository';
import { Tournament, MatchUpdate } from '../models/types';
import {
    GenericMutationQueue,
    type GenericMutationItem,
    type FailedMutationItem as GenericFailedMutationItem,
} from './GenericMutationQueue';

export { MAX_RETRIES, type MutationQueueStatus } from './GenericMutationQueue';

/**
 * Supported mutation types
 */
export type MutationType =
    | 'SAVE_TOURNAMENT'
    | 'DELETE_TOURNAMENT'
    | 'UPDATE_MATCH'
    | 'UPDATE_MATCHES'
    | 'UPDATE_TOURNAMENT_METADATA';

const KNOWN_MUTATION_TYPES: readonly MutationType[] = [
    'SAVE_TOURNAMENT',
    'DELETE_TOURNAMENT',
    'UPDATE_MATCH',
    'UPDATE_MATCHES',
    'UPDATE_TOURNAMENT_METADATA',
];

/**
 * A requested change to be persisted to the cloud.
 *
 * GenericMutationItem<TType>.payload is `unknown` by design (it is shared
 * machinery, not tournament-specific). The existing tournament queue and its
 * consumers/tests rely on `payload: any` (with the established
 * eslint-disable), so it is preserved here locally rather than propagated
 * from the generic type — compatibility beats elegance for this extraction.
 */
export type MutationItem = Omit<GenericMutationItem<MutationType>, 'payload'> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
};

/**
 * A mutation that failed permanently (exceeded max retries).
 *
 * Bound explicitly to MutationType (not re-exported bare from
 * GenericMutationQueue, whose FailedMutationItem<TType> defaults to
 * `string`) so `import { FailedMutationItem } from './MutationQueue'`
 * yields `type: MutationType` / `payload: any`, exactly as before the
 * extraction — not `type: string` / `payload: unknown`.
 */
export type FailedMutationItem = Omit<GenericFailedMutationItem<MutationType>, 'payload'> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
};

export class MutationQueue extends GenericMutationQueue<MutationType> {
    constructor(supabaseRepo: SupabaseRepository) {
        super({
            storageKey: 'mutation_queue_v1',
            failedStorageKey: 'mutation_queue_failed_v1',
            sentryFeature: 'sync',
            // Unknown-type items are rejected at load exactly like schema-invalid
            // ones (see GenericMutationQueue.isKnownType doc) — restores 1:1
            // load-time fidelity with the pre-extraction enum-restricted schema.
            isKnownType: (type): boolean => (KNOWN_MUTATION_TYPES as readonly string[]).includes(type),

            /**
             * Get a coalesce key for mutations that can be merged.
             * Returns null if the mutation type doesn't support coalescing.
             *
             * Coalescing rules:
             * - SAVE_TOURNAMENT: Coalesce by tournament ID (keep latest full state)
             * - UPDATE_TOURNAMENT_METADATA: Coalesce by tournament ID
             * - DELETE_TOURNAMENT: Do NOT coalesce (order matters for delete)
             * - UPDATE_MATCH/UPDATE_MATCHES: Do NOT coalesce (granular updates)
             */
            coalesceKey: (type, payload) => {
                switch (type) {
                    case 'SAVE_TOURNAMENT': {
                        // Tournament has 'id' field
                        const tournament = payload as Tournament;
                        return tournament?.id ? `SAVE_TOURNAMENT:${tournament.id}` : null;
                    }
                    case 'UPDATE_TOURNAMENT_METADATA': {
                        // Payload has 'tournamentId' field
                        const meta = payload as { tournamentId: string };
                        return meta?.tournamentId ? `UPDATE_METADATA:${meta.tournamentId}` : null;
                    }
                    default:
                        // No coalescing for other types
                        return null;
                }
            },

            execute: async (item) => {
                switch (item.type) {
                    case 'SAVE_TOURNAMENT':
                        await supabaseRepo.save(item.payload as Tournament);
                        break;
                    case 'DELETE_TOURNAMENT':
                        await supabaseRepo.delete(item.payload as string);
                        break;
                    case 'UPDATE_MATCH': {
                        const { tournamentId, update } = item.payload as { tournamentId: string, update: MatchUpdate };
                        await supabaseRepo.updateMatch(tournamentId, update);
                        break;
                    }
                    case 'UPDATE_MATCHES': {
                        const { tournamentId, updates } = item.payload as { tournamentId: string, updates: MatchUpdate[] };
                        await supabaseRepo.updateMatches(tournamentId, updates);
                        break;
                    }
                    case 'UPDATE_TOURNAMENT_METADATA': {
                        const { tournamentId, metadata } = item.payload as { tournamentId: string, metadata: Partial<Tournament> };
                        await supabaseRepo.updateTournamentMetadata(tournamentId, metadata);
                        break;
                    }
                    default:
                        throw new Error(`Unknown mutation type: ${item.type as string}`);
                }
            },
        });
    }
}
