/**
 * useToast - Toast Notification Hook
 *
 * Manages toast notifications for the LiveCockpit.
 * Provides methods to show success, error, info, and warning toasts.
 */

import { useState, useCallback } from 'react';
import type { ToastData, ToastType } from '../components/Toast';

interface UseToastReturn {
  toasts: ToastData[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showUndoToast: (message: string, onUndo: () => void) => void;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

let toastId = 0;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 3000) => {
      const id = `toast-${++toastId}`;
      const newToast: ToastData = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, duration = 3000) => {
      showToast(message, 'success', duration);
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration = 5000) => {
      showToast(message, 'error', duration);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration = 3000) => {
      showToast(message, 'info', duration);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration = 4000) => {
      showToast(message, 'warning', duration);
    },
    [showToast]
  );

  const showUndoToast = useCallback(
    (message: string, onUndo: () => void) => {
      const id = `toast-${++toastId}`;
      const newToast: ToastData = {
        id,
        message,
        type: 'info',
        duration: 5000,
        action: {
          label: 'Rückgängig',
          onClick: () => {
            onUndo();
            dismissToast(id);
          },
        },
      };
      setToasts((prev) => [...prev, newToast]);
    },
    [dismissToast]
  );

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showUndoToast,
    dismissToast,
    clearAll,
  };
}

export default useToast;
