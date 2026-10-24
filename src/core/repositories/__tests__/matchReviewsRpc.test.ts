/**
 * B-50 Lesepfad `list_match_reviews` (A-35 § 7): ruft die Funktion mit der Turnier-ID, liest die Antwort; ein Fehler behält
 * den letzten Stand (`ok: false`), statt die Liste still zu leeren. Gast ohne Client: leere Liste.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { readMatchReviews } from '../matchReviewsRpc';
import { review } from '../../match/review/__tests__/reviewFixtures';

const clientWith = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient<Database>;

describe('readMatchReviews', () => {
  it('ruft list_match_reviews mit p_tournament_id und liefert die gelesenen Einträge', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [review({ eventId: 'tor-1' })], error: null });
    const result = await readMatchReviews(clientWith(rpc), 'live-cup');
    expect(rpc).toHaveBeenCalledWith('list_match_reviews', { p_tournament_id: 'live-cup' });
    expect(result.ok && result.reviews.map((r) => r.eventId)).toEqual(['tor-1']);
  });

  it('Gegenbeispiel: Server-Fehler → ok false (Oberfläche behält den letzten Stand)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await readMatchReviews(clientWith(rpc), 'live-cup')).toEqual({ ok: false });
  });

  it('ohne Client (Gast): leere Liste', async () => {
    expect(await readMatchReviews(null, 'live-cup')).toEqual({ ok: true, reviews: [] });
  });
});
