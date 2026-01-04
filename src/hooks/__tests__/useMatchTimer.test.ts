/**
 * Unit Tests für useMatchTimer Hook
 *
 * Testet:
 * - Timer berechnet korrekt basierend auf Timestamp
 * - Timer pausiert korrekt
 * - Timer zeigt baseElapsedSeconds bei PAUSED/FINISHED
 * - Keine Timer-Drift nach längerer Inaktivität
 *
 * @see MATCHCARD-TESTPLAN-PROMPT.md Tests #43-46
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchTimer } from '../useMatchTimer';

describe('useMatchTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Status: NOT_STARTED', () => {
    it('returns baseElapsedSeconds when status is NOT_STARTED', () => {
      const { result } = renderHook(() =>
        useMatchTimer(null, 0, 'NOT_STARTED')
      );

      expect(result.current).toBe(0);
    });

    it('returns baseElapsedSeconds even when timerStartTime is set', () => {
      const startTime = new Date().toISOString();
      const { result } = renderHook(() =>
        useMatchTimer(startTime, 120, 'NOT_STARTED')
      );

      expect(result.current).toBe(120);
    });
  });

  describe('Status: PAUSED', () => {
    it('returns baseElapsedSeconds when status is PAUSED', () => {
      const { result } = renderHook(() =>
        useMatchTimer(null, 300, 'PAUSED')
      );

      expect(result.current).toBe(300);
    });

    it('does not update time while paused', () => {
      const startTime = new Date().toISOString();
      const { result } = renderHook(() =>
        useMatchTimer(startTime, 300, 'PAUSED')
      );

      expect(result.current).toBe(300);

      // Advance time by 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should still be 300
      expect(result.current).toBe(300);
    });
  });

  describe('Status: FINISHED', () => {
    it('returns baseElapsedSeconds when status is FINISHED', () => {
      const { result } = renderHook(() =>
        useMatchTimer(null, 600, 'FINISHED')
      );

      expect(result.current).toBe(600);
    });
  });

  describe('Status: RUNNING', () => {
    it('calculates elapsed time from timerStartTime', () => {
      // Set current time to a known value
      const now = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(now);

      // Timer started 5 seconds ago
      const startTime = new Date('2025-01-04T09:59:55Z').toISOString();

      const { result } = renderHook(() =>
        useMatchTimer(startTime, 0, 'RUNNING')
      );

      // Trigger RAF update
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should show ~5 seconds elapsed
      expect(result.current).toBeGreaterThanOrEqual(5);
    });

    it('adds baseElapsedSeconds to runtime', () => {
      // Set current time
      const now = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(now);

      // Timer started 10 seconds ago with 120 seconds already elapsed
      const startTime = new Date('2025-01-04T09:59:50Z').toISOString();

      const { result } = renderHook(() =>
        useMatchTimer(startTime, 120, 'RUNNING')
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should be 120 base + ~10 runtime = ~130
      expect(result.current).toBeGreaterThanOrEqual(130);
    });

    it('updates every second during running', () => {
      const now = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(now);

      const startTime = now.toISOString();

      const { result } = renderHook(() =>
        useMatchTimer(startTime, 0, 'RUNNING')
      );

      // Initially 0
      expect(result.current).toBe(0);

      // Advance 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Allow 1 second tolerance due to RAF timing
      expect(result.current).toBeGreaterThanOrEqual(2);

      // Advance 2 more seconds
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Total should be around 5 seconds (with tolerance)
      expect(result.current).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Status transitions', () => {
    type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

    it('pauses timer when status changes to PAUSED', () => {
      const now = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(now);

      const startTime = now.toISOString();

      type Props = { status: MatchStatus; base: number };
      const { result, rerender } = renderHook<number, Props>(
        ({ status, base }) => useMatchTimer(startTime, base, status),
        { initialProps: { status: 'RUNNING', base: 0 } }
      );

      // Run for 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const timeBeforePause = result.current;
      // Allow some tolerance for RAF timing
      expect(timeBeforePause).toBeGreaterThanOrEqual(4);

      // Pause with the current elapsed time saved
      rerender({ status: 'PAUSED', base: timeBeforePause });

      // Advance 10 more seconds while paused
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Time should not have changed
      expect(result.current).toBe(timeBeforePause);
    });

    it('resumes timer when status changes to RUNNING', () => {
      const now = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(now);

      type Props = { status: MatchStatus; startTime: string | null; base: number };
      const { result, rerender } = renderHook<number, Props>(
        ({ status, startTime, base }) => useMatchTimer(startTime, base, status),
        { initialProps: { status: 'PAUSED', startTime: null, base: 120 } }
      );

      expect(result.current).toBe(120);

      // Resume - update startTime to now, keep baseElapsedSeconds
      const newStartTime = new Date('2025-01-04T10:00:00Z').toISOString();
      rerender({ status: 'RUNNING', startTime: newStartTime, base: 120 });

      // Advance 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should be 120 + ~5 = ~125 (with tolerance for RAF timing)
      expect(result.current).toBeGreaterThanOrEqual(124);
    });
  });

  describe('Timer precision (no drift)', () => {
    it('calculates time from timestamp, not increments (prevents drift)', () => {
      const now = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(now);

      const startTime = now.toISOString();

      const { result } = renderHook(() =>
        useMatchTimer(startTime, 0, 'RUNNING')
      );

      // Simulate a long gap (e.g., tab was inactive for 5 minutes)
      act(() => {
        // Jump forward 5 minutes
        vi.setSystemTime(new Date('2025-01-04T10:05:00Z'));
        vi.advanceTimersByTime(1000); // Trigger RAF
      });

      // Timer should show ~5 minutes (300 seconds), with ±1 second tolerance for timing edge cases
      expect(result.current).toBeGreaterThanOrEqual(300);
      expect(result.current).toBeLessThanOrEqual(301);
    });

    it('maintains accuracy after multiple pause/resume cycles', () => {
      type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';
      type Props = { status: MatchStatus; startTime: string | null; base: number };

      let currentTime = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(currentTime);

      const { result, rerender } = renderHook<number, Props>(
        ({ status, startTime, base }) => useMatchTimer(startTime, base, status),
        { initialProps: { status: 'RUNNING', startTime: currentTime.toISOString(), base: 0 } }
      );

      // Run for 30 seconds
      currentTime = new Date('2025-01-04T10:00:30Z');
      vi.setSystemTime(currentTime);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      // Allow ±1 second tolerance for timing edge cases
      expect(result.current).toBeGreaterThanOrEqual(30);
      expect(result.current).toBeLessThanOrEqual(31);

      // Pause
      rerender({ status: 'PAUSED', startTime: null, base: 30 });

      // Wait 10 seconds while paused
      currentTime = new Date('2025-01-04T10:00:40Z');
      vi.setSystemTime(currentTime);
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(result.current).toBe(30); // Still 30 (paused - no tolerance needed)

      // Resume
      rerender({ status: 'RUNNING', startTime: currentTime.toISOString(), base: 30 });

      // Run for 20 more seconds
      currentTime = new Date('2025-01-04T10:01:00Z');
      vi.setSystemTime(currentTime);
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Total should be ~50 (30 + 20), with ±1 second tolerance
      expect(result.current).toBeGreaterThanOrEqual(50);
      expect(result.current).toBeLessThanOrEqual(51);
    });
  });

  describe('Edge cases', () => {
    it('handles null timerStartTime gracefully', () => {
      const { result } = renderHook(() =>
        useMatchTimer(null, 100, 'RUNNING')
      );

      // Should return baseElapsedSeconds when timerStartTime is null
      expect(result.current).toBe(100);
    });

    it('handles undefined timerStartTime gracefully', () => {
      const { result } = renderHook(() =>
        useMatchTimer(undefined, 50, 'RUNNING')
      );

      expect(result.current).toBe(50);
    });

    it('handles very large elapsed times', () => {
      const now = new Date('2025-01-04T10:00:00Z');
      vi.setSystemTime(now);

      // 90 minutes already elapsed (overtime scenario)
      const startTime = now.toISOString();

      const { result } = renderHook(() =>
        useMatchTimer(startTime, 90 * 60, 'RUNNING')
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should be 5400 + ~1 = 5401
      expect(result.current).toBeGreaterThanOrEqual(5400);
    });
  });
});

describe('formatMatchTime helper (if exists)', () => {
  // Test placeholder for formatMatchTime utility
  // The actual implementation may be in a different file

  it.skip('formats overtime correctly after 90 minutes', () => {
    // Example: 90:30 should display as "90+1" or similar
    // This is a placeholder for when the formatting utility is available
  });

  it.skip('pads minutes and seconds with zeros', () => {
    // Example: 5:3 should display as "05:03"
  });
});
