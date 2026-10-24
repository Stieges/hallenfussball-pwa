
import { SupabaseRepository } from '../repositories/SupabaseRepository';
import { LocalStorageRepository } from '../repositories/LocalStorageRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { hasGuestEngineEntries } from '../match/client/guestEngineEntries';
import { AuthenticationError, GuestStoreReadError, isVersionConflict, OptimisticLockError, OwnDecisionConflictError, RepositoryError, SessionReadError } from '../errors';
import { carriesNewDecision, type CompleteGroupRequest } from '../repositories/groupCompletionCloud';
import { supabase } from '../../lib/supabase';
import {
    GenericMutationQueue,
    type GenericMutationItem,
    type FailedMutationItem as GenericFailedMutationItem,
} from './GenericMutationQueue';
import type { QueueTimers } from './mutationQueueRetry';
import { executeMetadataMutation, mergeMetadataPayloads, type MetadataMutationPayload } from './metadataMutation';
import { safeLocalStorage } from '../utils/safeStorage';
import { checkedVersion, withCheckedVersion } from '../repositories/confirmedVersion';
import { nextVersionIsOwnDecision, rememberOwnDecisionVersion } from '../repositories/ownDecisionVersions';
import { captureFeatureError } from '../../lib/sentry';

export { MAX_RETRIES, type MutationQueueStatus } from './GenericMutationQueue';

/**
 * Supported mutation types
 */
export type MutationType =
    | 'SAVE_TOURNAMENT'
    | 'DELETE_TOURNAMENT'
    | 'UPDATE_MATCH'
    | 'UPDATE_MATCHES'
    | 'UPDATE_TOURNAMENT_METADATA'
    /** A-15c (@W2A-062, @TM-115, @TM-146, @TM-147): ohne Netz abgeschlossene Gruppe, nachgereicht über `complete_group`. */
    | 'COMPLETE_GROUP';

/** A-15c: Nutzlast von `COMPLETE_GROUP` – Anfrage wie online (immer `fromQueue`) und die bestätigte Version beim Abschluss. */
export interface CompleteGroupMutation {
    tournamentId: string;
    request: CompleteGroupRequest;
    /** `checkedVersion` der lokalen Kopie beim Abschluss (für das Anheben wartender Speicherungen, @FU-110). */
    baseVersion?: number;
}

/**
 * A-15c: nachgereichten Abschluss senden. Angenommen (auch „schon so abgeschlossen“ – zweimal nachreichen ist harmlos) → Marke
 * „noch nicht gesendet“ weg, erreichte Version zurück. Konflikt (der Server legt die Klärung an) oder sonstige Ablehnung →
 * `OptimisticLockError`: der Eintrag landet sofort als Konflikt in der Fehlerliste, nichts wird wiederholt oder still
 * überschrieben (@TM-116, @TM-146, @TM-147). Kein Recht (42501) bleibt ein unklarer Fehler (wird wiederholt).
 */
async function sendCompleteGroup(
    supabaseRepo: SupabaseRepository,
    localRepo: LocalStorageRepository,
    payload: CompleteGroupMutation,
): Promise<number | undefined> {
    const { tournamentId, request } = payload;
    const result = await supabaseRepo.completeGroup(tournamentId, { ...request, fromQueue: true });
    switch (result.status) {
        case 'ok':
            try {
                await localRepo.markCompletionSent(tournamentId, request.groupId);
            } catch (error) {
                captureFeatureError(error instanceof Error ? error : new Error(String(error)), 'sync', 'markCompletionSent', { tournamentId });
            }
            return result.tournamentVersion;
        case 'forbidden':
            throw new RepositoryError('completeGroup', 'keine Berechtigung', { code: '42501', message: 'keine Berechtigung' });
        case 'clarification':
            throw new OptimisticLockError(`complete_group: clarification ${result.code}`);
        case 'rejected':
            throw new OptimisticLockError(`complete_group: rejected ${result.code}`);
    }
}

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
    COMPLETE_GROUP: true,
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

/**
 * C-VERSION-MEHRDEUTIG: bestätigten Upload lokal vermerken. Der Server hat schon gespeichert – ein Fehler beim Vermerk
 * wird gemeldet, löst aber keinen zweiten Versuch aus (der träfe die eigene, neue Server-Version als Konflikt).
 */
async function confirmLocally(localRepo: LocalStorageRepository, tournamentId: string, base: number | undefined, reached: number): Promise<void> {
    try {
        await localRepo.confirmUpload(tournamentId, base, reached); // C-VERSION-NACH-ERSTANLAGE: die vom Server gemeldete Version
    } catch (error) {
        captureFeatureError(error instanceof Error ? error : new Error(String(error)), 'sync', 'confirmUpload', { tournamentId });
    }
}

/**
 * BP-1 (@FU-123, Befund C-WARTESCHLANGE-LEGT-GELOESCHTES-NEU-AN): Kennt dieses Gerät das Turnier aus der Cloud? Ja, wenn die
 * Nutzlast oder die lokale Kopie eine Änderungszählung der Cloud trägt (`changeRevision`, nur ein Cloud-Abruf setzt sie, A-10)
 * oder eine Kette eigener bestätigter Uploads (`ownUploadsFrom`, nur `confirmUpload` setzt sie). Dann darf ein Speichern das
 * Turnier nicht neu anlegen. Ist die lokale Kopie nicht lesbar, zählt nur die Nutzlast.
 */
async function knownFromCloud(tournament: Tournament, localRepo: LocalStorageRepository): Promise<boolean> {
    const marked = (t: Tournament | null | undefined): boolean => t?.changeRevision !== undefined || t?.ownUploadsFrom !== undefined;
    if (marked(tournament)) { return true; }
    try {
        return marked(await localRepo.get(tournament.id));
    } catch {
        return false;
    }
}

/** A-08f3c2 (Regel Q): Turnier eines Eintrags -- SAVE trägt das Turnier, DELETE die ID, die übrigen `tournamentId`. */
function tournamentIdOf(type: MutationType, payload: unknown): string | null {
    if (type === 'SAVE_TOURNAMENT') { return (payload as Tournament | null)?.id ?? null; }
    if (type === 'DELETE_TOURNAMENT') { return typeof payload === 'string' ? payload : null; }
    return (payload as { tournamentId?: string } | null)?.tournamentId ?? null;
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
 * A-07i: liefert `false`, wenn der Zielschluessel nicht im echten Speicher angekommen ist –
 * der Altschluessel bleibt dann stehen (kein Verlust), der Aufrufer meldet die Stoerung.
 */
function adoptLegacyKey(legacyKey: string, targetKey: string): boolean {
    const legacyRaw = safeLocalStorage.getItem(legacyKey);
    if (!legacyRaw) { return true; }
    const legacyItems = parseQueueArray(legacyRaw);
    if (!legacyItems) { return true; }

    let merged = legacyRaw;
    const targetRaw = safeLocalStorage.getItem(targetKey);
    if (targetRaw) {
        const targetItems = parseQueueArray(targetRaw);
        if (!targetItems) { return true; }
        const known = new Set(targetItems.map((item) => item.id));
        merged = JSON.stringify([...legacyItems.filter((item) => !known.has(item.id)), ...targetItems]);
    }

    if (!safeLocalStorage.setItemPersisted(targetKey, merged)) { return false; }
    safeLocalStorage.removeItem(legacyKey);
    return true;
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
        let adoptionFailed = false;
        /** @FU-110: erreichte Server-Version je erfolgreich gesendetem SAVE_TOURNAMENT (nur bis `rebasePending`). */
        const reachedById = new Map<string, number>();
        /** A-15c: Version nach einem nachgereichten Abschluss, der nur die eigene Basis um eins weitergezählt hat. */
        const completedById = new Map<string, { base: number; reached: number }>();
        if (accountId) {
            // Vor dem Laden der Basisklasse: die erste angemeldete Queue übernimmt den Altbestand.
            const queueAdopted = adoptLegacyKey(LEGACY_QUEUE_KEY, storageKey);
            const failedAdopted = adoptLegacyKey(LEGACY_FAILED_KEY, failedStorageKey);
            adoptionFailed = !queueAdopted || !failedAdopted;
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
                const id = tournamentIdOf(type, payload);
                if (!id) { return null; }
                if (type === 'SAVE_TOURNAMENT') { return `SAVE_TOURNAMENT:${id}`; }
                return type === 'UPDATE_TOURNAMENT_METADATA' ? `UPDATE_METADATA:${id}` : null;
            },
            coalescePayload: (type, existing, incoming) => {
                if (type !== 'UPDATE_TOURNAMENT_METADATA') { return incoming; }
                // @BM-072/@BM-073: ein Teilen-Rückfall prüft am Server „noch kein Code“ und schreibt nur den Code – er verträgt
                // weder fremde Felder noch das Verdrängen; deshalb nie zusammenfassen (angehängt, Reihenfolge bleibt).
                const isShare = (p: unknown): boolean => (p as MetadataMutationPayload | null)?.onlyIfUnshared === true;
                if (isShare(existing) || isShare(incoming)) { return null; }
                // @FU-125: die jüngere Änderung gewinnt je Angabe, keine geht verloren
                return mergeMetadataPayloads(existing as MetadataMutationPayload, incoming as MetadataMutationPayload);
            },
            scopeOf: tournamentIdOf, // A-08f3c2 (Regel Q): Zähler und Dead-Letter je Turnier
            // @FU-106 (Auflage A1), @FU-109: bis zum Laden des Server-Stands warten nur Voll-Speicherungen (Einstellungen, Teams,
            // Spielplan); Spielergebnisse und -ereignisse gehen weiter zum Server (eigene Wege, Record präzisiert 21.10.)
            wholeCopyTypes: ['SAVE_TOURNAMENT'],
            cloudCopyOnConflict: ['COMPLETE_GROUP'], // A-15c (@TM-117): nach einem Konflikt den Stand des Servers zeigen
            /**
             * Befund C-ZWEITES-SPEICHERN-EIGENE-VORVERSION (@FU-110): nach einem bestätigten Upload `base → reached` beruhen
             * wartende SAVE_TOURNAMENT desselben Turniers mit Basis `base` auf dem eigenen Stand – sie prüfen gegen `reached`.
             * Fremde Stände bleiben geschützt: `reached` hat nachweislich dieses Gerät erzeugt.
             */
            rebasePending: (done, pending) => {
                if (done.type === 'COMPLETE_GROUP') {
                    // A-15c: der Abschluss hat nur die eigenen Entscheidungen eingetragen (Basis + 1) – wartende Speicherungen
                    // desselben Turniers auf dieser Basis beruhen auf dem eigenen Stand (wie @FU-110)
                    const step = completedById.get(done.id);
                    completedById.delete(done.id);
                    if (step === undefined) { return undefined; }
                    const id = (done.payload as CompleteGroupMutation).tournamentId;
                    return pending.flatMap((p) => {
                        const t = p.payload as Tournament;
                        const same = p.type === 'SAVE_TOURNAMENT' && t.id === id && checkedVersion(t) === step.base;
                        return same ? [{ id: p.id, payload: { ...t, serverVersion: step.reached } }] : [];
                    });
                }
                if (done.type !== 'SAVE_TOURNAMENT') { return undefined; }
                const reached = reachedById.get(done.id);
                reachedById.delete(done.id);
                const doneT = done.payload as Tournament;
                if (reached === undefined) { return undefined; }
                return pending.flatMap((p) => {
                    const t = p.payload as Tournament;
                    const same = p.type === 'SAVE_TOURNAMENT' && t.id === doneT.id && checkedVersion(t) === checkedVersion(doneT);
                    return same ? [{ id: p.id, payload: { ...t, serverVersion: reached } }] : [];
                });
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
                        // C-VERSION-MEHRDEUTIG (@FU-106): geprüft wird gegen die bestätigte Version der (zusammengefassten)
                        // Nutzlast, nie gegen die lokal gestempelte; danach gilt der Upload als bestätigt.
                        const base = checkedVersion(tournament);
                        const payload = withCheckedVersion(tournament);
                        // @FU-123: ein aus der Cloud bekanntes Turnier nicht neu anlegen; sonst (@FU-124) unverändert
                        let reached: number;
                        try {
                            reached = await (await knownFromCloud(tournament, localRepo)
                                ? supabaseRepo.save(payload, { mustExist: true })
                                : supabaseRepo.save(payload));
                        } catch (error) {
                            // @W2A-077: war die Version nach der Basis die eigene Gleichstands-Entscheidung, ist es kein anderes Gerät
                            throw isVersionConflict(error) && nextVersionIsOwnDecision(tournament.id, base) ? new OwnDecisionConflictError(error) : error;
                        }
                        reachedById.set(item.id, reached); // @FU-110: für das Anheben wartender Einträge (rebasePending)
                        await confirmLocally(localRepo, tournament.id, base, reached);
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
                        const payload = item.payload as MetadataMutationPayload;
                        if (await skipUploadForGuestEntries(payload.tournamentId, localRepo)) {
                            break;
                        }
                        await executeMetadataMutation(supabaseRepo, localRepo, payload); // CA-3: Teilen-Rückfall bedingt (@BM-070)
                        break;
                    }
                    case 'COMPLETE_GROUP': {
                        const payload = item.payload as CompleteGroupMutation;
                        if (await skipUploadForGuestEntries(payload.tournamentId, localRepo)) {
                            break;
                        }
                        const reached = await sendCompleteGroup(supabaseRepo, localRepo, payload);
                        const base = payload.baseVersion;
                        // Review #368 H1: complete_group zählt die Version nur bei neuen Entscheidungen. Ohne neue Entscheidung
                        // stammt ein Sprung um eins von jemand anderem – dann weder bestätigen noch anheben (@TM-116, @FU-110).
                        if (base !== undefined && carriesNewDecision(payload.request) && reached === base + 1) {
                            completedById.set(item.id, { base, reached });
                            rememberOwnDecisionVersion(payload.tournamentId, reached); // @W2A-077
                            await confirmLocally(localRepo, payload.tournamentId, base, reached);
                        }
                        break;
                    }
                    default:
                        throw new Error(`Unknown mutation type: ${item.type as string}`);
                }
            },
        });
        if (adoptionFailed) { this.reportStorageFailure('adoptLegacyKey'); }
    }
}
