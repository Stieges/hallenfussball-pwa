/**
 * Service-Worker registration with auto-reload-on-update behaviour.
 *
 * vite-plugin-pwa's built-in `registerType: 'autoUpdate'` installs the new
 * SW in the background but does NOT reload the active page, so users keep
 * seeing the previously cached bundle until they happen to open a new tab.
 * Live HAR-traces from production (2026-05-24) confirm two distinct bundle
 * hashes loading in the same session — the precached one being responsible
 * for the false-offline UX on /login.
 *
 * This module flips to `prompt` semantics so we can control the update flow
 * ourselves: a brief toast informs the user, then we hard-reload to flush
 * the precache. The registration callback is injected (no direct import of
 * `virtual:pwa-register`) so the unit tests don't need to mock virtual
 * vite modules.
 */

import { addBreadcrumb, captureFeatureError } from './sentry';

export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

/**
 * Minimal type of `registerSW` exported by `virtual:pwa-register` —
 * duplicated locally so this module doesn't depend on that virtual import.
 */
export type RegisterSWFn = (
  options?: RegisterSWOptions,
) => (reloadPage?: boolean) => Promise<void>;

export interface SetupOptions {
  /** Injected vite-plugin-pwa registerSW. */
  registerSW: RegisterSWFn;
  /** Called once with the localized "updating…" message before reload. */
  showToast: (message: string) => void;
  /** Localized message for the auto-reload toast. */
  updatingMessage: string;
  /** Test seam — defaults to window.location.reload(). */
  reload?: () => void;
  /** Test seam — defaults to global setTimeout. */
  scheduleReload?: (cb: () => void, delayMs: number) => void;
  /** Delay between toast and reload so users see why the page reloads. */
  delayBeforeReloadMs?: number;
}

/** Default delay between toast and reload (≈ time to read the message). */
export const DEFAULT_RELOAD_DELAY_MS = 2000;

/**
 * Wires up vite-plugin-pwa so that whenever a new bundle has been installed
 * in the background, the user is notified and the page is hard-reloaded to
 * pick it up.
 *
 * Returns the `updateSW` function from vite-plugin-pwa for callers that
 * want to drive a manual update (unused for now, but cheap to expose).
 */
export function setupSwAutoReload(options: SetupOptions): (reloadPage?: boolean) => Promise<void> {
  let hasScheduledReload = false;
  const reload =
    options.reload ??
    (() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    });
  const scheduleReload =
    options.scheduleReload ?? ((cb, ms) => { setTimeout(cb, ms); });
  const delay = options.delayBeforeReloadMs ?? DEFAULT_RELOAD_DELAY_MS;

  const updateSW = options.registerSW({
    immediate: true,
    onNeedRefresh: () => {
      if (hasScheduledReload) {
        return;
      }
      hasScheduledReload = true;
      addBreadcrumb('sw', 'New SW detected — toast + scheduled reload', {
        delayMs: delay,
      });
      try {
        options.showToast(options.updatingMessage);
      } catch (err) {
        // Toast surface must never block the reload
        if (err instanceof Error) {
          captureFeatureError(err, 'sw', 'showToast');
        }
      }
      scheduleReload(() => {
        reload();
      }, delay);
    },
    onRegisterError: (error) => {
      if (error instanceof Error) {
        captureFeatureError(error, 'sw', 'register');
      }
    },
  });

  return updateSW;
}
