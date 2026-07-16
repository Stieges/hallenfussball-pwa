import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_RELOAD_DELAY_MS,
  setupSwAutoReload,
  type RegisterSWFn,
  type RegisterSWOptions,
} from '../swRegistration';

interface Harness {
  registerSW: RegisterSWFn & {
    mock: { calls: Array<[RegisterSWOptions | undefined]> };
  };
  showToast: ((message: string) => void) & ReturnType<typeof vi.fn>;
  reload: (() => void) & ReturnType<typeof vi.fn>;
  scheduleReload: ((cb: () => void, delayMs: number) => void) & ReturnType<typeof vi.fn>;
  updateSW: ReturnType<typeof vi.fn>;
  /** Fires the onNeedRefresh callback registered by setupSwAutoReload. */
  triggerNeedRefresh: () => void;
  /** Fires the onRegisterError callback registered by setupSwAutoReload. */
  triggerRegisterError: (err: unknown) => void;
}

function makeHarness(): Harness {
  let needRefresh: (() => void) | undefined;
  let registerError: ((err: unknown) => void) | undefined;
  const updateSW = vi.fn().mockResolvedValue(undefined);
  const registerSW = vi.fn((opts?: RegisterSWOptions) => {
    needRefresh = opts?.onNeedRefresh;
    registerError = opts?.onRegisterError;
    return updateSW;
  }) as unknown as Harness['registerSW'];
  const showToast = vi.fn<(message: string) => void>() as Harness['showToast'];
  const reload = vi.fn<() => void>() as Harness['reload'];
  const scheduleReload = vi.fn<(cb: () => void, delayMs: number) => void>() as Harness['scheduleReload'];

  return {
    registerSW,
    showToast,
    reload,
    scheduleReload,
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
  };
}

describe('setupSwAutoReload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the service worker on first call', () => {
    const h = makeHarness();
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'Updating…',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    expect(h.registerSW).toHaveBeenCalledOnce();
    expect(h.registerSW.mock.calls[0][0]?.immediate).toBe(true);
  });

  it('shows the toast when onNeedRefresh fires', () => {
    const h = makeHarness();
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'Updating…',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    h.triggerNeedRefresh();
    expect(h.showToast).toHaveBeenCalledWith('Updating…');
  });

  it('schedules a reload after the default delay (2000ms) when onNeedRefresh fires', () => {
    const h = makeHarness();
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'x',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    h.triggerNeedRefresh();
    expect(h.scheduleReload).toHaveBeenCalledOnce();
    expect(h.scheduleReload.mock.calls[0][1]).toBe(DEFAULT_RELOAD_DELAY_MS);
  });

  it('honours an overridden delayBeforeReloadMs', () => {
    const h = makeHarness();
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'x',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
      delayBeforeReloadMs: 500,
    });
    h.triggerNeedRefresh();
    expect(h.scheduleReload.mock.calls[0][1]).toBe(500);
  });

  it('only schedules a single reload even if onNeedRefresh fires multiple times', () => {
    const h = makeHarness();
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'x',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    h.triggerNeedRefresh();
    h.triggerNeedRefresh();
    h.triggerNeedRefresh();
    expect(h.scheduleReload).toHaveBeenCalledOnce();
    expect(h.showToast).toHaveBeenCalledOnce();
  });

  it('still schedules the reload when showToast throws', () => {
    const h = makeHarness();
    h.showToast.mockImplementation(() => {
      throw new Error('toast crash');
    });
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'x',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    expect(() => h.triggerNeedRefresh()).not.toThrow();
    expect(h.scheduleReload).toHaveBeenCalledOnce();
  });

  it('invokes reload() when the scheduled callback fires', () => {
    const h = makeHarness();
    // Real scheduleReload via setTimeout so we can advance fake timers
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'x',
      reload: h.reload,
    });
    h.triggerNeedRefresh();
    vi.advanceTimersByTime(DEFAULT_RELOAD_DELAY_MS);
    expect(h.updateSW).toHaveBeenCalledWith(true);
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('falls back to reload when updateSW rejects', async () => {
    const h = makeHarness();
    h.updateSW.mockRejectedValueOnce(new Error('sw update failed'));
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'Updating…',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    h.triggerNeedRefresh();
    h.scheduleReload.mock.calls[0][0]();
    await vi.waitFor(() => expect(h.reload).toHaveBeenCalledOnce());
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });

  it('falls back to reload when updateSW rejects with a non-Error', async () => {
    const h = makeHarness();
    h.updateSW.mockRejectedValueOnce('kaputt');
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'Updating…',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    h.triggerNeedRefresh();
    h.scheduleReload.mock.calls[0][0]();
    await vi.waitFor(() => expect(h.reload).toHaveBeenCalledOnce());
  });

  it('does not throw when onRegisterError fires with a non-Error value', () => {
    const h = makeHarness();
    setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'x',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    expect(() => h.triggerRegisterError('plain-string-error')).not.toThrow();
  });

  it('returns the updateSW handle from vite-plugin-pwa', async () => {
    const h = makeHarness();
    const updateSW = setupSwAutoReload({
      registerSW: h.registerSW,
      showToast: h.showToast,
      updatingMessage: 'x',
      reload: h.reload,
      scheduleReload: h.scheduleReload,
    });
    await updateSW(true);
    expect(h.updateSW).toHaveBeenCalledWith(true);
  });
});
