/**
 * useOnlineStatus - Hook for detecting online/offline status
 *
 * US-PWA-OFFLINE: Phase 2 - Offline-UX
 *
 * Features:
 * - Tracks navigator.onLine status
 * - Detects reconnection events
 * - Provides wasOffline flag for "Reconnected" feedback
 */

import { useState, useEffect } from 'react';

export interface OnlineStatus {
  /** Current online status */
  isOnline: boolean;
  /** True if we just reconnected (for showing "Reconnected" message) */
  wasOffline: boolean;
}

/**
 * Hook to track online/offline status with reconnection detection
 *
 * @example
 * ```tsx
 * const { isOnline, wasOffline } = useOnlineStatus();
 *
 * if (!isOnline) {
 *   return <div>You are offline</div>;
 * }
 *
 * if (wasOffline) {
 *   return <div>Connection restored!</div>;
 * }
 * ```
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);

      // Reset wasOffline after showing "Reconnected" message
      const timeout = setTimeout(() => setWasOffline(false), 3000);

      return () => clearTimeout(timeout);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}

/**
 * Simple hook that just returns boolean online status
 */
export function useIsOnline(): boolean {
  const { isOnline } = useOnlineStatus();
  return isOnline;
}
