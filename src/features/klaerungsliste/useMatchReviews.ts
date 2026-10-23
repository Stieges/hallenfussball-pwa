/**
 * B-50: Klärungsliste eines Turniers für die Turnierleitung (leadMatches). Übergabe A-35 h6: `match_reviews` steht nicht in
 * der Realtime-Publikation – deshalb Abfrage alle 15 s, sobald das Fenster wieder sichtbar ist, und nach jeder
 * Entscheidung (`refresh`). Abgefragt wird nur mit Recht der Turnierleitung, mit Netz und bei Turnieren in der Cloud
 * (Konto, nicht Gast – Review m4); ohne Netz bleibt der letzte Stand stehen. Ein Lesefehler behält den letzten Stand.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { readMatchReviews } from '../../core/repositories/matchReviewsRpc';
import type { MatchReview } from '../../core/match/review/matchReviewTypes';
import { useCan } from '../auth/hooks/useCan';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';

export const REVIEW_POLL_MS = 15_000;

export interface MatchReviewsState {
  enabled: boolean;
  reviews: MatchReview[];
  refresh: () => Promise<void>;
}

export function useMatchReviews(tournamentId: string): MatchReviewsState {
  return useMatchReviewsFor(tournamentId, useCan('leadMatches', tournamentId));
}

/** Wie `useMatchReviews`, das Recht der Turnierleitung kommt vom Aufrufer (Cockpit: `istLeitung`, ohne zweite Rechte-Abfrage). */
export function useMatchReviewsFor(tournamentId: string, lead: boolean): MatchReviewsState {
  const context = useMatchEngineContextOptional();
  const cloud = context !== null && context.accountId !== 'guest';
  const enabled = lead && cloud;
  const { isOnline } = useOnlineStatus();
  const [reviews, setReviews] = useState<MatchReview[]>([]);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled || !isOnline) {
      return;
    }
    const result = await readMatchReviews(supabase, tournamentId);
    if (alive.current && result.ok) {
      setReviews(result.reviews);
    }
  }, [enabled, isOnline, tournamentId]);

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
  }, [enabled, isOnline, refresh]);

  return { enabled, reviews, refresh };
}
