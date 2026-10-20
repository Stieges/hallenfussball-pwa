import { MutationQueue } from '../services/MutationQueue';
import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { LocalStorageRepository } from './LocalStorageRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { isAbortError, RepositoryError } from '../errors';
import { hasGuestEngineEntries } from '../match/client/guestEngineEntries';
import { captureFeatureError } from '../../lib/sentry';
import { slotTeamId } from '../models/matchSlot';
import type { MatchSlot } from '../models/schemas/MatchSlotSchema';
import { decideCloudAdoption, isCloudReadTimeout, withCloudReadTimeout } from './cloudAdoption';
import { ServerRevisionRegistry, type ServerRevisionListener, type ServerRevisionSource } from './serverRevisionRegistry';
import { CloudQueueGuard } from './cloudQueueGuard';
import { effectiveHostTeamIds } from '../models/hostTeams';
import { mergeAccountList, offlineAccountList, readAccountRoleMemory, writeAccountRoleMemory, type AccountRoleMemory } from './accountListMerge';

/**
 * A2 Fixrunde 3 (N2a, `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/
 * task-A2-rereview.md`): `GenericMutationQueue` persists its queue via `JSON.stringify` /
 * `JSON.parse` (survives app restarts and dead-letter retries). `JSON.stringify` DROPS a
 * present-but-`undefined`-valued key entirely (`JSON.stringify({scoreA: undefined}) === '{}'`),
 * so an "explicit clear" (a caller sets `field: undefined` with the key present, e.g.
 * `unskipMatch` des früheren Altwegs) that made it into the queue as an in-memory object would
 * survive the CURRENT session but silently lose the clear on reload/replay. Normalizing
 * `undefined` (key present) to `null` right before enqueueing makes every clear JSON-round-trip
 * safe -- `mapMatchUpdateToSupabase` treats a present `null` exactly like a present `undefined`
 * (result/status/skip columns are stripped since V4a, only schedule columns are written), so
 * this changes nothing for the same-session path, only the persisted/replayed one.
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

/** `blocked` (A-08f3c2, M-3): Regel Q hat die ganze Cloud-Kopie nicht zugelassen (eigene Änderungen warten oder sind gescheitert). */
export type SyncStatus = 'synced' | 'updated' | 'conflict' | 'error' | 'offline' | 'blocked';

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
 * A-02: lokal besetzte Seite mit anderer Team-ID als in der Cloud? (offen/fehlend → nein)
 * A-03: eine lokal aufgelöste Seite (`resolvedFrom`) löst kein Voll-Speichern aus.
 * Server-seitige Auflösung: A-13/A-14, Befund C-DELTA-LOKALE-AUFLOESUNG.
 */
function sideDiffers(local: MatchSlot | undefined, remote: MatchSlot | undefined): boolean {
    if (local?.kind === 'team' && local.resolvedFrom !== undefined) {return false;}
    const localId = local === undefined ? undefined : slotTeamId(local);
    if (localId === undefined) {return false;}
    return remote === undefined || slotTeamId(remote) !== localId;
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

export class OfflineRepository implements ITournamentRepository, ServerRevisionSource {
    private _mutationQueue: MutationQueue;
    /** A-08f3a Monotonie (Regel S) + a2/b Benachrichtigung: zuletzt übernommene Server-Revision je Spiel, je Turnier. */
    private readonly serverRevisions = new ServerRevisionRegistry();
    /** A-08f3b: laufender Cloud-Abruf je Turnier (ein Abruf je Turnier). */
    private readonly cloudReads = new Map<string, Promise<Tournament | null>>();
    private readonly cloudReadRerun = new Set<string>();
    /** A-08f3c2 Regel Q: keine ganze Cloud-Kopie über eigene wartende, laufende oder gescheiterte Änderungen. */
    private readonly queueGuard: CloudQueueGuard;

    constructor(
        private localRepo: LocalStorageRepository,
        private supabaseRepo: SupabaseRepository,
        /** A-07b: Konto, dem die Warteschlange gehoert (@FU-006). Ohne Angabe: Altschluessel. */
        private accountId?: string
    ) {
        this._mutationQueue = new MutationQueue(supabaseRepo, localRepo, undefined, accountId);
        this.queueGuard = new CloudQueueGuard(this._mutationQueue);
    }

    /** A-07e: Kopie gehoert dem Konto dieses Repositorys (ohne Konto unveraendert). */
    private owned(tournament: Tournament): Tournament {
        return this.accountId === undefined ? tournament : { ...tournament, ownerId: this.accountId };
    }

    /** A-07e: lokale Kopien des Kontos; ohne Konto (nur Tests) wie bisher alle. */
    private localListForAccount(): Promise<Tournament[]> {
        return this.accountId === undefined ? this.localRepo.listForCurrentUser() : this.localRepo.listOwnedBy(this.accountId);
    }

    /**
     * Review A-11 A4 (@FU-098, Befund C-RECHTE-NACH-ANLEGEN-UNBEKANNT): Hat dieses Konto das Turnier auf diesem Gerät
     * angelegt und ist es noch nicht (sicher) in der Cloud? Alle drei Bedingungen: die lokale Kopie gehört dem Konto,
     * sie wurde nie aus der Cloud übernommen (`changeRevision` liest nur ein Cloud-Abruf, A-10) und die Warteschlange
     * hält dafür noch Ungesendetes oder eine gescheiterte Speicherung. Der Konto-Marker `ownerId` allein reicht nicht:
     * auch die aus der Cloud geladene Kopie eines Helfers trägt ihn (@FU-100).
     */
    async isAwaitingFirstUpload(tournamentId: string): Promise<boolean> {
        if (this.accountId === undefined) { return false; }
        const queue = this._mutationQueue;
        if (!queue.hasPending(tournamentId) && !queue.hasFailed(tournamentId, ['SAVE_TOURNAMENT'])) { return false; }
        const local = await this.localRepo.get(tournamentId);
        return local !== null && local.ownerId === this.accountId && local.changeRevision === undefined;
    }

    /** Review A-11 A4: meldet jede Änderung der Warteschlange (für die erneute Rechte-Prüfung nach dem Sync). */
    subscribeSync(listener: () => void): () => void {
        return this._mutationQueue.subscribe(() => listener());
    }

    /** A-08f3a2: Spiele mit Server-Revision > 1 (Schnelleingabe gesperrt wie heute, Rückbau in e2). */
    serverLedMatchIds(tournamentId: string): ReadonlySet<string> {
        return this.serverRevisions.serverLedMatchIds(tournamentId);
    }

    /** A-08f3a2/b: meldet je Übernahme die Spiele mit gestiegener Revision. */
    subscribeServerRevisions(tournamentId: string, listener: ServerRevisionListener): () => void {
        return this.serverRevisions.subscribe(tournamentId, listener);
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
     * A-08f3b `fresh` (Push/Abfrage-Ausweichen, @FU-087/@FU-001): wartet auf den Cloud-Abruf, führt zusammen und
     * liefert das Ergebnis, bei Fehler die lokale Kopie. Das erste Laden bleibt local-first.
     */
    async get(id: string, options?: { fresh?: boolean }): Promise<Tournament | null> {
        // 1. LOCAL-FIRST: Try local storage immediately
        const localData = await this.localRepo.get(id);

        if (localData && (this.accountId === undefined || localData.ownerId === this.accountId)) { // A-07e: fremd/unmarkiert = nicht lokal
            // A-08f3b-F F3: Sperre a2 auch nach Neuladen ohne Netz – Revisionen aus der lokalen Kopie
            this.serverRevisions.record(id, await this.localRepo.readServerRevisions(id));
            const refreshed = this.refreshFromCloudInBackground(id, options?.fresh);
            if (!options?.fresh) { return localData; }
            await refreshed;
            return (await this.localRepo.get(id)) ?? localData;
        }

        // 2. Not found locally - try cloud (A-08f3b: mit Revisionen; N-2: eine fremde lokale Kopie bleibt unangetastet)
        try {
            return await this.syncFromCloud(id, !localData?.ownerId || localData.ownerId === this.accountId || this.accountId === undefined);
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

    /** Background sync: Cloud lesen und zusammenführen (Versionsweg oder Feldweg). Fehler werden nur gemeldet. */
    private async refreshFromCloudInBackground(id: string, fresh?: boolean): Promise<void> {
        try {
            await this.syncFromCloud(id, undefined, fresh);
        } catch (error) {
            if (!isAbortError(error) && !isCloudReadTimeout(error) && error instanceof Error) {
                captureFeatureError(error, 'repository', 'backgroundSync', { tournamentId: id });
            }
        }
    }

    /**
     * A-08f3b: ein Abruf je Turnier für alle Cloud-Lesewege (frisch und im Hintergrund). Entscheidung und Schreiben
     * laufen in einem Kettenschritt des lokalen Speichers (`cloudAdoption.ts`); `firstCopy` = erster Cloud-Weg.
     * A-08f3b-F: Ein `fresh` während eines laufenden Abrufs fordert genau einen Nachzügler an (F1, Muster
     * `MatchEngine.catchUp`); jeder Abruf hat ein Zeitlimit, danach wird der Eintrag geräumt (F2).
     */
    private syncFromCloud(id: string, firstCopy?: boolean, fresh?: boolean): Promise<Tournament | null> {
        const running = this.cloudReads.get(id);
        if (running) {
            if (fresh) { this.cloudReadRerun.add(id); }
            return running;
        }
        const run = (async () => {
            let result = await this.readAndAdopt(id, firstCopy);
            while (this.cloudReadRerun.delete(id)) { result = await this.readAndAdopt(id, firstCopy); }
            return result?.tournament ?? null;
        })().finally(() => { this.cloudReads.delete(id); this.cloudReadRerun.delete(id); });
        this.cloudReads.set(id, run);
        return run;
    }

    /** `whole`: die ganze Kopie wurde übernommen (Versionsweg, von Regel Q zugelassen). */
    private async readAndAdopt(id: string, firstCopy?: boolean): Promise<{ tournament: Tournament; whole: boolean } | null> {
        const before = this.queueGuard.snapshot(id); // A-08f3c2 (H1): Stand der Warteschlange vor dem Lesen
        const read = await withCloudReadTimeout(this.supabaseRepo.getWithMatchRevisions(id));
        if (!read) { return null; }
        const options = { mayCache: firstCopy ?? true, whole: firstCopy !== undefined, owned: (t: Tournament) => this.owned(t),
            wholeAllowed: () => this.queueGuard.mayAdoptWhole(id, before) };
        const adoption = await this.localRepo.adoptCloudRead(id, (local, stored) => decideCloudAdoption(local, read, stored, options));
        this.serverRevisions.record(id, adoption.revisions);
        return { tournament: read.tournament, whole: adoption.save !== undefined };
    }

    /** M-3: „Cloud übernehmen“/`syncDown` melden `updated` nur, wenn Regel Q die ganze Kopie zugelassen hat. */
    private async adoptWhole(id: string, fallback: Tournament | null): Promise<SyncResult> {
        const result = await this.readAndAdopt(id, true);
        if (!result && !fallback) { return { status: 'error', error: 'Tournament not found' }; }
        return { status: result && !result.whole ? 'blocked' : 'updated', data: result?.tournament ?? fallback ?? undefined };
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
        await this.queueGuard.track(tournament.id, async () => { // A-08f3c2: Speichern + Einreihen als Einheit (Regel Q)
            await this.localRepo.save(this.owned(tournament));
            this.serverRevisions.retain(tournament.id, new Set(tournament.matches.map(m => m.id))); // A-08f3b: Neugenerieren
            this.mutationQueue.enqueue('SAVE_TOURNAMENT', tournament);
        });
    }

    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
        // Local write keeps the ORIGINAL update (undefined-with-key-present semantics, resolved
        // against the in-memory Match by LocalStorageRepository) -- only the QUEUED copy is
        // normalized for the JSON round-trip (N2a).
        await this.queueGuard.track(tournamentId, async () => {
            await this.localRepo.updateMatch(tournamentId, update);
            this.mutationQueue.enqueue('UPDATE_MATCH', { tournamentId, update: normalizeMatchUpdateForQueue(update) });
        });
    }

    async updateMatches(tournamentId: string, updates: MatchUpdate[], _baseVersion?: number): Promise<void> {
        await this.queueGuard.track(tournamentId, async () => {
            await this.localRepo.updateMatches(tournamentId, updates);
            this.mutationQueue.enqueue('UPDATE_MATCHES', { tournamentId, updates: updates.map(normalizeMatchUpdateForQueue) });
        });
    }

    async delete(id: string): Promise<void> {
        await this.localRepo.delete(id);
        this.serverRevisions.clear(id); // A-08f3b: Ablage leeren
        this.mutationQueue.enqueue('DELETE_TOURNAMENT', id);
    }

    async updateTournamentMetadata(id: string, metadata: Partial<Tournament>): Promise<void> {
        await this.queueGuard.track(id, async () => {
            await this.localRepo.updateTournamentMetadata(id, metadata);
            this.mutationQueue.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: id, metadata });
        });
    }

    // --- Extended Methods for Sync ---

    /**
     * Startseiten-Liste: Cloud (eigene + Mitgliedschaften, CA-5) mit den nur lokalen Kopien des Kontos zusammengeführt
     * (`accountListMerge.ts`); ohne Netz die lokalen Kopien mit gemerkter Rolle.
     */
    async listForCurrentUser(): Promise<Tournament[]> {
        try {
            // Create a timeout promise (5s) to avoid hanging indefinitely if network is slow/flaky
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Cloud fetch timeout')), 5000)
            );
            const cloud = await Promise.race([this.supabaseRepo.listWithMemberships(), timeoutPromise]);
            if (cloud.membershipError) { captureFeatureError(cloud.membershipError, 'repository', 'listMemberships'); }
            if (this.accountId !== undefined) {
                await this.localRepo.assignUnmarkedOwners(this.accountId, new Set(cloud.tournaments.filter(t => t.myRole === 'owner').map(t => t.id)));
            }
            // @W5-027: Wartet eine lokale Änderung noch in der Warteschlange (z. B. archivierte Kopie) UND ist sie neuer als die
            // Cloud-Zeile, gilt die lokale Fassung, sonst käme beim Neuladen kurz der alte Stand zurück. Ohne offene Änderung
            // (Geräteuhr weicht ab, abgelehnte Änderung im Dead-Letter) gilt der Server.
            const result = mergeAccountList({
                cloud,
                local: await this.localListForAccount(),
                memory: this.roleMemory(),
                preferLocal: (cloudT, localT) => this.mutationQueue.hasPending(cloudT.id) && Date.parse(localT.updatedAt) > Date.parse(cloudT.updatedAt),
            });
            if (result.memory && this.accountId !== undefined) { writeAccountRoleMemory(this.accountId, result.memory); }
            return result.list;
        } catch (error) {
            // Only log non-AbortErrors (AbortError is expected during navigation)
            if (!isAbortError(error)) {
                console.warn('OfflineRepository: Cloud list failed, returning local list.', error);
                if (error instanceof Error) {
                    captureFeatureError(error, 'repository', 'list');
                }
            }
            return offlineAccountList(await this.localListForAccount(), this.roleMemory());
        }
    }

    /** CA-5: Rollen-Gedächtnis des Kontos (ohne Konto – nur Tests – leer). */
    private roleMemory(): AccountRoleMemory {
        return this.accountId === undefined ? { roles: {}, former: [] } : readAccountRoleMemory(this.accountId);
    }

    /**
     * CA-5 (@HE-087, Plan-Review Auflage 10a, Review CA-3–5 Auflage 1): EINE Regel für alle Upload-Wege (`syncUp`,
     * `syncTournament`, `resolveConflict('local')`). Nie hochladen, wenn das Konto aus dem Turnier ausgetragen ist (Gedächtnis
     * `former`) oder die Kopie aus der Cloud stammt (`changeRevision`, A-10) und die Cloud sie nicht (mehr) liefert.
     * Ein eigenes, nie hochgeladenes Turnier (`changeRevision` leer) wird weiter hochgeladen.
     */
    private mayUpload(local: Tournament, remote: Tournament | null): boolean {
        if (this.roleMemory().former.includes(local.id)) { return false; }
        return remote !== null || local.changeRevision === undefined;
    }

    /**
     * Trigger synchronization: Pushes local tournaments to cloud if missing/newer.
     */
    async syncUp(): Promise<void> {
        try {
            // A-07e: nur eigene Kopien des Kontos (Gast-Kopien nie hochladen)
            const localList = await this.localListForAccount();

            for (const localT of localList) {
                try {
                    // G7: Turnier mit Engine-Einträgen im Gastkonto nie hochladen —
                    // weder als Voll-Upload noch über syncTournamentDelta (dessen
                    // save/update* unten würden die Einträge ins Konto abschneiden).
                    if (await hasGuestEngineEntries(localT)) {
                        continue;
                    }
                    // Try to get from cloud to check existence/version
                    const cloudT = await this.supabaseRepo.get(localT.id);

                    if (!this.mayUpload(localT, cloudT)) {
                        continue; // CA-5 (@HE-087): ausgetragen oder nicht mehr sichtbar – nie hochladen
                    }
                    if (!cloudT) {
                        // Not in cloud -> Full Upload (A-08f3c1: die Cloud legt mit Version 1 an)
                        await this.supabaseRepo.save(localT);
                        await this.localRepo.updateLocalVersion(localT.id, 1);
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

        // 3. Update local version to match the new cloud version
        // This prevents the "Local is newer" loop
        // PC25: bei reinem Versionsvorsprung an die Cloud angleichen, sonst Lost Update fremder
        // Struktur-Änderungen; lokale Altspiel-Ergebnisse werden ohnehin nicht gesendet.
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

        // A-02 (@TM-027): eine lokal BESETZTE Seite, die in der Cloud anders besetzt ist
        // (Teamtausch/-ersatz durch die Leitung), braucht das Voll-Speichern – der Metadaten-Delta
        // kennt keine Spielseiten. Eine lokal OFFENE Seite zählt nie: der lokale Stand ist dann nur
        // veraltet (ein anderes Gerät hat aufgelöst) – kein Zurücksetzen (gleiche Regel wie
        // mapMatchToScheduleUpdate).
        const remoteById = new Map(remote.matches.map(m => [m.id, m]));
        if (local.matches.some(m => {
            const r = remoteById.get(m.id);
            return r !== undefined && (sideDiffers(m.slotA, r.slotA) || sideDiffers(m.slotB, r.slotB));
        })) {return true;}

        // Groups/Fields
        if (JSON.stringify(local.groups) !== JSON.stringify(remote.groups)) {return true;}
        if (JSON.stringify(local.fields) !== JSON.stringify(remote.fields)) {return true;}

        // L3: Monitor-/Sponsoren-Konfiguration liegt im config-JSONB und wird nur vom Voll-Save
        // transportiert. Ohne diese Prüfung meldet der Delta-Sync "keine Änderung", zieht die
        // lokale Version herunter und die Änderung erreicht die Cloud nie.
        if (stableKey(local.monitors) !== stableKey(remote.monitors)) {return true;}
        if (stableKey(local.sponsors) !== stableKey(remote.sponsors)) {return true;}
        if ((local.bibColor ?? '').toUpperCase() !== (remote.bibColor ?? '').toUpperCase()) {return true;} // A-30a @W3-029: Leibchenfarbe nur im config-JSONB
        if (stableKey(local.spectatorDisplay) !== stableKey(remote.spectatorDisplay)) {return true;} // Spielanzeige 2.1 @ZM-152: nur im config-JSONB
        // @W4-034: Markierung des Veranstalters und Eröffnungswahl liegen nur im config-JSONB (wie bibColor).
        // @W4-044: verwaiste IDs (Team gelöscht) zählen auf keiner Seite (die Teams sind oben schon als gleich geprüft).
        if (stableKey(effectiveHostTeamIds(local.hostTeamIds, local.teams)) !== stableKey(effectiveHostTeamIds(remote.hostTeamIds, remote.teams))) {return true;}
        if ((local.openingMode ?? '') !== (remote.openingMode ?? '')) {return true;}

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

            // Case: No local data - übernehmen (A-08f3c1/M4: Cloud-Version, gleiche Regel wie der Abruf)
            if (!localT) {
                return this.adoptWhole(tournamentId, remoteT);
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

                // No conflicts - A-08f3c1/M4: ganze Kopie über dieselbe Regel wie der Abruf (cacheCloudCopy, Q)
                return this.adoptWhole(tournamentId, remoteT);
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
     * Detects conflicts between local and remote tournaments.
     *
     * C3a-2b (F8): Score-Konflikte sind seit V4 nicht mehr client-seitig auflösbar — vor-bestehend
     * seit A2: `resolveConflict('local')` kann Scores nicht pushen (mapMatchToScheduleUpdate
     * schließt Ergebnis-Spalten aus). Die Score-Prüfung ist deshalb deaktiviert, sonst blockiert
     * `syncDown` mit `status:'conflict'` den Auto-Pull für einen Konflikt, den keine Seite mehr
     * auflösen kann. Signatur/Rückgabe bleibt für zukünftige Konflikttypen.
     */
    private detectMatchConflicts(_local: Tournament, _remote: Tournament): SyncConflict[] {
        return [];
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
                    // G7: Turnier mit Engine-Einträgen im Gastkonto nie hochladen
                    if (await hasGuestEngineEntries(local)) {
                        return {
                            status: 'error',
                            error: 'Tournament with guest engine entries is not uploaded',
                        };
                    }
                    if (!this.mayUpload(local, await this.supabaseRepo.get(tournamentId))) { // CA-5 (@HE-087)
                        return { status: 'error', error: 'Tournament is not available to this account; the local copy is not uploaded' };
                    }
                    await this.supabaseRepo.save(local);
                    await this.localRepo.updateLocalVersion(tournamentId, (local.version ?? 0) + 1); // A-08f3c1: wie die Cloud
                    return { status: 'synced', data: local };
                }
            } else {
                // Pull remote to local (A-08f3c1/M4: Cloud-Version, gleiche Regel wie der Abruf)
                return await this.adoptWhole(tournamentId, null);
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
            // G7: Turnier mit Engine-Einträgen im Gastkonto nie pushen —
            // der Pull oben bleibt unberührt, es wird nur nichts hochgeladen.
            if (local && !(await hasGuestEngineEntries(local))) {
                const remote = await this.supabaseRepo.get(tournamentId);
                if (!this.mayUpload(local, remote)) { return downResult; } // CA-5 (@HE-087): nie hochladen
                if (!remote || new Date(local.updatedAt) > new Date(remote.updatedAt)) {
                    await this.supabaseRepo.save(local);
                    await this.localRepo.updateLocalVersion(tournamentId, remote ? (local.version ?? 0) + 1 : 1); // A-08f3c1
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
                if (tournament) { // A-08f3c1: die Cloud zählt hier nicht -- lokal auch nicht
                    await this.localRepo.cacheCloudCopy({ ...tournament, isPublic: true, shareCode: result.shareCode, shareCodeCreatedAt: result.createdAt });
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
        // CA-3 (Auflage 5): kennt das Geraet fuer das Turnier schon einen Code (aus der Cloud oder von einem frueheren
        // Rueckfall, dessen Eintrag schon wartet), bleibt er -- kein neuer Eintrag, der einen Cloud-Code ueberschriebe.
        const known = await this.localRepo.get(tournamentId);
        const alreadyShared = known?.isPublic === true && !!known.shareCode;
        const localResult = await this.localRepo.makeTournamentPublic(tournamentId);
        if (localResult && !alreadyShared) {
            // Queue for cloud sync when back online
            this.mutationQueue.enqueue('UPDATE_TOURNAMENT_METADATA', {
                tournamentId,
                metadata: { isPublic: true, shareCode: localResult.shareCode, shareCodeCreatedAt: localResult.createdAt },
                onlyIfUnshared: true, // Review CA-3–5 Auflage 2 (@BM-070): nie einen Cloud-Code überschreiben
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
                if (tournament) { // A-08f3c1: ohne +1 (wie die Cloud)
                    await this.localRepo.cacheCloudCopy({ ...tournament, shareCode: result.shareCode, shareCodeCreatedAt: result.createdAt });
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
                metadata: { shareCode: localResult.shareCode, shareCodeCreatedAt: localResult.createdAt }
            });
        }
        return localResult;
    }
}
