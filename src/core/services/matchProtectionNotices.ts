/**
 * matchProtectionNotices.ts — transports the A6 "match kept, not deleted" hint out of
 * `SupabaseRepository.save()` (core, framework-free) to whichever React layer wants to show it.
 *
 * A6 Fixrunde 1 (I2, Ruling AN, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-review.md):
 * a protected match (has match_events, or a match_status other than 'scheduled'/NULL) must NOT
 * make `save()` fail. Everything else in the tournament still gets saved; the caller (the
 * `MutationQueue`) must see this `SAVE_TOURNAMENT` mutation as a SUCCESS -- throwing here, even a
 * "soft" error type, would still count as a failed attempt in `GenericMutationQueue.process()`
 * (`isTransientMutationError` only recognizes network-shaped errors as non-counting, see
 * `core/errors.ts`) and eventually dead-letter the mutation, permanently blocking every later sync
 * of this tournament (exactly what Ruling AN rules out).
 *
 * So the hint needs a channel that is NOT the mutation's resolution value (`OfflineRepository.save()`
 * only ENQUEUES a mutation and returns immediately -- the actual `SupabaseRepository.save()` call
 * that discovers the protected match happens later, asynchronously, in `MutationQueue.execute()`,
 * long after the original caller of `save()` is gone; a return value or thrown error can no longer
 * reach it). A plain synchronous pub/sub (module-level listener list, no framework dependency,
 * same shape as `GenericMutationQueue.subscribe()` already uses for pending/failed counts) is the
 * smallest piece that (a) keeps `core/` React-free (LAYERING.md) and (b) lets exactly one thin
 * hook (`useMatchProtectionNotices`, `src/hooks/`) turn a notice into a translated toast via the
 * existing `useToast()`/`react-i18next` machinery -- the same "core emits, a hook translates and
 * renders" split already used for the service-worker update toast (`lib/swRegistration.ts` +
 * `hooks/useSwAutoReload.ts`).
 */

export interface ProtectedMatchInfo {
  /** Match id (uuid). */
  id: string;
  /** Human-facing match number, if the match has one (falls back to `id` at render time). */
  matchNumber: number | null;
}

export interface MatchProtectionNotice {
  tournamentId: string;
  matches: ProtectedMatchInfo[];
}

type Listener = (notice: MatchProtectionNotice) => void;

const listeners = new Set<Listener>();

/**
 * Called by `SupabaseRepository.save()` after a save that kept one or more protected matches.
 * No-op if `notice.matches` is empty (defensive -- callers are expected not to call this with an
 * empty list, but a silent no-op is safer than an empty toast).
 */
export function notifyMatchesProtected(notice: MatchProtectionNotice): void {
  if (notice.matches.length === 0) {
    return;
  }
  listeners.forEach((listener) => listener(notice));
}

/** Subscribes to protection notices. Returns an unsubscribe function (same shape as GenericMutationQueue.subscribe()). */
export function subscribeToMatchProtectionNotices(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
