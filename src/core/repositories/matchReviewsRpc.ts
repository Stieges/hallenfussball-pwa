/**
 * B-50 Klärungsliste: Lesepfad `public.list_match_reviews(p_tournament_id)` (Migration 20261117_005, A-35 § 7). Nur die
 * Turnierleitung (leadMatches) bekommt Einträge, alle anderen `[]`. `src/types/supabase.ts` kennt die Funktion erst nach
 * dem Typen-PR (nach F4, 17.11.) – deshalb ohne Typbindung (Muster `resetMatchResultsRpc.ts`).
 *
 * Fehlerpolitik: ohne Client → `{ ok: true, reviews: [] }` (Gast, nur lokal); Netz-/Server-Fehler → `{ ok: false }`, die
 * Oberfläche behält dann den letzten Stand (nichts verschwindet still). Antwort per zod geprüft (`parseMatchReviews`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { parseMatchReviews, type MatchReview } from '../match/review/matchReviewTypes';
import { withCloudReadTimeout } from './cloudAdoption';

type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type MatchReviewsResult = { ok: true; reviews: MatchReview[] } | { ok: false };

export async function readMatchReviews(client: SupabaseClient<Database> | null, tournamentId: string): Promise<MatchReviewsResult> {
  if (!client) {
    return { ok: true, reviews: [] };
  }
  const rpc = client.rpc.bind(client) as unknown as UntypedRpc;
  try {
    const response = await withCloudReadTimeout(Promise.resolve(rpc('list_match_reviews', { p_tournament_id: tournamentId })));
    if (response.error) {
      return { ok: false };
    }
    return { ok: true, reviews: parseMatchReviews(response.data) };
  } catch {
    return { ok: false };
  }
}
