/**
 * Service-Worker registration with idle-gated auto-reload-on-update (C3b-2d, G8).
 *
 * vite-plugin-pwa's built-in `registerType: 'autoUpdate'` installs the new
 * SW in the background but does NOT reload the active page, so users keep
 * seeing the previously cached bundle until they happen to open a new tab.
 *
 * This module flips to `prompt` semantics so we can control the update flow:
 * a persistent notice („Neue App-Version verfügbar“ + Knopf „Jetzt
 * aktualisieren“) is shown once a new bundle waits — it never
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
 * 6. Subscribing/unsubscribing `sender.subscribe` breaks off silently (no
 *    Sentry); the listener never throws (`isIdle` catches).
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
  getReloadGate,
  getSwSetup,
  registerSwSetup,
  replaceSwSetupSlots,
  setReloadGateSlot,
  type ReloadGate,
  type SetupOptions,
  type SwAutoReloadHandle,
} from './swSetupSlots';

export {
  __resetSwForTests,
  type ReloadGate,
  type RegisterSWFn,
  type RegisterSWOptions,
  type SetupOptions,
  type SwAutoReloadHandle,
} from './swSetupSlots';

/** Default delay between toast and idle reload (≈ time to read the message). */
export const DEFAULT_RELOAD_DELAY_MS = 2000;

/** Eilpfad (B-19b, @ME-032): nach einer unlesbaren Antwort gilt das Neuladen zwei Minuten lang sofort. */
const URGENT_RELOAD_WINDOW_MS = 2 * 60_000;
/** Mindestabstand der `registration.update()`-Prüfung auf dem Eilpfad (kein Dauer-Abruf von sw.js). */
const URGENT_CHECK_MS = 60_000;

export function setupSwAutoReload(options: SetupOptions): SwAutoReloadHandle {
  const existing = getSwSetup();
  if (existing) {
    replaceSwSetupSlots(options);
    return existing.handle;
  }
  let hasScheduledReload = false;
  let hasFiredReload = false;
  let updateWaiting = false;
  let idleCleanup: (() => void) | undefined;
  let pollCleanup: (() => void) | undefined;
  let knownRegistration: ServiceWorkerRegistration | undefined;
  let urgentUntil = 0;
  let lastUrgentCheck = Number.NEGATIVE_INFINITY;

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
        idle = await allowedNow();
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

  /** Ist ein Neulade-Tor gesetzt (B-19b), entscheidet es; sonst die Leerlauf-Prüfung wie bisher. */
  const allowedNow = async (): Promise<boolean> => {
    const gate = getReloadGate();
    if (gate !== null) {
      return gate.allowsReload();
    }
    return options.isIdle();
  };

  /**
   * Erneute Leerlauf-Pruefung (wiederholbar). Das Neuladen selbst wird
   * hoechstens einmal ausgeloest (`hasFiredReload`), die Pruefung beliebig oft.
   */
  const onMaybeIdle = async (): Promise<void> => {
    if (!updateWaiting || hasScheduledReload || hasFiredReload) {
      return;
    }
    let idle: boolean;
    try {
      idle = await allowedNow();
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
    // Auf Kiosk-Routen (Tor gesetzt) gibt es keinen Toast (B-19a/b).
    if (getReloadGate() === null) {
      try {
        options.showToast(options.updatingMessage());
      } catch (err) {
        // Toast surface must never block the reload
        if (err instanceof Error) {
          captureFeatureError(err, 'sw', 'showToast');
        }
      }
    }
    scheduleReload(fireReload, delay);
  };

  /** Eilpfad (B-19b, @ME-032): sofort neu laden, einmal. */
  const fireUrgent = (): void => {
    if (hasFiredReload) {
      return;
    }
    hasFiredReload = true;
    idleCleanup?.();
    updateSWAndReload();
  };

  /** Das Tor erfährt, dass eine neue Version wartet (einmal je Version). */
  const notifyGateWaiting = (): void => {
    try {
      getReloadGate()?.onUpdateWaiting?.();
    } catch (err) {
      // Ein Tor darf das Neuladen nicht blockieren (Regel 5).
      if (err instanceof Error) {
        captureFeatureError(err, 'sw', 'reloadGate');
      }
    }
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
    let dialogWasOpen = options.hasOpenModalDialog();
    const observer = new MutationObserver(() => {
      if (debounceTimer !== undefined) {
        return;
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        const open = options.hasOpenModalDialog();
        const closedNow = dialogWasOpen && !open;
        dialogWasOpen = open;
        if (closedNow) {
          void onMaybeIdle();
        }
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

  /** Unlesbare Antwort (B-19b, @ME-032): sofort neu laden, sobald eine neue Version da ist. */
  const reloadNow = (): void => {
    const now = Date.now();
    urgentUntil = now + URGENT_RELOAD_WINDOW_MS;
    if (updateWaiting) {
      fireUrgent();
      return;
    }
    if (knownRegistration !== undefined && now - lastUrgentCheck >= URGENT_CHECK_MS) {
      lastUrgentCheck = now;
      void safeUpdate(knownRegistration);
    }
  };

  /** Ein Tor wurde gesetzt oder gelöst: Zustand neu bewerten. */
  const onGateChanged = (): void => {
    if (updateWaiting) {
      notifyGateWaiting();
    }
    void onMaybeIdle();
  };

  const updateSW = options.registerSW({
    immediate: true,
    onNeedRefresh: () => {
      const wasWaiting = updateWaiting;
      updateWaiting = true;
      if (!wasWaiting) {
        notifyGateWaiting();
      }
      // Hinweis bleibt stehen (kein Auto-Ausblenden); sein Knopf feuert sofort. Auf Kiosk-Routen
      // (Tor gesetzt) gibt es keinen Hinweis und keinen Knopf (B-19a/b).
      if (getReloadGate() === null) {
        try {
          options.showUpdateNotice(fireUpdateNow);
        } catch (err) {
          if (err instanceof Error) {
            captureFeatureError(err, 'sw', 'showUpdateNotice');
          }
        }
      }
      startIdleWatchers();
      if (Date.now() < urgentUntil) {
        fireUrgent();
        return;
      }
      void onMaybeIdle();
    },
    onRegisterError: (error) => {
      if (error instanceof Error) {
        captureFeatureError(error, 'sw', 'register');
      }
    },
    onRegisteredSW: (_swUrl, registration) => {
      if (registration) {
        knownRegistration = registration;
        installUpdatePolling(registration);
      }
    },
  });

  const handle: SwAutoReloadHandle = {
    updateSW,
    onMaybeIdle,
    dispose: () => {
      idleCleanup?.();
      pollCleanup?.();
    },
    onGateChanged,
    reloadNow,
  };
  registerSwSetup({ handle, options });
  return handle;
}

/** Setzt (oder löst mit `null`) das Neulade-Tor und bewertet den Zustand neu (B-19b, @ZM-124, @ME-012). */
export function attachReloadGate(gate: ReloadGate | null): void {
  setReloadGateSlot(gate);
  getSwSetup()?.handle.onGateChanged();
}

/** Bewertet das Tor neu, z. B. nach einem Folienwechsel. Ohne wartende Version geschieht nichts. */
export function notifyReloadGate(): void {
  void getSwSetup()?.handle.onMaybeIdle();
}

/** Unlesbare Antwort (B-19b, @ME-032): sofort neu laden, sobald eine neue Version wartet. */
export function requestUrgentReload(): void {
  getSwSetup()?.handle.reloadNow();
}
