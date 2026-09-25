/**
 * matchResultStatusDiff — shared helper for A2 Fixrunde 1 (Ruling AJ,
 * `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md`, Issues C1/I1).
 *
 * A2 made `SupabaseRepository.save()` skip result/status columns for EXISTING matches (protects a
 * helper's live match from a stale full save, see `mapMatchToScheduleUpdate`). That also silently
 * broke every OTHER action that deliberately changes a match's result or status and then calls the
 * full save: the review found the result correction dialog (`useCorrectionMode`), "reset
 * results"/"reset schedule" (`DangerZone`), skip/unskip (`useScheduleEditor`), and backup restore
 * (`Exports`) all landed only in local state after A2, never in the cloud.
 *
 * This module is the single place that decides "did the RESULT or STATUS of a match change" and
 * turns that into a targeted `MatchUpdate` — callers pass it their OLD and NEW `Match[]` and get
 * back exactly the updates to send via `tournamentRepo.updateMatch(es)` (offline: queued the same
 * way as everything else, see `OfflineRepository`), instead of relying on a full `save()`.
 */

import { Match, MatchUpdate } from '../models/types';

/**
 * The RESULT/STATUS columns a match can carry — the mirror image of the "schedule columns" that
 * `mapMatchToScheduleUpdate` (`supabaseMappers.ts`) protects. Kept as a literal tuple (not derived
 * from `Match`) so a new field must be added here DELIBERATELY, the same reasoning as the
 * schedule-columns allowlist.
 */
const RESULT_STATUS_FIELDS = [
  'scoreA',
  'scoreB',
  'matchStatus',
  'finishedAt',
  'timerStartTime',
  'timerPausedAt',
  'timerElapsedSeconds',
  'overtimeScoreA',
  'overtimeScoreB',
  'penaltyScoreA',
  'penaltyScoreB',
  'decidedBy',
  'skippedReason',
  'skippedAt',
] as const;

function hasResultStatusChange(previous: Match, current: Match): boolean {
  return RESULT_STATUS_FIELDS.some((field) => previous[field] !== current[field]);
}

/** Builds the targeted update for one match — ALL result/status fields, not just the changed
 *  ones, so a caller never has to track field-level diffs itself. Every field is included as an
 *  OWN property (even when `undefined`) — `mapMatchUpdateToSupabase` (A2 Fixrunde 1) treats a
 *  present-but-undefined field as an explicit clear (writes `null`), so a reset (e.g.
 *  `scoreA: undefined` in `DangerZone`) is actually persisted, not silently skipped. */
function toResultStatusUpdate(match: Match): MatchUpdate {
  return {
    id: match.id,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    matchStatus: match.matchStatus,
    finishedAt: match.finishedAt,
    timerStartTime: match.timerStartTime,
    timerPausedAt: match.timerPausedAt,
    timerElapsedSeconds: match.timerElapsedSeconds,
    overtimeScoreA: match.overtimeScoreA,
    overtimeScoreB: match.overtimeScoreB,
    penaltyScoreA: match.penaltyScoreA,
    penaltyScoreB: match.penaltyScoreB,
    decidedBy: match.decidedBy,
    skippedReason: match.skippedReason,
    skippedAt: match.skippedAt,
  };
}

/**
 * Diffs the RESULT/STATUS columns between an OLD and a NEW match list (old vs. new tournament
 * state) and returns one targeted `MatchUpdate` per match whose result or status actually
 * changed — ready for `tournamentRepo.updateMatch(es)` instead of a full `save()`.
 *
 * A match that exists only in `newMatches` (freshly created, e.g. schedule regeneration) is
 * skipped here — it has no live state in the cloud yet to protect, and is inserted through the
 * normal full-save path (`SupabaseRepository.save()`'s `newMatchRows` branch).
 */
export function diffMatchResultStatusUpdates(
  oldMatches: Match[],
  newMatches: Match[]
): MatchUpdate[] {
  const oldById = new Map(oldMatches.map((match) => [match.id, match]));
  const updates: MatchUpdate[] = [];

  for (const match of newMatches) {
    const previous = oldById.get(match.id);
    if (!previous || !hasResultStatusChange(previous, match)) {
      continue;
    }
    updates.push(toResultStatusUpdate(match));
  }

  return updates;
}
