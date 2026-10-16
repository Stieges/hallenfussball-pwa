/**
 * Options-Slots und Setup-Singleton des SW-Update-Flow (C3b-2 F2, M5).
 *
 * Genau eine Service-Worker-Registrierung je Seitenladung — auch bei
 * StrictMode-Doppelaufruf, Re-Mount und HMR. Folgeaufrufe tauschen nur die
 * zur Laufzeit wechselnden Slots (Text/Toast/Hinweis) und liefern dasselbe
 * Handle; `registerSW` laeuft nie ein zweites Mal.
 */

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
  /** Called with the localized "updating…" message before the idle reload. */
  showToast: (message: string) => void;
  /** Localized message factory for the pre-reload toast (read at toast time). */
  updatingMessage: () => string;
  /** Idle check (dialog + outbox), see `swIdle.isIdle` — injected for tests. */
  isIdle: () => Promise<boolean>;
  /** Observer input: true while a modal dialog is open (open→closed transition). */
  hasOpenModalDialog: () => boolean;
  /**
   * Shows the persistent update notice; the callback reloads immediately.
   * Must be called at most once per waiting update (Regel 5: a throw must not
   * block the flow).
   */
  showUpdateNotice: (updateNow: () => void) => void;
  /** Test seam — defaults to window.location.reload(). */
  reload?: () => void;
  /** Test seam — defaults to global setTimeout. */
  scheduleReload?: (cb: () => void, delayMs: number) => void;
  /** Delay between toast and idle reload so users see why the page reloads. */
  delayBeforeReloadMs?: number;
}

export interface SwAutoReloadHandle {
  /** vite-plugin-pwa's `updateSW` (manual update paths, e.g. the notice button). */
  updateSW: (reloadPage?: boolean) => Promise<void>;
  /** Stable idle check for external triggers (e.g. outbox status events). */
  onMaybeIdle: () => Promise<void>;
  /** Removes listeners, intervals and the dialog observer (hook cleanup). */
  dispose: () => void;
}

/** Ersetzbare Options-Slots: werden bei Folgeaufrufen getauscht. */
export type SwOptionSlots = Pick<
  SetupOptions,
  'updatingMessage' | 'showToast' | 'showUpdateNotice'
>;

export interface SwSetupInstance {
  handle: SwAutoReloadHandle;
  options: SetupOptions;
}

let instance: SwSetupInstance | undefined;

export function getSwSetup(): SwSetupInstance | undefined {
  return instance;
}

export function registerSwSetup(next: SwSetupInstance): void {
  instance = next;
}

export function replaceSwSetupSlots(slots: SwOptionSlots): void {
  if (instance === undefined) {
    return;
  }
  instance.options.updatingMessage = slots.updatingMessage;
  instance.options.showToast = slots.showToast;
  instance.options.showUpdateNotice = slots.showUpdateNotice;
}

/** Nur fuer Tests: Handle raeumen und Singleton loeschen. */
export function __resetSwForTests(): void {
  instance?.handle.dispose();
  instance = undefined;
}
