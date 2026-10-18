/**
 * A-08f3b (Plan `task-A-08f3-plan.md` v4 + offene Punkte `task-A-08f3a-review.md`): Wie ein gelesener Cloud-Stand in
 * die lokale Kopie kommt. Reine Entscheidung; ausgeführt in einem Kettenschritt von `LocalStorageRepository`.
 *
 * - Versionsweg (Cloud-Version höher, `isPublic` veraltet, oder erste Kopie): ganze Kopie speichern -- A-08f3c2 nur,
 *   wenn Regel Q es erlaubt (nichts Eigenes wartet oder ist gescheitert, `cloudQueueGuard.ts`); die Kopie trägt Version
 *   und `updatedAt` der Cloud (A-08f3c1, `cacheCloudCopy`).
 * - Sonst Feldweg (Regel S, `serverLedMatchFields.ts`).
 * - In beiden Fällen werden die Revisionen je Spiel fortgeschrieben (nie rückwärts). Sie liegen in der lokalen
 *   Kopie (Speicher-Schlüssel je Turnier), damit auch ein zweiter Tab einen älteren Stand nicht nachrücken lässt.
 * Anforderungen: @FU-087, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import type { Tournament } from '../models/types';
import type { IStorageAdapter } from '../storage/IStorageAdapter';
import type { CloudReadWithRevisions } from './SupabaseRepository';
import { applyServerLedPatch, mergeServerLedFields, serverLedFieldsOf, type ServerLedMatchPatch } from './serverLedMatchFields';

export interface CloudAdoption {
    /** Ganze Kopie speichern (Versionsweg). */
    save?: Tournament;
    /** Server-geführte Felder (Feldweg). */
    patch?: ReadonlyMap<string, ServerLedMatchPatch>;
    /** Revisionen je Spiel nach der Übernahme (vollständig). */
    revisions: ReadonlyMap<string, number>;
}

export interface CloudAdoptionOptions {
    /** N-2: eine fremde lokale Kopie bleibt unangetastet. */
    mayCache: boolean;
    /** Erster Cloud-Weg: eine vorhandene unmarkierte Kopie wird immer ganz ersetzt. */
    whole: boolean;
    owned: (tournament: Tournament) => Tournament;
    /** A-08f3c2 Regel Q (`cloudQueueGuard.ts`): darf die ganze Kopie ersetzt werden? Ohne Angabe ja. Geprüft im Kettenschritt. */
    wholeAllowed?: () => boolean;
}

export function maxRevisions(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): Map<string, number> {
    const merged = new Map(a);
    for (const [matchId, revision] of b) {
        if (revision > (merged.get(matchId) ?? 0)) { merged.set(matchId, revision); }
    }
    return merged;
}

/** Versionsweg monoton: Spiele, deren übernommene Revision neuer ist als die gelesene, behalten ihre lokalen Felder. */
function keepNewerFields(cloud: Tournament, local: Tournament | null, read: ReadonlyMap<string, number>, stored: ReadonlyMap<string, number>): Tournament {
    const keep = new Map<string, ServerLedMatchPatch>();
    for (const match of local?.matches ?? []) {
        if ((stored.get(match.id) ?? 0) > (read.get(match.id) ?? 0)) { keep.set(match.id, serverLedFieldsOf(match)); }
    }
    return keep.size === 0 ? cloud : { ...cloud, matches: applyServerLedPatch(cloud.matches, keep) };
}

export function decideCloudAdoption(
    local: Tournament | null,
    read: CloudReadWithRevisions,
    stored: ReadonlyMap<string, number>,
    options: CloudAdoptionOptions,
): CloudAdoption {
    if (!options.mayCache) { return { revisions: stored }; }
    const cloud = read.tournament;
    const cloudVersion = cloud.version ?? 0;
    const localVersion = local?.version ?? 0;
    // N3: `isPublic` nur übernehmen, wenn die Cloud nicht älter ist (sonst überschriebe sich eine Offline-Freigabe).
    const visibilityStale = local !== null && local.isPublic !== cloud.isPublic && cloudVersion >= localVersion;
    const wholeWanted = options.whole || cloudVersion > localVersion || visibilityStale;
    if (local === null || (wholeWanted && (options.wholeAllowed?.() ?? true))) {
        return { save: options.owned(keepNewerFields(cloud, local, read.matchRevisions, stored)), revisions: maxRevisions(stored, read.matchRevisions) };
    }
    const merged = mergeServerLedFields(local, cloud, read.matchRevisions, stored, 'stufe2');
    return { patch: merged.patch, revisions: maxRevisions(stored, merged.adopted) };
}

const revisionKey = (tournamentId: string): string => `serverRevisions-${tournamentId}`;

export async function readServerRevisions(storage: IStorageAdapter, tournamentId: string): Promise<Map<string, number>> {
    const raw = await storage.get<Record<string, number>>(revisionKey(tournamentId));
    return new Map(Object.entries(raw ?? {}));
}

/** Schreibt die Revisionen; mit `matchIds` nur die noch vorhandenen Spiele (Neugenerieren, Löschen = leere Menge). */
export async function writeServerRevisions(
    storage: IStorageAdapter,
    tournamentId: string,
    revisions: ReadonlyMap<string, number>,
    matchIds?: ReadonlySet<string>,
): Promise<void> {
    const kept = [...revisions].filter(([matchId]) => matchIds === undefined || matchIds.has(matchId));
    await storage.set(revisionKey(tournamentId), Object.fromEntries(kept));
}

/** A-08f3b-F F2: Zeitlimit eines Cloud-Abrufs (Hallen-WLAN, Auth-Sperre). Unter dem 5-s-Takt mal zwei, über üblichen Antwortzeiten. */
export const CLOUD_READ_TIMEOUT_MS = 8000;

class CloudReadTimeoutError extends Error {
    constructor() {
        super(`Cloud-Abruf nach ${CLOUD_READ_TIMEOUT_MS} ms abgebrochen`);
        this.name = 'CloudReadTimeoutError';
    }
}

/** Zeitüberschreitung ist erwartbar (nächster Takt versucht es neu) und wird nicht gemeldet. */
export function isCloudReadTimeout(error: unknown): boolean {
    return error instanceof CloudReadTimeoutError;
}

export function withCloudReadTimeout<T>(request: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new CloudReadTimeoutError()), CLOUD_READ_TIMEOUT_MS);
    });
    return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}
