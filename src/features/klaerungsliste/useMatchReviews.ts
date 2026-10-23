/**
 * B-50: Klärungsliste eines Turniers für die Turnierleitung (leadMatches). Übergabe A-35 h6: `match_reviews` steht nicht in
 * der Realtime-Publikation – deshalb Abfrage alle 15 s, sobald das Fenster wieder sichtbar ist, und nach jeder
 * Entscheidung (`refresh`). Ohne Recht wird nichts abgefragt (der Server lieferte ohnehin `[]`). Ein Lesefehler behält den
 * letzten Stand.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { readMatchReviews } from '../../core/repositories/matchReviewsRpc';
import type { MatchReview } from '../../core/match/review/matchReviewTypes';
import { useCan } from '../auth/hooks/useCan';

export const REVIEW_POLL_MS = 15_000;

export interface MatchReviewsState {
  enabled: boolean;
  reviews: MatchReview[];
  refresh: () => Promise<void>;
}

export function useMatchReviews(tournamentId: string): MatchReviewsState {
  const enabled = useCan('leadMatches', tournamentId);
  const [reviews, setReviews] = useState<MatchReview[]>([]);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    const result = await readMatchReviews(supabase, tournamentId);
    if (alive.current && result.ok) {
      setReviews(result.reviews);
    }
  }, [enabled, tournamentId]);

  useEffect(() => {
    alive.current = true;
    if (!enabled) {
      setReviews([]);
      return () => { alive.current = false; };
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, REVIEW_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  return { enabled, reviews, refresh };
}
