/**
 * Toast Component
 *
 * Individual toast notification with icon, message, and dismiss button.
 * Supports success, error, warning, and info variants.
 */

import { useEffect, useState } from 'react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onDismiss: (id: string) => void;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const icons: Record<ToastType, string> = {
  success: '\u2713', // ✓
  error: '\u2717',   // ✗
  warning: '\u26A0', // ⚠
  info: '\u2139',    // ℹ
};

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  onDismiss,
  duration = 4000,
  action,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(id), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };

  const handleAction = () => {
    action?.onClick();
    handleDismiss();
  };

  return (
    <div
      className={`${styles.toast} ${styles[type]} ${isExiting ? styles.exiting : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        {icons[type]}
      </span>
      <span className={styles.message}>{message}</span>
      {action && (
        <button
          className={styles.actionButton}
          onClick={handleAction}
          type="button"
        >
          {action.label}
        </button>
      )}
      <button
        className={styles.dismissButton}
        onClick={handleDismiss}
        aria-label="Schließen"
        type="button"
      >
        \u00D7
      </button>
    </div>
  );
};
