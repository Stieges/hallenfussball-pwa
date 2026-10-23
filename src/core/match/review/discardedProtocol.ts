/**
 * B-50 Nachblick N1 (@FU-095 „die beiden Tore stehen als verworfen im Verlauf“; Record Ergebnisse korrigieren B6.3: „Es gibt
 * nur diesen einen Verlauf je Spiel“): verworfene Klärungseinträge eines Spiels als Zeilen des Spielprotokolls. Die Ziele
 * bleiben am Server `pending` und kommen nie ins Spiel-Log; ihren Inhalt und die Entscheidung liefert `list_match_reviews`
 * (nur Turnierleitung). Sie zählen nicht zum Stand – das Protokoll zeigt sie wie zurückgenommene Einträge, mit
 * „verworfen von Olli, 12:10“. Rein, ohne React.
 */
import type { MatchContext } from '../types';
import { toProtocolEvent, type LiveRuntimeEvent } from '../client/viewAdapters';
import type { MatchReview } from './matchReviewTypes';

export interface DiscardedEntry {
  event: LiveRuntimeEvent;
  /** Name der entscheidenden Person (nie E-Mail), `null`, wenn unbekannt. */
  by: string | null;
  /** Zeitpunkt der Entscheidung (ms). */
  at: number;
}

export function discardedProtocolEntries(
  reviews: readonly MatchReview[],
  ctx: MatchContext,
  scoreAfter: { home: number; away: number },
): DiscardedEntry[] {
  const matchId = ctx.matchId.toLowerCase();
  const out: DiscardedEntry[] = [];
  for (const review of reviews) {
    if (review.matchId.toLowerCase() !== matchId || review.kind !== 'review' || review.decision?.type !== 'REVIEW_DISCARD') {
      continue;
    }
    const event = toProtocolEvent({
      id: review.eventId,
      type: review.entry.type,
      actor: 'helper',
      at: review.entry.deviceAt ?? review.receivedAt,
      section: review.entry.section,
      clockMs: review.entry.clockMs,
      teamId: review.entry.teamId,
      targetId: review.entry.targetId,
      payload: review.entry.payload,
    }, ctx, scoreAfter);
    if (event) {
      out.push({ event, by: review.decision.by, at: review.decision.at });
    }
  }
  return out;
}
