/**
 * ToastContext
 *
 * React Context for toast notifications.
 * Provides methods to show/dismiss toasts from anywhere in the app.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastContainer } from './ToastContainer';
import { ToastType, ToastProps } from './Toast';

export interface ToastOptions {
  /** Auto-dismiss duration in ms (default: 4000, 0 = no auto-dismiss) */
  duration?: number;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  showSuccess: (message: string, options?: ToastOptions) => string;
  showError: (message: string, options?: ToastOptions) => string;
  showWarning: (message: string, options?: ToastOptions) => string;
  showInfo: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastData = Omit<ToastProps, 'onDismiss'>

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: ToastType, message: string, options?: ToastOptions): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const toast: ToastData = {
      id,
      type,
      message,
      duration: options?.duration ?? 4000,
      action: options?.action,
    };

    setToasts((prev) => [...prev, toast]);

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const showSuccess = useCallback(
    (message: string, options?: ToastOptions) => addToast('success', message, options),
    [addToast]
  );

  const showError = useCallback(
    (message: string, options?: ToastOptions) => addToast('error', message, { duration: 6000, ...options }),
    [addToast]
  );

  const showWarning = useCallback(
    (message: string, options?: ToastOptions) => addToast('warning', message, { duration: 5000, ...options }),
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, options?: ToastOptions) => addToast('info', message, options),
    [addToast]
  );

  const value: ToastContextValue = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

/**
 * Hook to access toast functions
 *
 * @example
 * const { showSuccess, showError } = useToast();
 * showSuccess('Turnier gespeichert!');
 * showError('Fehler beim Laden.');
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
