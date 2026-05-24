/**
 * Behaviour-level tests for the LoginScreen ↔ useBrowserOnlineStatus
 * integration. We test the hook in isolation through a thin probe wrapper
 * (the hook is fully exported from src/features/auth/hooks/useBrowserOnlineStatus)
 * rather than mounting the entire LoginScreen — those broader UI flows live
 * in the existing LoginScreen.test.tsx and don't need re-litigating here.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBrowserOnlineStatus } from '../../hooks/useBrowserOnlineStatus';

const onLineDescriptor = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(navigator) as object,
  'onLine',
);

function setOnLine(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

afterEach(() => {
  if (onLineDescriptor) {
    Object.defineProperty(navigator, 'onLine', onLineDescriptor);
  }
});

describe('useBrowserOnlineStatus', () => {
  beforeEach(() => {
    setOnLine(true);
  });

  it('returns true when navigator.onLine === true and skips the probe', async () => {
    const probe = vi.fn().mockResolvedValue('online' as const);
    const { result } = renderHook(() => useBrowserOnlineStatus({ probe }));
    expect(result.current).toBe(true);
    // Give microtasks a chance to flush — probe must NOT run on the happy path
    await Promise.resolve();
    expect(probe).not.toHaveBeenCalled();
  });

  it('flips browserOnline=true when navigator.onLine is false but the probe succeeds', async () => {
    setOnLine(false);
    const probe = vi.fn().mockResolvedValue('online' as const);
    const { result } = renderHook(() => useBrowserOnlineStatus({ probe }));
    expect(result.current).toBe(false);
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(probe).toHaveBeenCalledOnce();
  });

  it('keeps browserOnline=false when navigator.onLine is false and the probe fails', async () => {
    setOnLine(false);
    const probe = vi.fn().mockResolvedValue('offline' as const);
    const { result } = renderHook(() => useBrowserOnlineStatus({ probe }));
    expect(result.current).toBe(false);
    // wait long enough that the probe promise resolves
    await new Promise((r) => setTimeout(r, 0));
    expect(probe).toHaveBeenCalledOnce();
    expect(result.current).toBe(false);
  });

  it('keeps browserOnline=false when the probe outcome is "unknown" (no Supabase URL configured)', async () => {
    setOnLine(false);
    const probe = vi.fn().mockResolvedValue('unknown' as const);
    const { result } = renderHook(() => useBrowserOnlineStatus({ probe }));
    expect(result.current).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(probe).toHaveBeenCalledOnce();
    expect(result.current).toBe(false);
  });

  it('does not act on a late probe response after unmount', async () => {
    setOnLine(false);
    let resolveProbe: ((v: 'online') => void) | undefined;
    const probe = vi.fn(
      () =>
        new Promise<'online'>((resolve) => {
          resolveProbe = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useBrowserOnlineStatus({ probe }));
    expect(result.current).toBe(false);

    unmount();
    // Late probe resolution must not throw or trigger React warnings
    resolveProbe?.('online');
    await new Promise((r) => setTimeout(r, 0));
    // Nothing to assert beyond "no error". renderHook's last result snapshot
    // stays at the pre-unmount value.
    expect(result.current).toBe(false);
  });

  it('reacts to the window "offline" event after mount', async () => {
    const probe = vi.fn();
    const { result } = renderHook(() => useBrowserOnlineStatus({ probe }));
    expect(result.current).toBe(true);

    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
