/**
 * lazyWithRetry — retries failed dynamic imports before giving up.
 *
 * Fixes the class of bug seen in Sentry issue JAVASCRIPT-REACT-9:
 * stale Service-Worker / CDN cache hands the browser an old chunk
 * hash that no longer exists, producing "Failed to fetch dynamically
 * imported module".
 *
 * Strategy: up to RETRY_COUNT attempts with exponential backoff.
 * On final failure: dispatch a CustomEvent('lazy-import-failed') so
 * a top-level ErrorBoundary can show a Refresh-CTA, and report to
 * Sentry via captureFeatureError.
 */
import { lazy } from 'react';
import type { ComponentType } from 'react';
import { captureFeatureError } from './sentry';

export const LAZY_IMPORT_FAILED_EVENT = 'lazy-import-failed';
const RETRY_COUNT = 3;
const RETRY_BACKOFF_MS = [200, 500, 1500];

type ModuleFactory<T> = () => Promise<{ default: ComponentType<T> }>;

export interface LazyImportFailedDetail {
  chunkName: string;
  error: Error;
  attempts: number;
}

export async function importWithRetry<T>(
  factory: ModuleFactory<T>,
  chunkName: string,
): Promise<{ default: ComponentType<T> }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      return await factory();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < RETRY_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS[attempt]));
      }
    }
  }
  const finalError = lastError ?? new Error('lazyWithRetry: unknown failure');
  captureFeatureError(finalError, 'lazy-import', chunkName, { attempts: RETRY_COUNT });
  window.dispatchEvent(
    new CustomEvent<LazyImportFailedDetail>(LAZY_IMPORT_FAILED_EVENT, {
      detail: { chunkName, error: finalError, attempts: RETRY_COUNT },
    }),
  );
  throw finalError;
}

export function lazyWithRetry<T>(factory: ModuleFactory<T>, chunkName: string) {
  return lazy(() => importWithRetry(factory, chunkName));
}
