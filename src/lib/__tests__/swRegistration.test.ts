/**
 * Task C3b-2d (G8): SW-Update-Flow – persistenter Hinweis, Sofort-Knopf,
 * automatisches Neuladen NUR im Leerlauf, periodisches `registration.update()`.
 *
 * Bestandstests (Toast, Delay, Einmal-Sperre, Fallback) bleiben erhalten und
 * bekommen `isIdle` injiziert; die neuen Faelle pruefen Wiederholbarkeit der
 * Leerlauf-Pruefung, die Fehlerregeln 1–5 und die Ausloeser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureFeatureError } from '../sentry';
import {
  IDLE_RECHECK_MS,
  OBSERVER_DEBOUNCE_MS,
  UPDATE_POLL_MS,
  hasOpenModalDialog,
  isIdle as isIdleReal,
} from '../swIdle';
import {
  DEFAULT_RELOAD_DELAY_MS,
  setupSwAutoReload,
  type RegisterSWFn,
  type RegisterSWOptions,
  type SetupOptions,
  type SwAutoReloadHandle,
} from '../swRegistration';

vi.mock('../sentry', () => ({
  addBreadcrumb: vi.fn(),
  captureFeatureError: vi.fn(),
}));

interface Harness {
  registerSW: RegisterSWFn & {
    mock: { calls: Array<[RegisterSWOptions | undefined]> };
  };
  showToast: ((message: string) => void) & ReturnType<typeof vi.fn>;
  showUpdateNotice: ((onUpdateNow: () => void) => void) & ReturnType<typeof vi.fn>;
  reload: (() => void) & ReturnType<typeof vi.fn>;
  scheduleReload: ((cb: () => void, delayMs: number) => void) & ReturnType<typeof vi.fn>;
  isIdle: (() => Promise<boolean>) & ReturnType<typeof vi.fn>;
  updateSW: ReturnType<typeof vi.fn>;
  triggerNeedRefresh: () => void;
  triggerRegisterError: (err: unknown) => void;
  triggerRegisteredSW: (registration: ServiceWorkerRegistration | undefined) => void;
  /** Vom showUpdateNotice-Aufruf uebergebener Knopf-Callback. */
  updateNow: () => void;
}

function makeHarness(isIdle?: () => Promise<boolean>): Harness {
  let needRefresh: (() => void) | undefined;
  let registerError: ((err: unknown) => void) | undefined;
  let registeredSW:
    | ((swUrl: string, registration: ServiceWorkerRegistration | undefined) => void)
    | undefined;
  const updateSW = vi.fn().mockResolvedValue(undefined);
  const registerSW = vi.fn((opts?: RegisterSWOptions) => {
    needRefresh = opts?.onNeedRefresh;
    registerError = opts?.onRegisterError;
    registeredSW = opts?.onRegisteredSW;
    return updateSW;
  }) as unknown as Harness['registerSW'];
  const showToast = vi.fn<(message: string) => void>() as Harness['showToast'];
  const showUpdateNotice = vi.fn<(onUpdateNow: () => void) => void>() as Harness['showUpdateNotice'];
  const reload = vi.fn<() => void>() as Harness['reload'];
  const scheduleReload = vi.fn<(cb: () => void, delayMs: number) => void>() as Harness['scheduleReload'];
  const idle = vi.fn(isIdle ?? (async () => true)) as Harness['isIdle'];

  return {
    registerSW,
    showToast,
    showUpdateNotice,
    reload,
    scheduleReload,
    isIdle: idle,
    updateSW,
    triggerNeedRefresh: () => {
      if (!needRefresh) {
        throw new Error('onNeedRefresh was never registered');
      }
      needRefresh();
    },
    triggerRegisterError: (err) => {
      if (!registerError) {
        throw new Error('onRegisterError was never registered');
      }
      registerError(err);
    },
    triggerRegisteredSW: (registration) => {
      if (!registeredSW) {
        throw new Error('onRegisteredSW was never registered');
      }
      registeredSW('sw.js', registration);
    },
    updateNow: () => {
      expect(showUpdateNotice).toHaveBeenCalled();
      showUpdateNotice.mock.calls[showUpdateNotice.mock.calls.length - 1][0]();
    },
  };
}

const handles: SwAutoReloadHandle[] = [];

function setup(h: Harness, overrides: Partial<SetupOptions> = {}): SwAutoReloadHandle {
  const handle = setupSwAutoReload({
    registerSW: h.registerSW,
    showToast: h.showToast,
    updatingMessage: 'Updating…',
    isIdle: h.isIdle,
    showUpdateNotice: h.showUpdateNotice,
    reload: h.reload,
    scheduleReload: h.scheduleReload,
    ...overrides,
  });
  handles.push(handle);
  return handle;
}

/** Fuer Faelle mit echtem `setTimeout` (Fake-Timer steuern die Verzoegerung). */
function setupWithRealSchedule(h: Harness): SwAutoReloadHandle {
  return setup(h, { scheduleReload: undefined });
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('setupSwAutoReload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    for (const handle of handles.splice(0)) {
      handle.dispose();
    }
    Reflect.deleteProperty(document, 'visibilityState');
    vi.useRealTimers();
  });

  it('registers the service worker on first call', () => {
    const h = makeHarness();
    setup(h);
    expect(h.registerSW).toHaveBeenCalledOnce();
    expect(h.registerSW.mock.calls[0][0]?.immediate).toBe(true);
  });

  it('shows the toast when onNeedRefresh fires', async () => {
    const h = makeHarness(async () => true);
    setup(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.showToast).toHaveBeenCalledWith('Updating…');
  });

  it('schedules a reload after the default delay (2000ms) when onNeedRefresh fires', async () => {
    const h = makeHarness(async () => true);
    setup(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.scheduleReload).toHaveBeenCalledOnce();
    expect(h.scheduleReload.mock.calls[0][1]).toBe(DEFAULT_RELOAD_DELAY_MS);
  });

  it('honours an overridden delayBeforeReloadMs', async () => {
    const h = makeHarness(async () => true);
    setup(h, { delayBeforeReloadMs: 500 });
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.scheduleReload.mock.calls[0][1]).toBe(500);
  });

  it('only schedules a single reload even if onNeedRefresh fires multiple times', async () => {
    const h = makeHarness(async () => true);
    setup(h);
    h.triggerNeedRefresh();
    h.triggerNeedRefresh();
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.scheduleReload).toHaveBeenCalledOnce();
    expect(h.showToast).toHaveBeenCalledOnce();
  });

  it('still schedules the reload when showToast throws', async () => {
    const h = makeHarness(async () => true);
    h.showToast.mockImplementation(() => {
      throw new Error('toast crash');
    });
    setup(h);
    expect(() => h.triggerNeedRefresh()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.scheduleReload).toHaveBeenCalledOnce();
  });

  it('invokes updateSW(true) instead of reload() when the scheduled callback fires', async () => {
    const h = makeHarness(async () => true);
    setupWithRealSchedule(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(DEFAULT_RELOAD_DELAY_MS);
    expect(h.updateSW).toHaveBeenCalledWith(true);
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('falls back to reload when updateSW rejects', async () => {
    const h = makeHarness(async () => true);
    h.updateSW.mockRejectedValueOnce(new Error('sw update failed'));
    setup(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    h.scheduleReload.mock.calls[0][0]();
    await vi.waitFor(() => expect(h.reload).toHaveBeenCalledOnce());
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });

  it('falls back to reload when updateSW rejects with a non-Error', async () => {
    const h = makeHarness(async () => true);
    h.updateSW.mockRejectedValueOnce('kaputt');
    setup(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    h.scheduleReload.mock.calls[0][0]();
    await vi.waitFor(() => expect(h.reload).toHaveBeenCalledOnce());
  });

  it('does not throw when onRegisterError fires with a non-Error value', () => {
    const h = makeHarness();
    setup(h);
    expect(() => h.triggerRegisterError('plain-string-error')).not.toThrow();
  });

  it('returns the updateSW handle from vite-plugin-pwa', async () => {
    const h = makeHarness();
    const handle = setup(h);
    await handle.updateSW(true);
    expect(h.updateSW).toHaveBeenCalledWith(true);
    expect(typeof handle.dispose).toBe('function');
  });

  it('zeigt den persisten Hinweis und laedt NICHT automatisch, solange nicht idle laeuft; idle → Toast + Delay + updateSW wie heute', async () => {
    const h = makeHarness(async () => false);
    setupWithRealSchedule(h);
    h.triggerNeedRefresh();
    vi.advanceTimersByTime(60_000);
    expect(h.showUpdateNotice).toHaveBeenCalled();
    expect(h.showToast).not.toHaveBeenCalled();
    expect(h.scheduleReload).not.toHaveBeenCalled();
    expect(h.updateSW).not.toHaveBeenCalled();

    h.isIdle.mockImplementation(async () => true);
    await vi.advanceTimersByTimeAsync(IDLE_RECHECK_MS + DEFAULT_RELOAD_DELAY_MS);
    expect(h.showToast).toHaveBeenCalledWith('Updating…');
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });

  it('Wurf aus showUpdateNotice blockiert das Neuladen nicht (Regel 5)', async () => {
    const h = makeHarness(async () => true);
    h.showUpdateNotice.mockImplementation(() => {
      throw new Error('notice crash');
    });
    setupWithRealSchedule(h);
    expect(() => h.triggerNeedRefresh()).not.toThrow();
    await vi.advanceTimersByTimeAsync(DEFAULT_RELOAD_DELAY_MS);
    expect(captureFeatureError).toHaveBeenCalledWith(expect.any(Error), 'sw', 'showUpdateNotice');
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });

  it('Neuladen hoechstens einmal, auch wenn mehrere Anlaesse gleichzeitig kommen', async () => {
    const h = makeHarness(async () => true);
    setupWithRealSchedule(h);
    h.triggerNeedRefresh();
    h.triggerNeedRefresh();
    window.dispatchEvent(new Event('online'));
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(DEFAULT_RELOAD_DELAY_MS);
    expect(h.updateSW).toHaveBeenCalledTimes(1);
    expect(h.updateSW).toHaveBeenCalledWith(true);

    h.updateNow();
    expect(h.updateSW).toHaveBeenCalledTimes(1);
  });

  it('Knopf „Jetzt aktualisieren“ laedt sofort neu, auch mit wartenden Eintraegen; der Ausgang wird dabei nicht angefasst', async () => {
    const countWaiting = vi.fn(async () => 3);
    const h = makeHarness(() =>
      isIdleReal({
        hasOpenModalDialog: () => hasOpenModalDialog(document),
        countWaiting,
        hasAccount: () => true,
      }),
    );
    setup(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(countWaiting).toHaveBeenCalledTimes(1);
    expect(h.updateSW).not.toHaveBeenCalled();

    const vorher = countWaiting.mock.calls.length;
    h.updateNow();
    expect(h.updateSW).toHaveBeenCalledTimes(1);
    expect(h.updateSW).toHaveBeenCalledWith(true);
    expect(h.reload).not.toHaveBeenCalled();
    expect(countWaiting.mock.calls.length).toBe(vorher);
    await vi.advanceTimersByTimeAsync(DEFAULT_RELOAD_DELAY_MS);
    expect(h.updateSW).toHaveBeenCalledTimes(1);
  });

  it('30-min-Intervall und visibilitychange (nur beim Sichtbarwerden) rufen update()', async () => {
    const h = makeHarness();
    setup(h);
    const update = vi.fn(async () => undefined);
    h.triggerRegisteredSW({ update } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    expect(update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    expect(update).toHaveBeenCalledTimes(2);

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(3);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(3);

    window.dispatchEvent(new Event('online'));
    expect(update).toHaveBeenCalledTimes(4);
  });

  it('update() offline wirft nicht und meldet nichts an Sentry (Regel 1)', async () => {
    const h = makeHarness();
    setup(h);
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error('netz weg'))
      .mockImplementationOnce(() => {
        throw new Error('sync geworfen');
      });
    h.triggerRegisteredSW({ update } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(UPDATE_POLL_MS);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(update).toHaveBeenCalledTimes(3);
    expect(captureFeatureError).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.updateSW).not.toHaveBeenCalled();
  });

  it('Ausgang nicht lesbar → kein Reload, erneute Pruefung spaeter (Regel 2)', async () => {
    const countWaiting = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('IndexedDB nicht lesbar'))
      .mockResolvedValue(0);
    const h = makeHarness(() =>
      isIdleReal({
        hasOpenModalDialog: () => hasOpenModalDialog(document),
        countWaiting,
        hasAccount: () => true,
      }),
    );
    setupWithRealSchedule(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.updateSW).not.toHaveBeenCalled();
    expect(countWaiting).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(IDLE_RECHECK_MS + DEFAULT_RELOAD_DELAY_MS);
    expect(countWaiting).toHaveBeenCalledTimes(2);
    expect(h.updateSW).toHaveBeenCalledTimes(1);
  });

  it('Ausgang wird leer → spaetestens nach 60 s Reload', async () => {
    let wartend = 1;
    const countWaiting = vi.fn(async () => wartend);
    const h = makeHarness(() =>
      isIdleReal({
        hasOpenModalDialog: () => hasOpenModalDialog(document),
        countWaiting,
        hasAccount: () => true,
      }),
    );
    setupWithRealSchedule(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.updateSW).not.toHaveBeenCalled();

    wartend = 0;
    await vi.advanceTimersByTimeAsync(IDLE_RECHECK_MS - 1);
    expect(h.updateSW).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1 + DEFAULT_RELOAD_DELAY_MS);
    expect(h.updateSW).toHaveBeenCalledTimes(1);
  });

  it('Dialog-Element entfernen → Pruefung → Reload; viele DOM-Aenderungen = eine Pruefung', async () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"><input /></div>';
    const hasOpen = vi.fn(() => hasOpenModalDialog(document));
    const countWaiting = vi.fn(async () => 0);
    const h = makeHarness(() =>
      isIdleReal({ hasOpenModalDialog: hasOpen, countWaiting, hasAccount: () => true }),
    );
    setupWithRealSchedule(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(OBSERVER_DEBOUNCE_MS);
    expect(h.updateSW).not.toHaveBeenCalled();
    expect(hasOpen).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i += 1) {
      const rand = document.createElement('div');
      rand.textContent = `zufall-${i}`;
      document.body.appendChild(rand);
      await Promise.resolve();
    }
    await vi.advanceTimersByTimeAsync(OBSERVER_DEBOUNCE_MS);
    expect(hasOpen).toHaveBeenCalledTimes(2);

    const dialog = document.querySelector('[role="dialog"]');
    dialog?.remove();
    await vi.advanceTimersByTimeAsync(OBSERVER_DEBOUNCE_MS + DEFAULT_RELOAD_DELAY_MS);
    expect(h.updateSW).toHaveBeenCalledTimes(1);
  });

  it('Observer ist nach dem Raeumen getrennt', async () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    const hasOpen = vi.fn(() => hasOpenModalDialog(document));
    const countWaiting = vi.fn(async () => 0);
    const h = makeHarness(() =>
      isIdleReal({ hasOpenModalDialog: hasOpen, countWaiting, hasAccount: () => true }),
    );
    const handle = setupWithRealSchedule(h);
    h.triggerNeedRefresh();
    await vi.advanceTimersByTimeAsync(OBSERVER_DEBOUNCE_MS);
    const pruefungen = hasOpen.mock.calls.length;

    handle.dispose();
    document.body.innerHTML = '<main>ohne Dialog</main>';
    await vi.advanceTimersByTimeAsync(
      OBSERVER_DEBOUNCE_MS + IDLE_RECHECK_MS + DEFAULT_RELOAD_DELAY_MS,
    );
    expect(hasOpen).toHaveBeenCalledTimes(pruefungen);
    expect(h.updateSW).not.toHaveBeenCalled();
    expect(h.reload).not.toHaveBeenCalled();
  });
});
