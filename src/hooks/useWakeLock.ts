/**
 * useWakeLock Hook
 *
 * Manages Screen Wake Lock API to prevent screen from dimming during matches.
 * Automatically re-acquires lock on visibility change.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.5
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Return type for useWakeLock
 */
export interface UseWakeLockReturn {
  /** Whether wake lock is currently active */
  isLocked: boolean;
  /** Whether the browser supports Wake Lock API */
  isSupported: boolean;
  /** Request wake lock */
  request: () => Promise<void>;
  /** Release wake lock */
  release: () => Promise<void>;
  /** Error message if wake lock failed */
  error: string | null;
}

/**
 * Hook for managing screen wake lock
 *
 * @param enabled - Whether wake lock should be active
 */
export function useWakeLock(enabled: boolean): UseWakeLockReturn {
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const releaseHandlerRef = useRef<(() => void) | null>(null);

  // Check if Wake Lock API is supported
  const isSupported = 'wakeLock' in navigator;

  // Clean up event listener helper
  const cleanupEventListener = useCallback(() => {
    if (wakeLockRef.current && releaseHandlerRef.current) {
      wakeLockRef.current.removeEventListener('release', releaseHandlerRef.current);
      releaseHandlerRef.current = null;
    }
  }, []);

  // Request wake lock
  const request = useCallback(async () => {
    if (!isSupported) {
      setError('Wake Lock API nicht unterstützt');
      return;
    }

    try {
      // Clean up any existing listener before requesting new lock
      cleanupEventListener();

      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsLocked(true);
      setError(null);

      // Listen for release event (e.g., when tab becomes hidden)
      releaseHandlerRef.current = () => {
        setIsLocked(false);
      };
      wakeLockRef.current.addEventListener('release', releaseHandlerRef.current);
    } catch (err) {
      console.error('[useWakeLock] Failed to acquire wake lock:', err);
      setError('Wake Lock konnte nicht aktiviert werden');
      setIsLocked(false);
    }
  }, [isSupported, cleanupEventListener]);

  // Release wake lock
  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        cleanupEventListener();
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsLocked(false);
      } catch (err) {
        console.error('[useWakeLock] Failed to release wake lock:', err);
      }
    }
  }, [cleanupEventListener]);

  // Auto-acquire/release based on enabled prop
  useEffect(() => {
    if (enabled && !isLocked) {
      void request();
    } else if (!enabled && isLocked) {
      void release();
    }
  }, [enabled, isLocked, request, release]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    if (!enabled || !isSupported) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, isSupported, request]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up event listener first
      if (wakeLockRef.current && releaseHandlerRef.current) {
        wakeLockRef.current.removeEventListener('release', releaseHandlerRef.current);
      }
      // Then release the wake lock
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
      }
    };
  }, []);

  return {
    isLocked,
    isSupported,
    request,
    release,
    error,
  };
}
