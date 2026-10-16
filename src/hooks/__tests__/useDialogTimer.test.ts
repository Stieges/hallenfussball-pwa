/**
 * useDialogTimer (C3a-2a Fixrunde 1, C1): `onExpire` darf beim Ablauf des Countdowns NUR EINMAL
 * aufgerufen werden. Der vorige Code rief `onExpire` INNERHALB der funktionalen `setState`-
 * Updater-Form auf (`setRemainingSeconds((prev) => { ...; onExpire(); return 0; })`) -- React
 * ruft diese Updater-Funktion unter `StrictMode` (DEV) zweimal auf, um Unreinheit zu erkennen
 * (https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-double-rendering-in-development).
 * Der Seiteneffekt (`onExpire`) lief dadurch zweimal -- im GoalScorerDialog fuehrte das zu einem
 * doppelt gezaehlten Tor beim Auto-Dismiss (E2E "GoalScorerDialog auto-dismisses after timeout").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useDialogTimer } from '../useDialogTimer';

describe('useDialogTimer (C3a-2a Fixrunde 1, C1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ruft onExpire GENAU EINMAL auf, auch unter StrictMode (Updater-Funktion darf keinen Seiteneffekt haben)', () => {
    const onExpire = vi.fn();
    renderHook(() => useDialogTimer({ durationSeconds: 2, onExpire, autoStart: true }), {
      wrapper: StrictMode,
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('zaehlt normal herunter und stoppt bei 0 (kein negativer Wert, kein weiterer Tick)', () => {
    // `autoStart` bleibt hier bewusst `false` (kein Dauer-Wiederanlauf-Szenario, s. GoalScorerDialog:
    // dort haengt `autoStart` an `isOpen`, das beim Ablauf ueber `onClose()` selbst auf `false`
    // faellt) -- der Test startet explizit per `start()`, wie ein imperativer Aufrufer es taete.
    const onExpire = vi.fn();
    const { result } = renderHook(() => useDialogTimer({ durationSeconds: 2, onExpire }), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
