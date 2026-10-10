
import { SupabaseRepository } from '../repositories/SupabaseRepository';
import { LocalStorageRepository } from '../repositories/LocalStorageRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { hasGuestEngineEntries } from '../match/client/guestEngineEntries';
import { AuthenticationError, GuestStoreReadError, SessionReadError } from '../errors';
import { supabase } from '../../lib/supabase';
import {
    GenericMutationQueue,
    type GenericMutationItem,
    type FailedMutationItem as GenericFailedMutationItem,
} from './GenericMutationQueue';
import type { QueueTimers } from './mutationQueueRetry';
import { safeLocalStorage } from '../utils/safeStorage';

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

/**
 * Load-time allowlist, deliberately a `Record<MutationType, true>` and not a
 * `readonly MutationType[]`: TypeScript enforces that every key of the
 * `MutationType` union is present as a property, so adding a member to that
 * union without updating this object fails compilation. An array gave no
 * such guarantee — enqueue/execute never load, so a forgotten entry would
 * work fine online, and only offline (mutation persisted, then rejected as
 * "unknown" by isKnownType on the next load()) would the gap surface, as a
 * silently dropped user change.
 */
const KNOWN_MUTATION_TYPES: Record<MutationType, true> = {
    SAVE_TOURNAMENT: true,
    DELETE_TOURNAMENT: true,
    UPDATE_MATCH: true,
    UPDATE_MATCHES: true,
    UPDATE_TOURNAMENT_METADATA: true,
};

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

/**
 * M1 (task-C3b2-review.md): the SAVE_TOURNAMENT guard (G7) has a full `Tournament`
 * payload to check directly. UPDATE_MATCH/UPDATE_MATCHES/UPDATE_TOURNAMENT_METADATA/
 * DELETE_TOURNAMENT only carry a `tournamentId` — this loads the LOCAL copy first (the
 * account's own, not the cloud's) and applies the same guest-engine-entries check to
 * it. `localRepo.get` returning `null` (tournament not present locally on this device)
 * is NOT a guard hit — the mutation is not for a guest tournament of this device, so
 * it is sent normally (Präzisierung v2 in task-C3b2-fix-plan.md).
 *
 * Read failures (either loading the local tournament, or the guest-engine store
 * underneath `hasGuestEngineEntries`) are rethrown as `GuestStoreReadError` — see I1 —
 * so the queue counts a failed attempt instead of silently uploading or looping
 * "transient" forever.
 */
async function skipUploadForGuestEntries(
    tournamentId: string,
    localRepo: LocalStorageRepository,
): Promise<boolean> {
    let localTournament: Tournament | null;
    try {
        localTournament = await localRepo.get(tournamentId);
    } catch (error) {
        throw new GuestStoreReadError('Gast-Speicher nicht lesbar', { cause: error });
    }
    if (!localTournament) {
        return false;
    }
    try {
        return await hasGuestEngineEntries(localTournament);
    } catch (error) {
        throw new GuestStoreReadError('Gast-Speicher nicht lesbar', { cause: error });
    }
}

const LEGACY_QUEUE_KEY = 'mutation_queue_v1';
const LEGACY_FAILED_KEY = 'mutation_queue_failed_v1';

/** A-07b (@FU-006): jede Queue schreibt unter dem Schluessel ihres Kontos. */
function accountScopedKey(baseKey: string, accountId: string | undefined): string {
    return accountId ? `${baseKey}:${accountId}` : baseKey;
}

function parseQueueArray(raw: string): Array<{ id?: unknown }> | null {
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as Array<{ id?: unknown }>) : null;
    } catch {
        return null;
    }
}

/**
 * A-07b (@FU-019): Uebernimmt den Altschluessel (ohne Konto) einmalig in den Schluessel des
 * Kontos. Der Altschluessel wird erst entfernt, wenn der Schreibvorgang im Zielschluessel
 * zurückgelesen bestaetigt ist. Enthaelt der Zielschluessel schon Eintraege, werden beide
 * Listen zusammengefuehrt (ohne doppelte IDs). Unlesbare Daten bleiben unangetastet.
 */
function adoptLegacyKey(legacyKey: string, targetKey: string): void {
    const legacyRaw = safeLocalStorage.getItem(legacyKey);
    if (!legacyRaw) { return; }
    const legacyItems = parseQueueArray(legacyRaw);
    if (!legacyItems) { return; }

    let merged = legacyRaw;
    const targetRaw = safeLocalStorage.getItem(targetKey);
    if (targetRaw) {
        const targetItems = parseQueueArray(targetRaw);
        if (!targetItems) { return; }
        const known = new Set(targetItems.map((item) => item.id));
        merged = JSON.stringify([...legacyItems.filter((item) => !known.has(item.id)), ...targetItems]);
    }

    safeLocalStorage.setItem(targetKey, merged);
    if (safeLocalStorage.getItem(targetKey) !== merged) { return; }
    safeLocalStorage.removeItem(legacyKey);
}

/**
 * A-07b (@FU-006): Konto-Wache direkt vor jedem Versand. Die lokale Sitzung (kein Netz) muss
 * noch dem Konto der Warteschlange gehoeren. Sonst wirft sie `AuthenticationError`: die
 * Queue haelt wie bei abgelaufener Anmeldung an (kein Versand, kein Fehlversuch).
 */
async function assertSessionOwnsQueue(accountId: string): Promise<void> {
    if (!supabase) {
        throw new AuthenticationError('Konto der Warteschlange ist nicht mehr angemeldet');
    }
    let result: Awaited<ReturnType<typeof supabase.auth.getSession>>;
    try {
        result = await supabase.auth.getSession();
    } catch (error) {
        // Wurf = vorübergehend (kein Fehlversuch, kein Halt); der nächste Durchgang prüft erneut.
        throw new SessionReadError('Sitzung vorübergehend nicht lesbar', { cause: error });
    }
    // Ein zurückgegebener Fehler bleibt ein Halt wie bisher.
    if (result.error || result.data.session?.user.id !== accountId) {
        throw new AuthenticationError('Konto der Warteschlange ist nicht mehr angemeldet');
    }
}

export class MutationQueue extends GenericMutationQueue<MutationType> {
    constructor(
        supabaseRepo: SupabaseRepository,
        localRepo: LocalStorageRepository = new LocalStorageRepository(),
        timers?: QueueTimers,
        accountId?: string,
    ) {
        const storageKey = accountScopedKey(LEGACY_QUEUE_KEY, accountId);
        const failedStorageKey = accountScopedKey(LEGACY_FAILED_KEY, accountId);
        if (accountId) {
            // Vor dem Laden der Basisklasse: die erste angemeldete Queue übernimmt den Altbestand.
            adoptLegacyKey(LEGACY_QUEUE_KEY, storageKey);
            adoptLegacyKey(LEGACY_FAILED_KEY, failedStorageKey);
        }
        super({
            storageKey,
            failedStorageKey,
            sentryFeature: 'sync',
            ...(timers ? { timers } : {}),
            // Unknown-type items are rejected at load exactly like schema-invalid
            // ones (see GenericMutationQueue.isKnownType doc) — restores 1:1
            // load-time fidelity with the pre-extraction enum-restricted schema.
            isKnownType: (type): boolean => Object.prototype.hasOwnProperty.call(KNOWN_MUTATION_TYPES, type),

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
                if (accountId) {
                    await assertSessionOwnsQueue(accountId);
                }
                switch (item.type) {
                    case 'SAVE_TOURNAMENT': {
                        const tournament = item.payload as Tournament;
                        // G7: Turnier mit Engine-Einträgen im Gastkonto nie hochladen —
                        // auch nicht aus indirekten Enqueues (z. B. Location-Migration).
                        // Ohne Erfolgswert würde die Mutation endlos wiederholt oder ins
                        // Dead-Letter-Queue laufen; sie gilt daher als erledigt (A6-Muster:
                        // Erfolg ohne Upload, siehe matchProtectionNotices.ts).
                        // Lesefehler des Speichers (PC29): das Praedikat wirft, der Fehler
                        // laeuft weiter → Versuch schlaegt fehl, Mutation bleibt erhalten
                        // (Retry/Backoff); nur ein sicheres `true` gilt als erledigt.
                        let hasEntries: boolean;
                        try {
                            hasEntries = await hasGuestEngineEntries(tournament);
                        } catch (error) {
                            // I1: eigene, NICHT-transiente Klasse weiterreichen (fester Text, kein
                            // Fremdtext) — ein IndexedDB-AbortError gaelte sonst als „transient"
                            // (kein retryCount) und die Mutation liefe endlos ohne Zaehlung.
                            throw new GuestStoreReadError('Gast-Speicher nicht lesbar', { cause: error });
                        }
                        if (hasEntries) {
                            break;
                        }
                        await supabaseRepo.save(tournament);
                        break;
                    }
                    case 'DELETE_TOURNAMENT': {
                        const tournamentId = item.payload as string;
                        if (await skipUploadForGuestEntries(tournamentId, localRepo)) {
                            break;
                        }
                        await supabaseRepo.delete(tournamentId);
                        break;
                    }
                    case 'UPDATE_MATCH': {
                        const { tournamentId, update } = item.payload as { tournamentId: string, update: MatchUpdate };
                        if (await skipUploadForGuestEntries(tournamentId, localRepo)) {
                            break;
                        }
                        await supabaseRepo.updateMatch(tournamentId, update);
                        break;
                    }
                    case 'UPDATE_MATCHES': {
                        const { tournamentId, updates } = item.payload as { tournamentId: string, updates: MatchUpdate[] };
                        if (await skipUploadForGuestEntries(tournamentId, localRepo)) {
                            break;
                        }
                        await supabaseRepo.updateMatches(tournamentId, updates);
                        break;
                    }
                    case 'UPDATE_TOURNAMENT_METADATA': {
                        const { tournamentId, metadata } = item.payload as { tournamentId: string, metadata: Partial<Tournament> };
                        if (await skipUploadForGuestEntries(tournamentId, localRepo)) {
                            break;
                        }
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
