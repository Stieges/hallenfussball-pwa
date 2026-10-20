/**
 * CA-3 / Review CA-3–5 Auflage 2 (@BM-070 „der Freigabe-Code bleibt derselbe – Aushang und QR-Code gelten weiter“):
 * Der Rückfall „online teilen“ (RPC abgelehnt oder kein Netz) schreibt den Code des Geräts nur, wenn die Cloud-Zeile
 * noch keinen hat (`share_code IS NULL`, eine Anweisung, kein Lesen-dann-Schreiben). Hat die Cloud inzwischen einen Code
 * (Olli hat geteilt, Marias Kopie war älter), bleibt er; der Aufrufer übernimmt ihn aufs Gerät.
 *
 * Gewählt statt „beim Senden die RPC rufen“: die RPC lehnt die Co-Admin vor `20261110_004` ab (dann bliebe nur wieder das
 * direkte UPDATE), die Bedingung wirkt dagegen mit altem und neuem Server-Stand gleich.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { RepositoryError } from '../errors';

export interface CloudShareState {
    isPublic: boolean;
    shareCode: string | undefined;
    shareCodeCreatedAt: string | undefined;
}

/** `applied`: der Code des Geräts steht jetzt in der Cloud. Sonst `cloud` = Stand der Zeile (null: nicht lesbar). */
export type ShareIfUnsharedResult = { applied: true } | { applied: false; cloud: CloudShareState | null };

export async function shareIfUnshared(
    client: SupabaseClient<Database>,
    tournamentId: string,
    share: { shareCode: string; shareCodeCreatedAt?: string },
): Promise<ShareIfUnsharedResult> {
    const { data: updated, error } = await client
        .from('tournaments')
        .update({
            is_public: true,
            share_code: share.shareCode,
            ...(share.shareCodeCreatedAt === undefined ? {} : { share_code_created_at: share.shareCodeCreatedAt }),
            updated_at: new Date().toISOString(),
        })
        .eq('id', tournamentId)
        .is('share_code', null)
        .select('id');
    if (error) {
        throw new RepositoryError('updateMetadata', error.message, error);
    }
    if (updated.length > 0) {
        return { applied: true };
    }
    const { data: row, error: readError } = await client
        .from('tournaments')
        .select('is_public, share_code, share_code_created_at')
        .eq('id', tournamentId)
        .maybeSingle();
    if (readError) {
        throw new RepositoryError('updateMetadata', readError.message, readError);
    }
    return {
        applied: false,
        cloud: row === null ? null : {
            isPublic: row.is_public === true,
            shareCode: row.share_code ?? undefined,
            shareCodeCreatedAt: row.share_code_created_at ?? undefined,
        },
    };
}
