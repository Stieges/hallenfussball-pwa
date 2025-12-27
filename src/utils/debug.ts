/**
 * Debug Utilities
 *
 * Provides development-only logging that is stripped in production builds.
 * Use these functions instead of console.log/warn/error directly.
 *
 * @example
 * import { debugLog, debugWarn, debugError } from '@/utils/debug';
 *
 * debugLog('[MyComponent]', 'Value changed:', value);
 * debugWarn('[MyHook]', 'Deprecated usage');
 * debugError('[API]', 'Failed to fetch:', error);
 */

/* eslint-disable no-console */

const isDev = import.meta.env.DEV;

/**
 * Development-only console.log
 * Automatically stripped in production builds.
 */
export function debugLog(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}

/**
 * Development-only console.warn
 * Automatically stripped in production builds.
 */
export function debugWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn(...args);
  }
}

/**
 * Development-only console.error
 * For errors that should be logged in dev but not spam production.
 * NOTE: For critical errors that need tracking in production,
 * use a proper error reporting service (Sentry, etc.) instead.
 */
export function debugError(...args: unknown[]): void {
  if (isDev) {
    console.error(...args);
  }
}

/**
 * Logs a message with timing information.
 * Useful for performance debugging.
 *
 * @example
 * const end = debugTime('[Scheduler]', 'Generating schedule');
 * // ... do work ...
 * end(); // Logs: "[Scheduler] Generating schedule: 123ms"
 */
export function debugTime(context: string, label: string): () => void {
  if (!isDev) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  const start = performance.now();
  console.log(`${context} ${label}...`);

  return () => {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`${context} ${label}: ${duration}ms`);
  };
}

/**
 * Logs a value and returns it (for debugging in pipelines).
 *
 * @example
 * const result = someArray
 *   .filter(x => x > 0)
 *   .map(debugTap('[Filter]', 'After filter'))
 *   .reduce((a, b) => a + b);
 */
export function debugTap<T>(context: string, label: string): (value: T) => T {
  return (value: T) => {
    if (isDev) {
      console.log(`${context} ${label}:`, value);
    }
    return value;
  };
}
