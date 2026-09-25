/**
 * Core Domain Models
 * Re-exporting types from the types folder to establish a clean Domain Boundary.
 * In the future, we might move the actual definitions here.
 */

import { Tournament, Match, Team } from '../../types/tournament';

export type { Tournament, Match, Team };

// Helper Types for partial updates

/**
 * A2 Fixrunde 3 (Ruling, N2: .superpowers/sdd/2026-09-25-oktober-fundament-helfer/
 * task-A2-rereview.md): result/status fields on a `MatchUpdate` may ALSO be `null`, meaning
 * "explicitly clear this field" -- distinct from `undefined`, which means "this update doesn't
 * mention the field, leave it alone." `null` is the wire-safe form: `JSON.stringify` drops an
 * `undefined`-valued key entirely (so a queued mutation that survives a reload/retry loses the
 * clear), but keeps `null`. `Match` itself is unaffected (its fields stay `T | undefined`, never
 * `null`) -- only the update DTO widens. Consumers that merge an update into a live `Match`
 * (`LocalStorageRepository#updateMatches`) must translate `null` back to `undefined` there.
 */
export type NullableMatchUpdateFields =
  | 'scoreA'
  | 'scoreB'
  | 'matchStatus'
  | 'finishedAt'
  | 'timerStartTime'
  | 'timerPausedAt'
  | 'timerElapsedSeconds'
  | 'overtimeScoreA'
  | 'overtimeScoreB'
  | 'penaltyScoreA'
  | 'penaltyScoreB'
  | 'decidedBy'
  | 'skippedReason'
  | 'skippedAt';

export type MatchUpdate =
  Partial<Omit<Match, NullableMatchUpdateFields>> &
  { [K in NullableMatchUpdateFields]?: Match[K] | null } &
  { id: string };

export type TeamUpdate = Partial<Team> & { id: string };
