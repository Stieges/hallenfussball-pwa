/**
 * A-06g (@FU-009, Brief A8): Verdrahtung der Mutationswarteschlange mit dem MatchEngineProvider.
 * Framework-frei. Die Wiederaufnahme nach Anmeldung laeuft NUR ueber setTimeout, nie ueber ein
 * `await` im Auth-Ereignis (auth-js: asynchrone Auth-Callbacks sind veraltet, Deadlock-Gefahr).
 */
import type { MutationQueue } from '../../core/services/MutationQueue';
import { captureFeatureError } from '../../lib/sentry';

export type ResumableQueue = Pick<MutationQueue, 'processIfDue' | 'resumeAfterAuth'>;

type TimerHandle = ReturnType<typeof setTimeout>;

function isResumableQueue(value: unknown): value is ResumableQueue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'processIfDue' in value &&
    typeof value.processIfDue === 'function' &&
    'resumeAfterAuth' in value &&
    typeof value.resumeAfterAuth === 'function'
  );
}

/** Die Mutationswarteschlange des Turnier-Repos (nur `OfflineRepository` hat eine; sonst null). */
export function queueOf(repo: object): ResumableQueue | null {
  if (!('mutationQueue' in repo)) {
    return null;
  }
  return isResumableQueue(repo.mutationQueue) ? repo.mutationQueue : null;
}

/** Plant `resumeAfterAuth` auf der AKTUELLEN Queue (zur Ausfuehrungszeit) nach setTimeout 0. */
export function scheduleQueueResume(
  timers: Set<TimerHandle>,
  queueRef: { readonly current: ResumableQueue | null },
): void {
  const handle = setTimeout(() => {
    timers.delete(handle);
    const queue = queueRef.current;
    if (queue !== null) {
      void queue.resumeAfterAuth().catch((error: unknown) => {
        captureFeatureError(error instanceof Error ? error : new Error(String(error)), 'sync', 'resumeAfterAuth');
      });
    }
  }, 0);
  timers.add(handle);
}

/** Loescht alle ausstehenden Wiederaufnahmen (Abmelden, Unmount). */
export function cancelQueueResumes(timers: Set<TimerHandle>): void {
  timers.forEach((handle) => clearTimeout(handle));
  timers.clear();
}
