/**
 * Toast Component
 *
 * Individual toast notification with icon, message, and dismiss button.
 * Supports success, error, warning, and info variants.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from '../Icons';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Was die Aktion nach dem Tipp meldet (@OB-087): nichts = Hinweis schließt wie bisher; `busyLabel` = Hinweis bleibt stehen,
 * die Taste ist gesperrt und zeigt die Arbeitsanzeige; `note` = Hinweis bleibt stehen und nennt in einem Satz, warum jetzt
 * nichts geschieht (die Taste bleibt bedienbar).
 */
export type ToastActionResult = { busyLabel: string } | { note: string } | undefined;

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onDismiss: (id: string) => void;
  duration?: number;
  action?: {
    label: string;
    onClick: () => ToastActionResult;
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
  const { t } = useTranslation('common');
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

  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const handleAction = () => {
    if (busyLabel !== null) { return; }
    const result = action?.onClick();
    if (result && 'busyLabel' in result) {
      setNote(null);
      setBusyLabel(result.busyLabel);
      return;
    }
    if (result && 'note' in result) {
      setNote(result.note);
      return;
    }
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
          disabled={busyLabel !== null}
          aria-busy={busyLabel !== null}
          data-testid="toast-action"
          type="button"
        >
          {busyLabel ?? action.label}
        </button>
      )}
      <button
        className={styles.dismissButton}
        onClick={handleDismiss}
        aria-label={t('toast.dismissAriaLabel')}
        type="button"
      >
        <Icons.X size={16} />
      </button>
      {note !== null && <span className={styles.note} data-testid="toast-action-note">{note}</span>}
    </div>
  );
};
