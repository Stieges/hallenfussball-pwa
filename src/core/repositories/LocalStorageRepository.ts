import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, Match, MatchUpdate } from '../models/types';
import { TournamentSchema } from '../models/schemas/TournamentSchema';
import { STORAGE_KEYS } from '../../constants/storage';
import { hydrateTournament } from './hydration';
import { createStorage } from '../storage/StorageFactory';
import type { IStorageAdapter } from '../storage/IStorageAdapter';
import { captureFeatureError } from '../../lib/sentry';
import { isLegacyTournamentShape } from '../models/legacyFormat';
import { quarantineLegacyTournaments, LEGACY_TOURNAMENTS_NOTICE_EVENT } from '../storage/legacyTournamentStore';
import { applyServerLedPatch, type ServerLedMatchPatch } from './serverLedMatchFields';
import { readServerRevisions, writeServerRevisions, type CloudAdoption } from './cloudAdoption';

/**
 * A2 Fixrunde 3 (N2, `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-rereview.md`):
 * merges a `MatchUpdate` into a local `Match`, translating `null` (the wire-safe "explicitly
 * clear this field" sentinel used for the offline mutation queue, see `core/models/types.ts`)
 * back to `undefined` -- `Match`'s own fields stay `T | undefined`, never `null`, so the rest of
 * the app (`isMatchFinished`, etc.) keeps working on the local copy exactly as before.
 */
function mergeMatchUpdate(match: Match, update: MatchUpdate): Match {
    const merged: Record<string, unknown> = { ...match };
    for (const [key, value] of Object.entries(update)) {
        merged[key] = value ?? undefined;
    }
    return merged as unknown as Match;
}

/**
 * A-07e: Konto-Marker `Tournament.ownerId` der lokalen Kopie. `'guest'` = im Gastmodus angelegt.
 * Ohne Marker = Altbestand: im Gastmodus wie `'guest'` gezeigt, beim naechsten Laden eines Kontos
 * anhand der Cloud-Liste markiert (`assignUnmarkedOwners`). Gleicher Wert wie GUEST_ACCOUNT_ID
 * in `match/client/guestEngineEntries.ts`, dort nicht importiert (Zyklusvermeidung).
 */
const GUEST_OWNER = 'guest';

export interface LocalStorageRepositoryOptions {
    /** A-07e: 'guest' = Gastmodus. `get` und `delete` sehen nur 'guest'-Kopien und Altbestand. Ohne Angabe roh. */
    viewer?: 'guest';
}

export class LocalStorageRepository implements ITournamentRepository {

    /** A-08f3a: Ende der Schreibkette dieser Instanz (Fehler brechen die Kette nicht). */
    private writeChain: Promise<unknown> = Promise.resolve();

    constructor(private readonly options: LocalStorageRepositoryOptions = {}) {}

    /** A-08f3a: Schreibkette – jede Schreibmethode liest und speichert die ganze Liste; wirkt je Instanz. */
    private serialize<T>(write: () => Promise<T>): Promise<T> {
        const run = this.writeChain.then(write, write);
        this.writeChain = run.catch(() => undefined);
        return run;
    }

    /** A-08f3a: server-geführte Spielfelder (Feldweg) übernehmen – ohne Änderung an version, updatedAt, ownerId. */
    applyServerMatchFields(id: string, patch: ReadonlyMap<string, ServerLedMatchPatch>): Promise<void> {
        return this.serialize(() => this.patchNow(id, patch));
    }

    private async patchNow(id: string, patch: ReadonlyMap<string, ServerLedMatchPatch>): Promise<void> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === id);
        if (index === -1) { return; }
        list[index] = { ...list[index], matches: applyServerLedPatch(list[index].matches, patch) };
        await this.saveList(list);
    }

    /** A-08f3b: Cloud-Stand in einem Kettenschritt übernehmen; Revisionen je Spiel liegen in der lokalen Kopie (zwei Tabs). */
    adoptCloudRead(id: string, decide: (local: Tournament | null, stored: ReadonlyMap<string, number>) => CloudAdoption): Promise<CloudAdoption> {
        return this.serialize(async () => {
            const storage = await createStorage();
            const adoption = decide(await this.get(id), await readServerRevisions(storage, id));
            if (adoption.save) { await this.saveNow(adoption.save); } else if (adoption.patch?.size) { await this.patchNow(id, adoption.patch); }
            await writeServerRevisions(storage, id, adoption.revisions, adoption.save && new Set(adoption.save.matches.map(m => m.id)));
            return adoption;
        });
    }

    /** N-3 (S-2): Im Gastmodus bekommt jede gespeicherte Kopie den Gast-Marker, auch eine Sicherung mit fremdem Marker. */
    private guestOr(owner: string | undefined): string | undefined {
        return this.options.viewer === 'guest' ? GUEST_OWNER : owner;
    }

    /** A-07e: im Gastmodus nur 'guest'-Kopien und Altbestand sichtbar; sonst alles. */
    private visibleHere(tournament: Tournament): boolean {
        return this.options.viewer !== 'guest' || (tournament.ownerId ?? GUEST_OWNER) === GUEST_OWNER;
    }

    /** Ohne `viewer` roh (Konto-Bindung in OfflineRepository.get); mit `viewer: 'guest'` nur Gast-Sicht. */
    async get(id: string): Promise<Tournament | null> {
        const list = await this.loadList();
        return list.find(t => t.id === id && this.visibleHere(t)) ?? null;
    }

    async getByShareCode(code: string): Promise<Tournament | null> {
        // Search for tournament with matching share code in local storage
        const list = await this.loadList();
        const normalizedCode = code.toUpperCase();
        return list.find(t => t.shareCode?.toUpperCase() === normalizedCode && t.isPublic) ?? null;
    }

    save(tournament: Tournament): Promise<void> {
        return this.serialize(() => this.saveNow(tournament));
    }

    private async saveNow(tournament: Tournament): Promise<void> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === tournament.id);

        if (index >= 0) {
            const currentVersion = list[index].version ?? 0;
            // A-07e: bestehender Konto-Marker bleibt, wenn der Aufrufer keinen setzt
            list[index] = { ...tournament, ownerId: this.guestOr(tournament.ownerId ?? list[index].ownerId), version: currentVersion + 1, updatedAt: new Date().toISOString() };
        } else {
            list.push({ ...tournament, ownerId: this.guestOr(tournament.ownerId ?? GUEST_OWNER), version: 1, updatedAt: new Date().toISOString() });
        }

        await this.saveList(list);
        // A-08f3b: Neugenerieren (neue Spiele) verwirft die Revisionen der alten Spiele.
        const storage = await createStorage();
        const stored = await readServerRevisions(storage, tournament.id);
        if (stored.size > 0) { await writeServerRevisions(storage, tournament.id, stored, new Set(tournament.matches.map(m => m.id))); }
    }

    updateTournamentMetadata(id: string, metadata: Partial<Tournament>): Promise<void> {
        return this.serialize(async () => {
            const list = await this.loadList();
            const index = list.findIndex(t => t.id === id);

            if (index === -1) {
                throw new Error(`Tournament ${id} not found`);
            }

            list[index] = {
                ...list[index],
                ...metadata,
                version: (list[index].version ?? 0) + 1,
                updatedAt: new Date().toISOString()
            };

            await this.saveList(list);
        });
    }

    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
        return this.updateMatches(tournamentId, [update]);
    }

    updateMatches(tournamentId: string, updates: MatchUpdate[], _baseVersion?: number): Promise<void> {
        return this.serialize(async () => {
            const list = await this.loadList();
            const tournamentIndex = list.findIndex(t => t.id === tournamentId);

            if (tournamentIndex === -1) {
                throw new Error(`Tournament ${tournamentId} not found`);
            }

            const tournament = list[tournamentIndex];
            const updateMap = new Map(updates.map(u => [u.id, u]));

            const updatedMatches = tournament.matches.map(m => {
                const update = updateMap.get(m.id);
                if (update) {
                    return mergeMatchUpdate(m, update);
                }
                return m;
            });

            list[tournamentIndex] = {
                ...tournament,
                matches: updatedMatches,
                version: (tournament.version ?? 0) + 1,
                updatedAt: new Date().toISOString()
            };

            await this.saveList(list);
        });
    }

    delete(id: string): Promise<void> {
        return this.serialize(async () => {
            const list = await this.loadList();
            const filtered = list.filter(t => !(t.id === id && this.visibleHere(t)));
            await this.saveList(filtered);
            await writeServerRevisions(await createStorage(), id, new Map()); // A-08f3b: Ablage leeren
        });
    }

    /** Gastmodus: nur Kopien ohne Konto (Altbestand ohne Marker zaehlt als 'guest'). */
    async listForCurrentUser(): Promise<Tournament[]> {
        const list = await this.loadList();
        return list.filter(t => (t.ownerId ?? GUEST_OWNER) === GUEST_OWNER);
    }

    /** A-07e: lokale Kopien eines Kontos (Marker = accountId). */
    async listOwnedBy(accountId: string): Promise<Tournament[]> {
        const list = await this.loadList();
        return list.filter(t => t.ownerId === accountId);
    }

    /**
     * A-07e Grenzfall Altbestand: unmarkierte Kopien anhand der Cloud-Liste dieses Kontos markieren
     * (ID in der Cloud-Liste -> Konto), alles danach Unmarkierte wird 'guest'.
     * H-1 (Opus A-07e): Die Cloud-Liste enthaelt nur `owner_id = user.id`. Turniere, bei denen das
     * Konto nur Helfer oder Mitwirkender ist, und Altbestand fremder Konten werden hier 'guest'.
     * Das gilt nur einmal beim Uebergang von Altbestand (Plattform nicht produktiv, Kurswechsel 01.10.).
     */
    assignUnmarkedOwners(accountId: string, cloudIds: ReadonlySet<string>): Promise<void> {
        return this.serialize(async () => {
            const list = await this.loadList();
            if (list.every(t => t.ownerId !== undefined)) { return; }
            await this.saveList(list.map(t => t.ownerId !== undefined
                ? t
                : { ...t, ownerId: cloudIds.has(t.id) ? accountId : GUEST_OWNER }));
        });
    }

    /**
     * Updates the local version number after a successful cloud sync.
     * Does NOT increment - sets it to the exact value from cloud.
     */
    updateLocalVersion(id: string, version: number): Promise<void> {
        return this.serialize(async () => {
            const list = await this.loadList();
            const index = list.findIndex(t => t.id === id);
            if (index !== -1) {
                list[index] = { ...list[index], version };
                await this.saveList(list);
            }
        });
    }

    // ==========================================================================
    // VISIBILITY & SHARING (local implementation)
    // ==========================================================================

    /**
     * Makes a tournament publicly accessible by generating a local share code.
     * Note: Local share codes are only valid within this browser instance.
     */
    makeTournamentPublic(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
        return this.serialize(async () => {
            const list = await this.loadList();
            const index = list.findIndex(t => t.id === tournamentId);

            if (index === -1) {
                return null;
            }

            const shareCode = this.generateLocalShareCode();
            const createdAt = new Date().toISOString();

            list[index] = {
                ...list[index],
                isPublic: true,
                shareCode,
                shareCodeCreatedAt: createdAt,
                version: (list[index].version ?? 0) + 1,
                updatedAt: createdAt
            };

            await this.saveList(list);

            return { shareCode, createdAt };
        });
    }

    /**
     * Makes a tournament private by removing the share code.
     */
    makeTournamentPrivate(tournamentId: string): Promise<void> {
        return this.serialize(async () => {
            const list = await this.loadList();
            const index = list.findIndex(t => t.id === tournamentId);

            if (index === -1) {
                throw new Error(`Tournament ${tournamentId} not found`);
            }

            list[index] = {
                ...list[index],
                isPublic: false,
                shareCode: undefined,
                shareCodeCreatedAt: undefined,
                version: (list[index].version ?? 0) + 1,
                updatedAt: new Date().toISOString()
            };

            await this.saveList(list);
        });
    }

    /**
     * Regenerates the share code for a public tournament.
     */
    regenerateShareCode(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
        return this.serialize(async () => {
            const list = await this.loadList();
            const index = list.findIndex(t => t.id === tournamentId);

            if (index === -1) {
                return null;
            }

            const tournament = list[index];
            if (!tournament.isPublic) {
                return null;
            }

            const shareCode = this.generateLocalShareCode();
            const createdAt = new Date().toISOString();

            list[index] = {
                ...list[index],
                shareCode,
                shareCodeCreatedAt: createdAt,
                version: (list[index].version ?? 0) + 1,
                updatedAt: createdAt
            };

            await this.saveList(list);

            return { shareCode, createdAt };
        });
    }

    /**
     * Generates a 6-character alphanumeric share code for local use.
     */
    private generateLocalShareCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // --- Private Helpers ---

    private async loadList(): Promise<Tournament[]> {
        try {
            const storage = await createStorage();
            const raw = await storage.get(STORAGE_KEYS.TOURNAMENTS);

            if (!raw) { return []; }
            if (!Array.isArray(raw)) { return []; }

            const current = await this.setLegacyAside(raw, storage);

            return current.map((item) => {
                const itemData = item as Record<string, unknown>;
                // Validate each item
                const result = TournamentSchema.safeParse(itemData);
                if (result.success) {
                    // Hydrate: Convert date strings back to Date objects
                    return this.backfillPublishedAt(hydrateTournament(result.data));
                }
                // If validation fails, log + report to Sentry, but return raw item to avoid data loss
                // Still hydrate to ensure date fields are proper Date objects
                captureFeatureError(
                    new Error(`Tournament ${String(itemData.id)} validation failed: ${result.error.message}`),
                    'repository', 'loadList:validation',
                    { tournamentId: String(itemData.id) }
                );
                if (import.meta.env.DEV) {
                    console.warn(`Tournament ${String(itemData.id)} validation failed:`, result.error);
                }
                return this.backfillPublishedAt(hydrateTournament(itemData));
            });
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error('Failed to load tournaments', e);
            }
            return [];
        }
    }

    /**
     * A-05 (@FU-007): Altformat (Spiel ohne slotA/slotB) wird nicht gelesen. Es wird unter
     * `tournaments_legacy_v1` beiseitegelegt, aus der Liste genommen, gemeldet und der Oberflaeche
     * angezeigt. Die Liste wird erst bereinigt, wenn das Beiseitelegen gelungen ist.
     */
    private async setLegacyAside(raw: unknown[], storage: IStorageAdapter): Promise<unknown[]> {
        const legacy = raw.filter(isLegacyTournamentShape);
        if (legacy.length === 0) { return raw; }
        const current = raw.filter((item) => !isLegacyTournamentShape(item));
        for (const item of legacy) {
            const id = (item as { id?: unknown }).id;
            captureFeatureError(
                new Error(`Tournament ${String(id)} hat das Altformat (Spiel ohne slotA/slotB) und wurde beiseitegelegt`),
                'repository', 'loadList:legacyFormat',
                { tournamentId: String(id) }
            );
        }
        try {
            await quarantineLegacyTournaments(legacy);
            await storage.set(STORAGE_KEYS.TOURNAMENTS, current);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(LEGACY_TOURNAMENTS_NOTICE_EVENT, { detail: { count: legacy.length } }));
            }
        } catch (e) {
            captureFeatureError(e instanceof Error ? e : new Error(String(e)), 'repository', 'loadList:legacyQuarantine');
        }
        return current;
    }

    /**
     * Read-Time-Backfill des Freigabe-Markers (Gegenstück zu mapTournamentFromSupabase).
     *
     * Lokal gespeicherte Bestandsturniere tragen kein `publishedAt`. Ein Turnier mit
     * status 'published' gilt als bereits freigegeben — `createdAt` ist die beste
     * verfügbare Freigabezeit. Damit entwertet der transiente Wizard-Statuswechsel auf
     * 'draft' (SettingsTab.tsx) ein laufendes Turnier nicht nachträglich.
     *
     * NUR status, NICHT isPublic/shareCode (Review 2026-09-21, Fix 1): Beide waren unter dem
     * alten Code der DEFAULT für JEDES neu angelegte Turnier — createDraft() setzte
     * isPublic:true, und die Sichtbarkeits-Seite generierte beim Mounten automatisch einen
     * shareCode. Dieser Branch hat beide Defaults entfernt, aber jedes davor angelegte Turnier
     * trägt die Altwerte noch. Sie als Beleg für "war freigegeben" zu lesen, hätte jeden
     * Altentwurf beim ersten Laden dauerhaft freigegeben — genau der Schaden, den dieser Fix
     * verhindert.
     *
     * Die Erweiterung war für das "stuck-at-draft"-Szenario gedacht (freigegebenes Turnier,
     * das ein Reload mitten in der Bearbeitung auf status='draft' stehen lässt) und ist dafür
     * nicht mehr nötig: Migration 20260918_003 hat config.publishedAt für JEDE bereits
     * veröffentlichte Zeile einmalig materialisiert, und der Wert übersteht den Wizard-Roundtrip
     * (SettingsTab.tsx spreadet das ganze Tournament-Objekt, der Wizard seedet sein Formular
     * daraus). Ein solches Turnier trägt publishedAt also schon, wenn es hier ankommt, und
     * die Guard-Klausel oben (`tournament.publishedAt !== undefined`) greift zuerst.
     */
    private backfillPublishedAt(tournament: Tournament): Tournament {
        const wasReleased = tournament.status === 'published';
        if (tournament.publishedAt !== undefined || !wasReleased) {
            return tournament;
        }
        return { ...tournament, publishedAt: tournament.createdAt };
    }

    private async saveList(list: Tournament[]): Promise<void> {
        try {
            const storage = await createStorage();
            await storage.set(STORAGE_KEYS.TOURNAMENTS, list);
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error('Failed to save tournaments', e);
            }
            throw e; // Propagate error so UI can handle it (or retry)
        }
    }
}
