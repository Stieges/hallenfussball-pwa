/**
 * useAuthTimeoutToast - Shows toast when auth initialization timed out
 *
 * QW-002: Toast bei Auth-Timeout
 *
 * Problem: AuthContext cannot use useToast() directly (rendered before ToastProvider).
 * Solution: AuthContext sets a sessionStorage flag, this hook reads it and shows the toast.
 *
 * The flag is stored in sessionStorage (not localStorage) so it's cleared on browser close
 * and doesn't persist across sessions.
 */

import { useEffect } from 'react';
import { useToast } from '../components/ui/Toast/ToastContext';
import { safeSessionStorage } from '../core/utils/safeStorage';

/**
 * Hook to display a warning toast when auth initialization has timed out.
 * Should be called in App.tsx or a top-level component that renders after ToastProvider.
 */
export function useAuthTimeoutToast(): void {
  const { showWarning } = useToast();

  useEffect(() => {
    const flag = safeSessionStorage.getItem('auth:timeoutFlag');
    if (flag) {
      // Remove flag immediately to prevent showing toast on refresh
      safeSessionStorage.removeItem('auth:timeoutFlag');

      // Show warning toast
      showWarning(
        'Verbindung zum Server konnte nicht hergestellt werden. Du arbeitest offline.',
        { duration: 6000 }
      );
    }
  }, [showWarning]);
}
