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
 *
 * A2 Fixrunde 3 (Ruling, N1: `task-A2-rereview.md`) — REWRITTEN from Fixrunde 1's design. Fixrunde
 * 1 always emitted ALL 14 result/status fields from the NEW match whenever ANY of them changed,
 * sourced from whatever the caller's local state happened to hold — for `handleScoreChange`, that
 * meant a stale local `matchStatus`/timer/tiebreaker got written to the cloud alongside the score,
 * exactly the "overwrite a helper's live match with an old local state" pattern A2 exists to
 * prevent (the review's own "trotzdem eintragen" scenario: owner enters a score while a helper's
 * match is running, confirms the live-match warning). Now: ONLY the fields that actually differ
 * between `previous` and `match` are included — everything else is left untouched. A field that
 * became `undefined` (explicitly cleared, e.g. `DangerZone`'s reset) is still reported, using the
 * SAME insert defaults as `mapMatchToSupabase` (`matchStatus` → `'scheduled'`,
 * `timerElapsedSeconds` → `0`) instead of `NULL` for those two, and `null` (not `undefined`, so it
 * survives `JSON.stringify` in the offline mutation queue — see N2) for the rest.
 */

import { Match, MatchUpdate, NullableMatchUpdateFields } from '../models/types';

/**
 * The RESULT/STATUS columns a match can carry — the mirror image of the "schedule columns" that
 * `mapMatchToScheduleUpdate` (`supabaseMappers.ts`) protects. Kept as a literal tuple (not derived
 * from `Match`) so a new field must be added here DELIBERATELY, the same reasoning as the
 * schedule-columns allowlist.
 */
const RESULT_STATUS_FIELDS: readonly NullableMatchUpdateFields[] = [
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
];

/**
 * Insert defaults from `mapMatchToSupabase` (`supabaseMappers.ts`) — applied when a field is
 * explicitly cleared (new value `undefined`) instead of writing `NULL`. Every field NOT listed
 * here defaults to `null` when cleared, matching `mapMatchToSupabase`'s `?? null` fallback.
 */
const CLEARED_FIELD_DEFAULT: Partial<Record<NullableMatchUpdateFields, unknown>> = {
  matchStatus: 'scheduled',
  timerElapsedSeconds: 0,
};

/**
 * Diffs the RESULT/STATUS columns between an OLD and a NEW match list (old vs. new tournament
 * state) and returns one targeted `MatchUpdate` per match whose result or status actually
 * changed — ready for `tournamentRepo.updateMatch(es)` instead of a full `save()`. Only the
 * fields that actually differ are included in each update; fields that are unchanged are left out
 * entirely, even when SOME other field on the same match changed (N1).
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
    if (!previous) {
      continue;
    }

    let update: MatchUpdate | null = null;

    for (const field of RESULT_STATUS_FIELDS) {
      const oldValue = previous[field];
      const newValue = match[field];
      if (oldValue === newValue) {
        continue;
      }

      update ??= { id: match.id };
      if (newValue !== undefined) {
        (update as Record<string, unknown>)[field] = newValue;
      } else {
        // Explicitly cleared: use the same insert default as mapMatchToSupabase, or `null` for
        // every other field -- NEVER `undefined` (would be dropped by JSON.stringify, N2).
        (update as Record<string, unknown>)[field] = field in CLEARED_FIELD_DEFAULT
          ? CLEARED_FIELD_DEFAULT[field]
          : null;
      }
    }

    if (update) {
      updates.push(update);
    }
  }

  return updates;
}
