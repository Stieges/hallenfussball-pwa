/**
 * core/utils/syncRetryTiming — gemeinsame Zeitwerte und Zeitlimit-Wrapper für Sync/Retry
 * (A-06a, Brief A1 + A3). Framework-frei; `RetryTimers` ist ein eigener struktureller Typ,
 * damit hier nichts aus `core/match/client` importiert werden muss.
 */

/** Wartezeiten vor Wiederholung (A1): Stufe i liefert RETRY_BACKOFF_MS[i], darüber Deckel. */
export const RETRY_BACKOFF_MS: readonly number[] = [1000, 2000, 5000];

/** Zeitlimit für einen einzelnen Cloud-Request (A1). */
export const REQUEST_TIMEOUT_MS = 15000;

/** Wartezeit vor dem nächsten Queue-Durchlauf bei permanenten Fehlern (A1). */
export const PERMANENT_RETRY_MS_QUEUE = 30000;

/**
 * Fehler für ein überschrittenes Request-Zeitlimit. `name: 'TimeoutError'` ist das
 * Erkennungsmerkmal in `isTransientMutationError`; der Text trägt „TimeoutError" zusätzlich.
 */
export function createRequestTimeoutError(ms: number): Error {
  return Object.assign(new Error(`Zeitlimit: keine Antwort nach ${ms} ms (TimeoutError)`), {
    name: 'TimeoutError',
  });
}

/** Wartezeit vor Wiederholung Nr. `step` (0-basiert); jenseits des letzten Index gedeckelt. */
export function backoffMsFor(step: number): number {
  const lastIndex = RETRY_BACKOFF_MS.length - 1;
  const index = Math.min(Math.max(step, 0), lastIndex);
  return RETRY_BACKOFF_MS[index];
}

/** Struktureller Timer-Typ (A3) — kein Import aus `core/match/client`. */
export interface RetryTimers {
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/**
 * Führt `run` aus und bricht nach `ms` ab (A3): `AbortController.abort()` ohne Argument,
 * `Promise.race` gegen ein Timeout, der Timer wird in `finally` geräumt.
 */
export async function withRequestTimeout<T>(
  timers: RetryTimers,
  ms: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let handle: unknown;
  const timeout = new Promise<never>((_resolve, reject) => {
    handle = timers.setTimeout(() => {
      controller.abort();
      reject(createRequestTimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    timers.clearTimeout(handle);
  }
}
