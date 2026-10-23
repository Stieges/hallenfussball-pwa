/**
 * B-50 Klärungsliste: Form eines Eintrags aus `list_match_reviews` (Migration 20261117_005, A-35 § 7). Rein, ohne React.
 * Offen = `kind review` und `decision null`; `kind notice` ist ein Hinweis (@FU-037), der schon zählt.
 * Ein unlesbarer Eintrag wird übersprungen statt die ganze Liste zu verwerfen (`parseMatchReviews`).
 */
import { z } from 'zod';
import { EventTypeSchema } from '../types';

export const ReviewReasonSchema = z.enum(['CONTROL_LOST', 'RIGHTS_REVOKED', 'AFTER_END', 'BEFORE_RESET']);
export type ReviewReason = z.infer<typeof ReviewReasonSchema>;

const ReviewDetailSchema = z.looseObject({
  timing: z.enum(['after', 'before']).optional(),
  why: z.string().optional(),
  rejected: z.string().optional(),
  change: z.string().optional(),
});

const ReviewEntrySchema = z.object({
  type: EventTypeSchema,
  teamId: z.string().nullable(),
  section: z.number().int().nullable(),
  clockMs: z.number().int().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable().transform((value) => value ?? {}),
  targetId: z.string().nullable(),
  deviceAt: z.number().nullable(),
});

const ReviewDecisionSchema = z.object({
  type: z.enum(['REVIEW_ACCEPT', 'REVIEW_DISCARD']),
  eventId: z.string(),
  at: z.number(),
  by: z.string().nullable(),
});

export const MatchReviewSchema = z.object({
  eventId: z.string().min(1),
  matchId: z.string().min(1),
  matchNumber: z.number().int().nullable(),
  field: z.number().int().nullable(),
  kind: z.enum(['review', 'notice']),
  reason: ReviewReasonSchema,
  detail: ReviewDetailSchema.nullable().transform((value) => value ?? {}),
  receivedAt: z.number(),
  author: z.string().nullable(),
  deviceLabel: z.string().nullable(),
  entry: ReviewEntrySchema,
  decision: ReviewDecisionSchema.nullable(),
});
export type MatchReview = z.infer<typeof MatchReviewSchema>;

/** Liest die RPC-Antwort; kein Array → leere Liste, unlesbare Einträge fallen weg. */
export function parseMatchReviews(raw: unknown): MatchReview[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: MatchReview[] = [];
  for (const item of raw) {
    const parsed = MatchReviewSchema.safeParse(item);
    if (parsed.success) {
      out.push(parsed.data);
    }
  }
  return out;
}

/** Wartet auf eine Entscheidung der Turnierleitung. */
export function isOpenReview(review: MatchReview): boolean {
  return review.kind === 'review' && review.decision === null;
}
