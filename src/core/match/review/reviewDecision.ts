/**
 * B-50 Klärungsliste: aus der Auswahl eines Falls die Entscheidungen und die Vorschau bilden. Rein, ohne React.
 *
 * - Entscheidung je Eintrag (A-35 Übergabe): `REVIEW_ACCEPT` bzw. `REVIEW_DISCARD`, `targetId` = Klärungseintrag,
 *   Payload `{}`. Übernommen wird nur, was gewählt **und** übernehmbar ist (`REVIEW_COPY_TYPES`); alles andere des
 *   Falls wird verworfen (@FU-095: „nach dem Speichern zählt nur die Gelbe Karte, die beiden Tore stehen als verworfen“).
 *   Ein gewähltes Paar Tor + Rücknahme wird ganz verworfen (Wirkung gleich, Plan B-50 Q3).
 * - Vorschau (@FU-095): die übernommenen Einträge werden wie die Server-Kopie (Akteur `leitung`, `targetId`) mit der
 *   Rechenfunktion auf den heutigen Stand angewendet. Lehnt sie ab (z. B. beendetes K.-o.-Spiel), sagt die Vorschau das.
 */
import { applyEvent } from '../applyEvent';
import { effectiveScoreFor, type EngineEvent, type MatchContext, type MatchState } from '../types';
import { REVIEW_COPY_TYPES } from '../handlers/reviewCopy';
import type { MatchReview } from './matchReviewTypes';
import type { ReviewUnit } from './reviewCases';

export interface ReviewDecision {
  targetId: string;
  type: 'REVIEW_ACCEPT' | 'REVIEW_DISCARD';
}

/** Einträge, die bei dieser Auswahl übernommen werden, in Spielreihenfolge. */
export function acceptedReviews(units: ReviewUnit[], selected: ReadonlySet<string>): MatchReview[] {
  return units
    .filter((unit) => selected.has(unit.key) && unit.acceptable && !unit.retractPair)
    .flatMap((unit) => unit.reviews)
    .filter((review) => REVIEW_COPY_TYPES.has(review.entry.type));
}

/** Eine Entscheidung je Eintrag des Falls; Übernahmen zuerst in Spielreihenfolge (Gelb vor Gelb-Rot). */
export function decisionsFor(units: ReviewUnit[], selected: ReadonlySet<string>): ReviewDecision[] {
  const accepted = acceptedReviews(units, selected);
  const acceptedIds = new Set(accepted.map((review) => review.eventId));
  const discards = units
    .flatMap((unit) => unit.reviews)
    .filter((review) => !acceptedIds.has(review.eventId))
    .map((review): ReviewDecision => ({ targetId: review.eventId, type: 'REVIEW_DISCARD' }));
  return [...accepted.map((review): ReviewDecision => ({ targetId: review.eventId, type: 'REVIEW_ACCEPT' })), ...discards];
}

export type ReviewPreview =
  | { kind: 'nothing' }
  | { kind: 'score'; home: number; away: number; accepted: MatchReview[] }
  | { kind: 'rejected'; code: string; reason: string | null };

const copyOf = (review: MatchReview, at: number): EngineEvent => ({
  id: `vorschau-${review.eventId}`,
  type: review.entry.type,
  actor: 'leitung',
  at,
  section: review.entry.section,
  clockMs: review.entry.clockMs,
  teamId: review.entry.teamId,
  targetId: review.eventId,
  payload: review.entry.payload,
});

const reasonOf = (detail: unknown): string | null => {
  if (typeof detail === 'object' && detail !== null && 'reason' in detail) {
    return typeof detail.reason === 'string' ? detail.reason : null;
  }
  return null;
};

/** Neuer Stand nach dem Speichern dieser Auswahl; `nothing`, wenn nichts übernommen wird. */
export function previewDecision(state: MatchState, ctx: MatchContext, units: ReviewUnit[], selected: ReadonlySet<string>, now: number): ReviewPreview {
  const accepted = acceptedReviews(units, selected);
  if (accepted.length === 0) {
    return { kind: 'nothing' };
  }
  let current = state;
  for (const review of accepted) {
    const result = applyEvent(current, copyOf(review, now), ctx);
    if (result.status === 'rejected') {
      return { kind: 'rejected', code: result.code, reason: reasonOf(result.detail) };
    }
    if (result.status === 'accepted') {
      current = result.state;
    }
  }
  return {
    kind: 'score',
    home: effectiveScoreFor(current, ctx.teamAId),
    away: effectiveScoreFor(current, ctx.teamBId),
    accepted,
  };
}
