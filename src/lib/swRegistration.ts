/**
 * Service-Worker registration with idle-gated auto-reload-on-update (C3b-2d, G8).
 *
 * vite-plugin-pwa's built-in `registerType: 'autoUpdate'` installs the new
 * SW in the background but does NOT reload the active page, so users keep
 * seeing the previously cached bundle until they happen to open a new tab.
 *
 * This module flips to `prompt` semantics so we can control the update flow:
 * a persistent notice („Neue App-Version verfügbar“ + Knopf „Jetzt
 * aktualisieren“) is shown as soon as a new bundle waits — it never
 * auto-hides and the button reloads immediately (no lock, no idle check).
 * Automatically reloading happens ONLY in the idle state (no modal dialog AND
 * outbox of the current account empty, see `swIdle.ts`); right before
 * `updateSW(true)` the idle state is re-checked (a dialog opened during the
 * 2-s toast delay cancels that attempt, the idle watch continues) and is
 * repeated on several occasions (dialog closed, visibilitychange, online, at
 * least every 60 s). A brief toast („App wird aktualisiert …“) precedes that
 * idle reload so users see why the page reloads. A direct `reload()` is kept
 * only as a defensive fallback when `updateSW` rejects. Setup runs at most
 * once per page load (module singleton, `swSetupSlots.ts`); follow-up calls
 * only swap the runtime slots (message/toast/notice).
 *
 * Error policy (binding):
 * 1. `registration.update()` throws/rejects (e.g. offline) -> silently ignored
 *    (no Sentry, no toast, no rethrow).
 * 2. Outbox not readable -> treated as NOT idle (never auto-reload in doubt).
 * 3. No account/engine context -> only the dialog condition is checked (swIdle).
 * 4. `updateSW(true)` rejects -> Sentry + `reload()` fallback (unchanged).
 * 5. Showing the notice throws -> Sentry + continue; a failing notice must
 *    never block the update/auto-reload.
 *
 * The registration callback is injected (no direct import of
 * `virtual:pwa-register`) so the unit tests don't need to mock virtual vite
 * modules.
 */
import { addBreadcrumb, captureFeatureError } from './sentry';
import {
  IDLE_RECHECK_MS,
  OBSERVER_DEBOUNCE_MS,
  UPDATE_POLL_MS,
} from './swIdle';
import {
  getSwSetup,
  registerSwSetup,
  replaceSwSetupSlots,
  type SetupOptions,
  type SwAutoReloadHandle,
} from './swSetupSlots';

export {
  __resetSwForTests,
  type RegisterSWFn,
  type RegisterSWOptions,
  type SetupOptions,
  type SwAutoReloadHandle,
} from './swSetupSlots';

/** Default delay between toast and idle reload (≈ time to read the message). */
export const DEFAULT_RELOAD_DELAY_MS = 2000;

export function setupSwAutoReload(options: SetupOptions): SwAutoReloadHandle {
  const existing = getSwSetup();
  if (existing) {
    replaceSwSetupSlots(options);
    return existing.handle;
  }
  let hasScheduledReload = false;
  let hasFiredReload = false;
  let idleCleanup: (() => void) | undefined;
  let pollCleanup: (() => void) | undefined;

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

  /** Regel 4: `updateSW(true)` lehnt ab -> Sentry + reload()-Fallback. */
  const updateSWAndReload = (): void => {
    // vite-plugin-pwa (prompt): updateSW() sendet SKIP_WAITING; den Reload
    // uebernimmt der plugin-interne controlling-Listener. Der Fallback-reload
    // ist rein defensiv (updateSW rejected in der Praxis nicht).
    void updateSW(true).catch((err: unknown) => {
      if (err instanceof Error) {
        captureFeatureError(err, 'sw', 'updateSW');
      }
      reload();
    });
  };

  /** Knopf „Jetzt aktualisieren“: ohne Sperre, ohne Idle-Pruefung (Regel 4 bleibt). */
  const fireUpdateNow = (): void => {
    updateSWAndReload();
  };

  /**
   * Automatik: Re-Check direkt vor dem Neuladen (im 2-s-Fenster kann ein Dialog
   * aufgehen). Nicht idle/Wurf -> zurueck ins Warten (Watcher bleiben);
   * `idleCleanup` erst beim echten Feuern.
   */
  const fireReload = (): void => {
    if (hasFiredReload) {
      return;
    }
    void (async () => {
      let idle: boolean;
      try {
        idle = await options.isIdle();
      } catch {
        idle = false;
      }
      if (hasFiredReload) {
        return;
      }
      if (!idle) {
        hasScheduledReload = false;
        return;
      }
      hasFiredReload = true;
      idleCleanup?.();
      updateSWAndReload();
    })();
  };

  /**
   * Erneute Leerlauf-Pruefung (wiederholbar). Das Neuladen selbst wird
   * hoechstens einmal ausgeloest (`hasFiredReload`), die Pruefung beliebig oft.
   */
  const onMaybeIdle = async (): Promise<void> => {
    if (hasScheduledReload || hasFiredReload) {
      return;
    }
    let idle: boolean;
    try {
      idle = await options.isIdle();
    } catch {
      idle = false;
    }
    if (!idle || hasScheduledReload || hasFiredReload) {
      return;
    }
    hasScheduledReload = true;
    addBreadcrumb('sw', 'New SW detected — idle, toast + scheduled reload', {
      delayMs: delay,
    });
    try {
      options.showToast(options.updatingMessage());
    } catch (err) {
      // Toast surface must never block the reload
      if (err instanceof Error) {
        captureFeatureError(err, 'sw', 'showToast');
      }
    }
    scheduleReload(fireReload, delay);
  };

  /** Ausloeser, solange ein Update wartet (Start onNeedRefresh, Ende Feuerung/dispose). */
  const startIdleWatchers = (): void => {
    if (idleCleanup) {
      return;
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void onMaybeIdle();
      }
    };
    const onOnline = (): void => {
      void onMaybeIdle();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const recheck = setInterval(() => {
      void onMaybeIdle();
    }, IDLE_RECHECK_MS);

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (debounceTimer !== undefined) {
        return;
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        void onMaybeIdle();
      }, OBSERVER_DEBOUNCE_MS);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal'],
    });

    idleCleanup = () => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      clearInterval(recheck);
      idleCleanup = undefined;
    };
  };

  /** Regel 1: `registration.update()` wirft/lehnt ab -> still ignorieren. */
  const safeUpdate = async (registration: ServiceWorkerRegistration): Promise<void> => {
    try {
      await registration.update();
    } catch {
      // still ignorieren — kein Sentry, kein Toast, kein Wurf.
    }
  };

  const installUpdatePolling = (registration: ServiceWorkerRegistration): void => {
    if (pollCleanup) {
      return;
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void safeUpdate(registration);
      }
    };
    const onOnline = (): void => {
      void safeUpdate(registration);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const poll = setInterval(() => {
      void safeUpdate(registration);
    }, UPDATE_POLL_MS);
    pollCleanup = () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      clearInterval(poll);
      pollCleanup = undefined;
    };
  };

  const updateSW = options.registerSW({
    immediate: true,
    onNeedRefresh: () => {
      // Hinweis bleibt stehen (kein Auto-Ausblenden); sein Knopf feuert sofort.
      try {
        options.showUpdateNotice(fireUpdateNow);
      } catch (err) {
        if (err instanceof Error) {
          captureFeatureError(err, 'sw', 'showUpdateNotice');
        }
      }
      startIdleWatchers();
      void onMaybeIdle();
    },
    onRegisterError: (error) => {
      if (error instanceof Error) {
        captureFeatureError(error, 'sw', 'register');
      }
    },
    onRegisteredSW: (_swUrl, registration) => {
      if (registration) {
        installUpdatePolling(registration);
      }
    },
  });

  const handle: SwAutoReloadHandle = {
    updateSW,
    dispose: () => {
      idleCleanup?.();
      pollCleanup?.();
    },
  };
  registerSwSetup({ handle, options });
  return handle;
}
