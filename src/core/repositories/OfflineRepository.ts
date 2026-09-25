import { MutationQueue } from '../services/MutationQueue';
import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { LocalStorageRepository } from './LocalStorageRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { isAbortError, RepositoryError } from '../errors';
import { captureFeatureError } from '../../lib/sentry';

/**
 * A2 Fixrunde 3 (N2a, `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/
 * task-A2-rereview.md`): `GenericMutationQueue` persists its queue via `JSON.stringify` /
 * `JSON.parse` (survives app restarts and dead-letter retries). `JSON.stringify` DROPS a
 * present-but-`undefined`-valued key entirely (`JSON.stringify({scoreA: undefined}) === '{}'`),
 * so an "explicit clear" (a caller sets `field: undefined` with the key present, e.g.
 * `MatchExecutionService#unskipMatch`) that made it into the queue as an in-memory object would
 * survive the CURRENT session but silently lose the clear on reload/replay. Normalizing
 * `undefined` (key present) to `null` right before enqueueing makes every clear JSON-round-trip
 * safe -- `mapMatchUpdateToSupabase` already treats a present `null` exactly like a present
 * `undefined` (writes the column's `NULL`/default), so this changes nothing for the immediate,
 * same-session path, only the persisted/replayed one.
 */
function normalizeMatchUpdateForQueue(update: MatchUpdate): MatchUpdate {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(update)) {
        normalized[key] = value === undefined ? null : value;
    }
    return normalized as MatchUpdate;
}

// =============================================================================
// SYNC TYPES
// =============================================================================

export type SyncStatus = 'synced' | 'updated' | 'conflict' | 'error' | 'offline';

export interface SyncResult {
    status: SyncStatus;
    data?: Tournament;
    error?: string;
    conflicts?: SyncConflict[];
}

export interface SyncConflict {
    id: string;
    entityType: 'match' | 'tournament';
    entityId: string;
    entityName: string;
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    localTimestamp: string;
    remoteTimestamp: string;
    remoteUser?: string;
}

/**
 * Stabiler Vergleichs-Schlüssel für JSON-artige Werte.
 *
 * Nötig, weil Postgres `jsonb` die Schlüsselreihenfolge NICHT erhält: ein Objekt, das über
 * tournaments.config in die Cloud geschrieben und wieder gelesen wird, kommt in interner
 * Sortierung zurück (Länge, dann lexikografisch), während die lokale Kopie ihre ursprüngliche
 * Reihenfolge behält. Ein roher JSON.stringify-Vergleich meldet deshalb ab dem ersten
 * Cloud-Round-Trip bei JEDEM Sync eine Änderung und erzwingt dauerhaft den Voll-Save-Pfad.
 * Empirisch am Live-Projekt belegt (2026-09-17).
 */
function stableKey(value: unknown): string {
    return JSON.stringify(value, (_k, v: unknown) => {
        if (v === null || typeof v !== 'object' || Array.isArray(v)) { return v; }
        const source = v as Record<string, unknown>;
        return Object.keys(source).sort().reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = source[key];
            return acc;
        }, {});
    });
}

/**
 * SQLSTATE, mit dem `make_tournament_public` eine noch nicht freigegebene (Entwurfs-)
 * Turnierfreigabe ablehnt — siehe supabase/migrations/20260918_002_make_public_refuses_drafts.sql.
 *
 * Bewusst NICHT im 'PT'-Namespace (z.B. 'PT001'): PostgREST liest SQLSTATEs der Form PTxyz
 * als HTTP-Status-Override. 'PT001' waere "HTTP-Status 1" — keine gueltige Response, weder
 * code noch message kommen beim Client an. 'HF' ist unreserviert und faellt bei PostgREST
 * auf HTTP 400 zurueck.
 */
const RELEASE_REFUSAL_CODE = 'HF001';

/** Ältere Fassung der Funktion kannte den eigenen SQLSTATE noch nicht. */
const RELEASE_REFUSAL_MARKER = 'has not been released';

/**
 * Fachliche Ablehnung des Servers, kein Verbindungsproblem: Der lokale Fallback würde das
 * Turnier lokal öffentlich machen und eine Mutation einreihen, die der Server dauerhaft
 * ablehnt. Die Ablehnung wird stattdessen durchgereicht, damit die UI sie anzeigen kann.
 *
 * Primär am SQLSTATE erkannt, nicht am Meldungstext: Ein Textvergleich koppelt den Client an
 * eine Zeichenkette in einer SQL-Datei, und driftet die, fällt der Guard STILL in den lokalen
 * Fallback zurück — also genau in das Verhalten, das er verhindern soll. Der Textvergleich
 * bleibt nur als Rückfall für eine noch nicht migrierte Datenbank.
 */
export function isReleaseRefusal(error: unknown): boolean {
    if (!(error instanceof Error)) { return false; }
    const original = error instanceof RepositoryError ? error.originalError : undefined;
    const code = (original as { code?: unknown } | undefined)?.code;
    if (typeof code === 'string' && code === RELEASE_REFUSAL_CODE) { return true; }
    return error.message.includes(RELEASE_REFUSAL_MARKER);
}

export class OfflineRepository implements ITournamentRepository {
    private _mutationQueue: MutationQueue;

    constructor(
        private localRepo: LocalStorageRepository,
        private supabaseRepo: SupabaseRepository
    ) {
        this._mutationQueue = new MutationQueue(supabaseRepo);
    }

    /**
     * Get the mutation queue instance for status subscriptions
     */
    get mutationQueue(): MutationQueue {
        return this._mutationQueue;
    }

    /**
     * LOCAL-FIRST STRATEGY:
     * 1. Try local storage first (instant response)
     * 2. If found: return immediately, trigger background cloud sync
     * 3. If not found locally: try cloud, cache result
     *
     * This avoids blocking on auth/network issues after navigation.
     */
    async get(id: string): Promise<Tournament | null> {
        // 1. LOCAL-FIRST: Try local storage immediately
        const localData = await this.localRepo.get(id);

        if (localData) {
            // Found locally - return immediately, sync in background
            void this.refreshFromCloudInBackground(id);
            return localData;
        }

        // 2. Not found locally - try cloud
        try {
            const cloudData = await this.supabaseRepo.get(id);

            if (cloudData) {
                // Cache for next time
                await this.localRepo.save(cloudData);
                return cloudData;
            }
        } catch (error) {
            if (!isAbortError(error)) {
                console.warn('OfflineRepository: Cloud fetch failed.', error);
                if (error instanceof Error) {
                    captureFeatureError(error, 'repository', 'get', { tournamentId: id });
                }
            }
        }

        return null;
    }

    /**
     * Background sync: Fetches latest from cloud and updates local if newer.
     * Non-blocking, errors are silently ignored.
     */
    private async refreshFromCloudInBackground(id: string): Promise<void> {
        try {
            const cloudData = await this.supabaseRepo.get(id);
            if (cloudData) {
                // Only update if cloud version is newer
                const localData = await this.localRepo.get(id);
                const cloudVersion = cloudData.version ?? 0;
                const localVersion = localData?.version ?? 0;

                // Zweiter Grund neben einer neueren Version: Vor M1 hat der Mapper `isPublic`
                // gar nicht gelesen, lokale Kopien tragen dort `undefined`. Bei gleichem
                // Versionsstand griffe der Refresh sonst nie — und der nächste Voll-Save
                // schriebe erneut `is_public: false` auf alle Team- und Spielzeilen.
                // N3: Nur wenn die Cloud nicht ÄLTER ist. Sonst überschriebe eine offline
                // vorgenommene Veröffentlichung (lokale Version voraus, Queue noch nicht
                // abgespielt) sich selbst mit dem älteren Cloud-Stand.
                const visibilityStale = localData !== null
                    && localData.isPublic !== cloudData.isPublic
                    && cloudVersion >= localVersion;

                if (cloudVersion > localVersion || visibilityStale) {
                    await this.localRepo.save(cloudData);
                    if (import.meta.env.DEV) {
                        // eslint-disable-next-line no-console -- Debug logging for background sync updates
                        console.log(`[OfflineRepository] Background sync: Updated tournament ${id} from v${localVersion} to v${cloudVersion}${visibilityStale ? ' (isPublic war veraltet)' : ''}`);
                    }
                }
            }
        } catch (error) {
            if (!isAbortError(error) && error instanceof Error) {
                captureFeatureError(error, 'repository', 'backgroundSync', { tournamentId: id });
            }
        }
    }

    async getByShareCode(code: string): Promise<Tournament | null> {
        // Share code lookups are primarily online
        try {
            return await this.supabaseRepo.getByShareCode(code);
        } catch (error) {
            // Only log non-AbortErrors (AbortError is expected during navigation)
            if (!isAbortError(error)) {
                console.warn('OfflineRepository: Cloud fetch by share code failed.', error);
                if (error instanceof Error) {
                    captureFeatureError(error, 'repository', 'getByShareCode');
                }
            }
            return null;
        }
    }

    /**
     * PERSISTENCE STRATEGY:
     * 1. Save Local (Optimistic UI)
     * 2. Enqueue Mutation (Persistent Background Sync)
     */
    async save(tournament: Tournament): Promise<void> {
        // 1. Save Local
        await this.localRepo.save(tournament);

        // 2. Enqueue Cloud Persistence
        this.mutationQueue.enqueue('SAVE_TOURNAMENT', tournament);
    }

    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
        // Local write keeps the ORIGINAL update (undefined-with-key-present semantics, resolved
        // against the in-memory Match by LocalStorageRepository) -- only the QUEUED copy is
        // normalized for the JSON round-trip (N2a).
        await this.localRepo.updateMatch(tournamentId, update);
        this.mutationQueue.enqueue('UPDATE_MATCH', { tournamentId, update: normalizeMatchUpdateForQueue(update) });
    }

    async updateMatches(tournamentId: string, updates: MatchUpdate[], _baseVersion?: number): Promise<void> {
        await this.localRepo.updateMatches(tournamentId, updates);
        this.mutationQueue.enqueue('UPDATE_MATCHES', {
            tournamentId,
            updates: updates.map(normalizeMatchUpdateForQueue),
        });
    }

    async delete(id: string): Promise<void> {
        await this.localRepo.delete(id);
        this.mutationQueue.enqueue('DELETE_TOURNAMENT', id);
    }

    async updateTournamentMetadata(id: string, metadata: Partial<Tournament>): Promise<void> {
        await this.localRepo.updateTournamentMetadata(id, metadata);
        this.mutationQueue.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: id, metadata });
    }

    // --- Extended Methods for Sync ---

    /**
     * Lists tournaments.
     * Strategy:
     * - Try Cloud List + Merge with Local-only tournaments
     * - If fail: Return Local List.
     */
    async listForCurrentUser(): Promise<Tournament[]> {
        try {
            // Create a timeout promise (5s) to avoid hanging indefinitely if network is slow/flaky
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Cloud fetch timeout')), 5000)
            );

            // Race between cloud fetch and timeout
            const cloudList = await Promise.race([
                this.supabaseRepo.listForCurrentUser(),
                timeoutPromise
            ]);
            const localList = await this.localRepo.listForCurrentUser();

            // Merge: Add local-only tournaments that haven't been synced yet
            const cloudIds = new Set(cloudList.map(t => t.id));
            const localOnly = localList.filter(t => !cloudIds.has(t.id));

            // Return cloud list + unsynced local tournaments
            // Local-only items are marked so UI can show sync indicator if needed
            return [...cloudList, ...localOnly];
        } catch (error) {
            // Only log non-AbortErrors (AbortError is expected during navigation)
            if (!isAbortError(error)) {
                console.warn('OfflineRepository: Cloud list failed, returning local list.', error);
                if (error instanceof Error) {
                    captureFeatureError(error, 'repository', 'list');
                }
            }
            // Fallback to all local tournaments
            return await this.localRepo.listForCurrentUser();
        }
    }

    /**
     * Trigger synchronization: Pushes local tournaments to cloud if missing/newer.
     */
    async syncUp(): Promise<void> {
        try {
            // Use public API to get local list
            const localList = await this.localRepo.listForCurrentUser();

            for (const localT of localList) {
                try {
                    // Try to get from cloud to check existence/version
                    const cloudT = await this.supabaseRepo.get(localT.id);

                    if (!cloudT) {
                        // Not in cloud -> Full Upload
                        await this.supabaseRepo.save(localT);
                        continue;
                    }

                    // Exists in cloud. Check versions/timestamps.
                    // Prefer version check if available
                    const localVer = localT.version ?? 0;
                    const cloudVer = cloudT.version ?? 0;

                    if (localVer > cloudVer) {
                        // Local is newer. Determine delta.
                        await this.syncTournamentDelta(localT, cloudT);
                    } else if (localVer === cloudVer) {
                        // Versions match. Check timestamps as fallback (legacy) or if version not used.
                        const localDate = new Date(localT.updatedAt).getTime();
                        const cloudDate = new Date(cloudT.updatedAt).getTime();
                        if (localDate > cloudDate) {
                            await this.syncTournamentDelta(localT, cloudT);
                        }
                    } else {
                        // Cloud is newer (localVer < cloudVer).
                        // syncUp is push-only. syncDown handles pull.
                        // We might want to warn or trigger syncDown?
                        // For now, do nothing.
                    }
                } catch (err) {
                    console.error(`Failed to sync tournament ${localT.id}`, err);
                    if (err instanceof Error) {
                        captureFeatureError(err, 'sync', 'syncTournament', { tournamentId: localT.id });
                    }
                }
            }
        } catch (error) {
            console.error('Sync up failed:', error);
            if (error instanceof Error) {
                captureFeatureError(error, 'sync', 'syncUp');
            }
        }
    }

    /**
     * Pushes changes from local to cloud using granular updates if possible.
     */
    private async syncTournamentDelta(local: Tournament, remote: Tournament): Promise<void> {
        // 1. Check for structural changes (requires full save)
        if (this.hasStructuralChanges(local, remote)) {
            // Be careful to pass the base version for optimistic locking
            // We want to update 'remote' to state of 'local'.
            // So base version is remote.version.
            // But 'local' might have higher version. 
            // We construct payload based on local, but with remote version as base?
            // save() takes 'tournament'. It extracts version from it.
            // If local.version = 5, remote.version = 4.
            // We want to update remote to 5.
            // SupabaseRepo.save(local) will check eq('version', local.version).
            // But local.version is 5. It will check eq('version', 5). Remote is 4. Fail.

            // Correct approach: We must update the record derived from remote.version.
            // But local has valid data with version 5.
            // If we blindly save(local), it checks version=5.
            // We temporarily set version=4 for the save call so it passes optimistic lock?
            // No, that sets new version to 5. Which matches local.
            await this.supabaseRepo.save({ ...local, version: remote.version });

            // Update local version explicitly to match the (single increment) result from save
            // remote.version (e.g. 4) -> save -> becomes 5.
            await this.localRepo.updateLocalVersion(local.id, (remote.version ?? 0) + 1);
            return;
        }

        let baseVer = remote.version ?? 0;

        // 2. Check Metadata
        const metadataChanges = this.getMetadataChanges(local, remote);
        if (metadataChanges) {
            await this.supabaseRepo.updateTournamentMetadata(local.id, {
                ...metadataChanges,
                version: baseVer
            });
            baseVer++; // Version incremented after metadata update
        }

        // 3. Check Matches
        const matchUpdates = this.getMatchUpdates(local, remote);
        if (matchUpdates.length > 0) {
            await this.supabaseRepo.updateMatches(local.id, matchUpdates, baseVer);
            baseVer++;
        }

        // 4. Update local version to match the new cloud version
        // This prevents the "Local is newer" loop
        await this.localRepo.updateLocalVersion(local.id, baseVer);
    }

    private hasStructuralChanges(local: Tournament, remote: Tournament): boolean {
        // Teams changed?
        if (local.teams.length !== remote.teams.length) {return true;}
        // Simple ID check (order matters?)
        // Deep check for teams (names, etc.)
        if (JSON.stringify(local.teams) !== JSON.stringify(remote.teams)) {return true;}

        // Match count/ids
        if (local.matches.length !== remote.matches.length) {return true;}
        const localMatchIds = local.matches.map(m => m.id).sort().join(',');
        const remoteMatchIds = remote.matches.map(m => m.id).sort().join(',');
        if (localMatchIds !== remoteMatchIds) {return true;}

        // Groups/Fields
        if (JSON.stringify(local.groups) !== JSON.stringify(remote.groups)) {return true;}
        if (JSON.stringify(local.fields) !== JSON.stringify(remote.fields)) {return true;}

        // L3: Monitor-/Sponsoren-Konfiguration liegt im config-JSONB und wird nur vom Voll-Save
        // transportiert. Ohne diese Prüfung meldet der Delta-Sync "keine Änderung", zieht die
        // lokale Version herunter und die Änderung erreicht die Cloud nie.
        if (stableKey(local.monitors) !== stableKey(remote.monitors)) {return true;}
        if (stableKey(local.sponsors) !== stableKey(remote.sponsors)) {return true;}

        // Fix 3 (Review 2026-09-18): publishedAt liegt ebenfalls nur im config-JSONB (siehe
        // supabase/migrations/20260918_002_make_public_refuses_drafts.sql) und hat — anders
        // als title/date/status/startTime/location — KEINE eigene Spalte, die
        // getMetadataChanges()/updateTournamentMetadata() transportieren könnte. Ohne diese
        // Prüfung syncte `status` allein über den Metadaten-Delta-Pfad (SupabaseRepository.
        // updateTournamentMetadata schreibt nur die status-Spalte, rührt config NICHT an):
        // eine Zeile käme mit status='published' aber ohne config.publishedAt in der Cloud an
        // — die App hielte das Turnier für freigegeben, make_tournament_public lehnte es
        // trotzdem ab. Genau die Drift, die dieser Meilenstein beseitigt hat, käme über den
        // Metadaten-Sync zurück. Mirrort deshalb monitors/sponsors: ein Unterschied erzwingt
        // den Voll-Save, der config komplett (inkl. publishedAt) schreibt.
        //
        // Fix 2 (Review 2026-09-21): NUR wenn der lokale Stand den Wert HAT: Ein Voll-Save
        // schreibt local -> cloud, kann ein fehlendes publishedAt also gar nicht beschaffen.
        // Bei `local === undefined` erzwänge die rohe Ungleichheit (local undefined, remote hat
        // es via Read-Time-Backfill) einen Voll-Save bei JEDEM Sync, für immer: mapTournamentToSupabase
        // schreibt publishedAt: undefined, JSON.stringify läßt den Key beim Wire-Transport weg,
        // die Cloud-Spalten bleiben unberührt, der nächste Read backfillt erneut denselben Wert
        // — die Differenz kommt sofort wieder. Nicht nur Lärm: Der strukturelle Zweig kehrt vor
        // getMetadataChanges() zurück, also kann is_public NIE korrigiert werden — und ein
        // Voll-Save stempelt `is_public: local.isPublic ?? false` auf JEDE Team- und Spielzeile
        // (supabaseMappers.ts mapTeamToSupabase/mapMatchToSupabase). Bei einer veralteten
        // lokalen Kopie heißt das: anonyme Besucher sehen wiederholt ein Turnier mit null Teams
        // und null Spielen — exakt der Schaden, den dieser Meilenstein beseitigt hat.
        if (local.publishedAt !== undefined && local.publishedAt !== remote.publishedAt) {return true;}

        return false;
    }

    private getMetadataChanges(local: Tournament, remote: Tournament): Partial<Tournament> | null {
        const changes: Partial<Tournament> = {};
        let hasChanges = false;

        if (local.title !== remote.title) { changes.title = local.title; hasChanges = true; }
        if (local.date !== remote.date) { changes.date = local.date; hasChanges = true; }
        if (local.status !== remote.status) { changes.status = local.status; hasChanges = true; }

        // Beide Seiten normalisieren: Vor M1 gelesene Kopien tragen `undefined`, die Cloud
        // liefert seit K2 einen echten Boolean. Ein roher Vergleich meldete sonst eine
        // Phantom-Änderung, deren leerer Payload die Cloud-Version nicht bewegt — während
        // die lokale Version hochgezählt wird und das Gerät danach keine Cloud-Updates mehr zieht.
        // N2: Ein `undefined` ist KEIN "false", sondern "diese Kopie weiß es nicht" — sie
        // stammt von vor M1, als der Mapper die Spalte nicht las. Würde man es als `false`
        // hochschreiben, nähme eine veraltete lokale Kopie ein öffentliches Turnier wieder
        // vom Netz: genau der K1-Schaden, den M1 beseitigt. Nur eine Kopie, die einen
        // echten Wert trägt, darf die Sichtbarkeit ändern; `get()` heilt die andere.
        // Ein lokaler Stand OHNE publishedAt trägt keinen Freigabe-Beleg. Ihn auf `true` zu
        // schieben weist der Trigger enforce_release_before_public mit HF001 ab — und weil
        // der Metadaten-Payload ganz-oder-gar-nicht ist, blieben damit auch Titel, Datum und
        // Ort dieses Turniers ungesynct, bei jedem Versuch aufs Neue und samt Sentry-Meldung.
        // Dieselbe Asymmetrie wie bei publishedAt in hasStructuralChanges: Nur hochschieben,
        // was die Gegenseite auch annehmen kann. Ein Cloud-Read heilt den veralteten Stand.
        const remotePublic = remote.isPublic ?? false;
        const wouldPublishUnreleased = local.isPublic === true && local.publishedAt === undefined;
        if (local.isPublic !== undefined && local.isPublic !== remotePublic && !wouldPublishUnreleased) {
            changes.isPublic = local.isPublic;
            hasChanges = true;
        }

        if (local.startTime !== remote.startTime) { changes.startTime = local.startTime; hasChanges = true; }

        // Location (deep check or simple JSON)
        if (JSON.stringify(local.location) !== JSON.stringify(remote.location)) {
            changes.location = local.location;
            hasChanges = true;
        }

        return hasChanges ? changes : null;
    }

    /**
     * A2 Fixrunde 3 (N2b, `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/
     * task-A2-rereview.md`): only ever sets a field when the LOCAL copy actually has a value for
     * it (`lMatch.<field> !== undefined`). Before A2 Fixrunde 1, `mapMatchUpdateToSupabase` skipped
     * any field whose VALUE was `undefined`, so assigning `update.scoreA = lMatch.scoreA` here was
     * harmless even when `lMatch.scoreA` was `undefined` -- it never reached the DB. Fixrunde 1
     * changed that mapper to key-PRESENCE (`'field' in match`), which broke this call site
     * silently: a local copy that simply doesn't know a helper's live score (e.g. right after
     * `syncUp()` runs at app start / reconnect, `useSyncOnReconnect.ts`, whenever
     * `localVer > cloudVer`) would set `update.scoreA = undefined` with the KEY PRESENT, which the
     * new mapper writes as `score_a = NULL` -- deleting the helper's live score in the cloud. This
     * guard restores the original "don't touch what I don't know" behaviour.
     */
    private getMatchUpdates(local: Tournament, remote: Tournament): MatchUpdate[] {
        const updates: MatchUpdate[] = [];

        for (const lMatch of local.matches) {
            const rMatch = remote.matches.find(m => m.id === lMatch.id);
            if (!rMatch) {continue;} // Should be caught by structural check

            const update: MatchUpdate = { id: lMatch.id };
            let updated = false;

            if (lMatch.scoreA !== undefined && lMatch.scoreA !== rMatch.scoreA) { update.scoreA = lMatch.scoreA; updated = true; }
            if (lMatch.scoreB !== undefined && lMatch.scoreB !== rMatch.scoreB) { update.scoreB = lMatch.scoreB; updated = true; }
            if (lMatch.matchStatus !== undefined && lMatch.matchStatus !== rMatch.matchStatus) { update.matchStatus = lMatch.matchStatus; updated = true; }
            if (lMatch.timerElapsedSeconds !== undefined && lMatch.timerElapsedSeconds !== rMatch.timerElapsedSeconds) { update.timerElapsedSeconds = lMatch.timerElapsedSeconds; updated = true; }
            // Add other granular fields if needed

            if (updated) {
                updates.push(update);
            }
        }
        return updates;
    }

    /**
     * Pull changes from cloud to local.
     * Strategy:
     * 1. Get remote version from Supabase
     * 2. Compare with local version
     * 3. If remote is newer → update local
     * 4. If local is newer → return 'synced' (handled by syncUp)
     * 5. Detect conflicts for concurrent edits
     */
    async syncDown(tournamentId: string): Promise<SyncResult> {
        try {
            // 1. Get both versions
            const [remoteT, localT] = await Promise.all([
                this.supabaseRepo.get(tournamentId),
                this.localRepo.get(tournamentId),
            ]);

            // Case: No remote data
            if (!remoteT) {
                if (localT) {
                    // Local exists but not remote - needs syncUp
                    return { status: 'synced', data: localT };
                }
                return { status: 'error', error: 'Tournament not found' };
            }

            // Case: No local data - just save remote
            if (!localT) {
                await this.localRepo.save(remoteT);
                return { status: 'updated', data: remoteT };
            }

            // 2. Compare timestamps
            const localDate = new Date(localT.updatedAt).getTime();
            const remoteDate = new Date(remoteT.updatedAt).getTime();

            // Case: Already in sync
            if (localDate === remoteDate) {
                return { status: 'synced', data: localT };
            }

            // Case: Remote is newer - update local
            if (remoteDate > localDate) {
                // Check for conflicts in match scores (most critical data)
                const conflicts = this.detectMatchConflicts(localT, remoteT);

                if (conflicts.length > 0) {
                    // We have conflicts - don't auto-merge, return conflict status
                    return { status: 'conflict', data: remoteT, conflicts };
                }

                // No conflicts - safe to update local
                await this.localRepo.save(remoteT);
                return { status: 'updated', data: remoteT };
            }

            // Case: Local is newer - nothing to do for syncDown
            // This will be handled by syncUp
            return { status: 'synced', data: localT };

        } catch (error) {
            // Check if we're offline
            if (!navigator.onLine) {
                return { status: 'offline', error: 'No internet connection' };
            }

            console.error('SyncDown failed:', error);
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Detects conflicts between local and remote match scores.
     * Uses Last-Write-Wins (LWW) for automatic resolution where possible.
     */
    private detectMatchConflicts(local: Tournament, remote: Tournament): SyncConflict[] {
        const conflicts: SyncConflict[] = [];

        for (const localMatch of local.matches) {
            const remoteMatch = remote.matches.find(m => m.id === localMatch.id);

            if (!remoteMatch) {
                continue; // New local match, handled by syncUp
            }

            // Check for score conflicts
            const localHasScore = localMatch.scoreA !== undefined && localMatch.scoreB !== undefined;
            const remoteHasScore = remoteMatch.scoreA !== undefined && remoteMatch.scoreB !== undefined;

            if (localHasScore && remoteHasScore) {
                const scoresDiffer =
                    localMatch.scoreA !== remoteMatch.scoreA ||
                    localMatch.scoreB !== remoteMatch.scoreB;

                if (scoresDiffer) {
                    // Get team names for conflict display
                    const homeTeam = local.teams.find(t => t.id === localMatch.teamA);
                    const awayTeam = local.teams.find(t => t.id === localMatch.teamB);
                    const matchName = `${homeTeam?.name ?? 'Team A'} vs ${awayTeam?.name ?? 'Team B'}`;

                    conflicts.push({
                        id: `${localMatch.id}-score`,
                        entityType: 'match',
                        entityId: localMatch.id,
                        entityName: matchName,
                        field: 'score',
                        localValue: `${localMatch.scoreA}:${localMatch.scoreB}`,
                        remoteValue: `${remoteMatch.scoreA}:${remoteMatch.scoreB}`,
                        localTimestamp: local.updatedAt,
                        remoteTimestamp: remote.updatedAt,
                    });
                }
            }
        }

        return conflicts;
    }

    /**
     * Resolves a conflict by choosing local or remote version.
     */
    async resolveConflict(
        tournamentId: string,
        resolution: 'local' | 'remote'
    ): Promise<SyncResult> {
        try {
            if (resolution === 'local') {
                // Push local to cloud
                const local = await this.localRepo.get(tournamentId);
                if (local) {
                    await this.supabaseRepo.save(local);
                    return { status: 'synced', data: local };
                }
            } else {
                // Pull remote to local
                const remote = await this.supabaseRepo.get(tournamentId);
                if (remote) {
                    await this.localRepo.save(remote);
                    return { status: 'updated', data: remote };
                }
            }
            return { status: 'error', error: 'Tournament not found' };
        } catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Resolution failed',
            };
        }
    }

    /**
     * Full bidirectional sync for a single tournament.
     * 1. Pull remote changes (syncDown)
     * 2. Push local changes (syncUp for single tournament)
     */
    async syncTournament(tournamentId: string): Promise<SyncResult> {
        // First, pull remote changes
        const downResult = await this.syncDown(tournamentId);

        // If there was a conflict or error, return that
        if (downResult.status === 'conflict' || downResult.status === 'error') {
            return downResult;
        }

        // Then, try to push local changes if needed
        try {
            const local = await this.localRepo.get(tournamentId);
            if (local) {
                const remote = await this.supabaseRepo.get(tournamentId);
                if (!remote || new Date(local.updatedAt) > new Date(remote.updatedAt)) {
                    await this.supabaseRepo.save(local);
                }
            }
            return { status: 'synced', data: local ?? downResult.data };
        } catch (error) {
            // If push fails (offline), still return success for the pull
            console.warn('SyncUp part failed, but syncDown succeeded:', error);
            return downResult;
        }
    }

    // ==========================================================================
    // VISIBILITY & SHARING
    // ==========================================================================

    /**
     * Makes a tournament publicly accessible by generating a share code.
     * Strategy: Try cloud first, fall back to local, queue for sync.
     */
    async makeTournamentPublic(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
        try {
            // Try cloud first for proper share code generation
            const result = await this.supabaseRepo.makeTournamentPublic(tournamentId);
            if (result) {
                // Update local cache
                const tournament = await this.localRepo.get(tournamentId);
                if (tournament) {
                    await this.localRepo.save({
                        ...tournament,
                        isPublic: true,
                        shareCode: result.shareCode,
                        shareCodeCreatedAt: result.createdAt,
                    });
                }
                return result;
            }
        } catch (error) {
            if (isReleaseRefusal(error)) {
                throw error;
            }
            if (!isAbortError(error)) {
                console.warn('OfflineRepository: Cloud makeTournamentPublic failed, using local.', error);
                if (error instanceof Error) {
                    captureFeatureError(error, 'repository', 'makePublic', { tournamentId });
                }
            }
        }

        // Fallback to local implementation
        const localResult = await this.localRepo.makeTournamentPublic(tournamentId);
        if (localResult) {
            // Queue for cloud sync when back online
            this.mutationQueue.enqueue('UPDATE_TOURNAMENT_METADATA', {
                tournamentId,
                metadata: { isPublic: true, shareCode: localResult.shareCode }
            });
        }
        return localResult;
    }

    /**
     * Makes a tournament private by removing the share code.
     * Strategy: Update local first, then try cloud, queue if offline.
     */
    async makeTournamentPrivate(tournamentId: string): Promise<void> {
        // Update local first (optimistic)
        await this.localRepo.makeTournamentPrivate(tournamentId);

        try {
            await this.supabaseRepo.makeTournamentPrivate(tournamentId);
        } catch (error) {
            if (!isAbortError(error)) {
                console.warn('OfflineRepository: Cloud makeTournamentPrivate failed, queued for sync.', error);
                if (error instanceof Error) {
                    captureFeatureError(error, 'repository', 'makePrivate', { tournamentId });
                }
            }
            // Queue for cloud sync when back online
            this.mutationQueue.enqueue('UPDATE_TOURNAMENT_METADATA', {
                tournamentId,
                metadata: { isPublic: false, shareCode: null }
            });
        }
    }

    /**
     * Regenerates the share code for a public tournament.
     * Strategy: Try cloud first, fall back to local, queue for sync.
     */
    async regenerateShareCode(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
        try {
            // Try cloud first for proper share code generation
            const result = await this.supabaseRepo.regenerateShareCode(tournamentId);
            if (result) {
                // Update local cache
                const tournament = await this.localRepo.get(tournamentId);
                if (tournament) {
                    await this.localRepo.save({
                        ...tournament,
                        shareCode: result.shareCode,
                        shareCodeCreatedAt: result.createdAt,
                    });
                }
                return result;
            }
        } catch (error) {
            if (!isAbortError(error)) {
                console.warn('OfflineRepository: Cloud regenerateShareCode failed, using local.', error);
                if (error instanceof Error) {
                    captureFeatureError(error, 'repository', 'regenerateShareCode', { tournamentId });
                }
            }
        }

        // Fallback to local implementation
        const localResult = await this.localRepo.regenerateShareCode(tournamentId);
        if (localResult) {
            // Queue for cloud sync when back online
            this.mutationQueue.enqueue('UPDATE_TOURNAMENT_METADATA', {
                tournamentId,
                metadata: { shareCode: localResult.shareCode }
            });
        }
        return localResult;
    }
}
