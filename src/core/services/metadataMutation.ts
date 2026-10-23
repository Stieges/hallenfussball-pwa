/**
 * Ausführung eines eingereihten `UPDATE_TOURNAMENT_METADATA` (aus `MutationQueue.ts` herausgelöst, Datei unter 300 Zeilen).
 *
 * CA-3 / Review CA-3–5 Auflage 2 (@BM-070): Ein Teilen-Rückfall (`onlyIfUnshared`) schreibt den Code des Geräts nur, wenn die
 * Cloud-Zeile noch keinen hat. Hat sie einen, bleibt er, und das Gerät übernimmt Code, Zeitpunkt und Sichtbarkeit der Cloud
 * (wie nach einem gelungenen RPC: `cacheCloudCopy`, ohne zu zählen). Der Eintrag gilt dann als erledigt.
 */
import type { Tournament } from '../models/types';
import type { SupabaseRepository } from '../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../repositories/LocalStorageRepository';

export interface MetadataMutationPayload {
    tournamentId: string;
    metadata: Partial<Tournament>;
    /** Teilen-Rückfall: nur schreiben, wenn die Cloud noch keinen Freigabe-Code hat. */
    onlyIfUnshared?: boolean;
}

export async function executeMetadataMutation(
    supabaseRepo: SupabaseRepository,
    localRepo: LocalStorageRepository,
    { tournamentId, metadata, onlyIfUnshared }: MetadataMutationPayload,
): Promise<void> {
    if (onlyIfUnshared !== true || typeof metadata.shareCode !== 'string') {
        await supabaseRepo.updateTournamentMetadata(tournamentId, metadata);
        return;
    }
    const result = await supabaseRepo.shareIfUnshared(tournamentId, {
        shareCode: metadata.shareCode,
        shareCodeCreatedAt: metadata.shareCodeCreatedAt,
    });
    if (result.applied || result.cloud?.shareCode === undefined) {
        return;
    }
    const local = await localRepo.get(tournamentId);
    if (local) {
        await localRepo.cacheCloudCopy({
            ...local,
            isPublic: result.cloud.isPublic,
            shareCode: result.cloud.shareCode,
            shareCodeCreatedAt: result.cloud.shareCodeCreatedAt,
        });
    }
}

/**
 * BP-1 (@FU-125, Befund C-METADATEN-ZUSAMMENFASSEN-VERLIERT-FELDER): zwei wartende Änderungen der Turnierangaben desselben
 * Turniers zusammenfassen, ohne eine Angabe zu verlieren – die jüngere gewinnt je Angabe, der Ort je Teilfeld.
 */
export function mergeMetadataPayloads(existing: MetadataMutationPayload, incoming: MetadataMutationPayload): MetadataMutationPayload {
    const location = existing.metadata.location && incoming.metadata.location
        ? { location: { ...existing.metadata.location, ...incoming.metadata.location } }
        : {};
    return { ...incoming, metadata: { ...existing.metadata, ...incoming.metadata, ...location } };
}
