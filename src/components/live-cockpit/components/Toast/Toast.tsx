/**
 * Toast - Notification Component
 *
 * Shows temporary feedback messages for actions like:
 * - Goal scored
 * - Match started/paused/finished
 * - Undo performed
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const duration = toast.duration ?? 3000;

  useEffect(() => {
    // Animate in
    const rafId = requestAnimationFrame(() => setIsVisible(true));

    // Auto dismiss
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, duration);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [toast.id, duration, onDismiss]);

  const getTypeStyles = (): { bg: string; border: string; icon: string } => {
    switch (toast.type) {
      case 'success':
        return {
          bg: `${cssVars.colors.success}15`,
          border: cssVars.colors.success,
          icon: '✓',
        };
      case 'warning':
        return {
          bg: `${cssVars.colors.warning}15`,
          border: cssVars.colors.warning,
          icon: '⚠',
        };
      case 'error':
        return {
          bg: `${cssVars.colors.error}15`,
          border: cssVars.colors.error,
          icon: '✕',
        };
      case 'info':
      default:
        return {
          bg: `${cssVars.colors.info}15`,
          border: cssVars.colors.info,
          icon: 'ℹ',
        };
    }
  };

  const typeStyles = getTypeStyles();

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    backgroundColor: typeStyles.bg,
    borderLeft: `4px solid ${typeStyles.border}`,
    borderRadius: cssVars.borderRadius.md,
    boxShadow: `0 4px 12px ${cssVars.colors.shadowMedium}`,
    transform: isVisible && !isLeaving ? 'translateY(0)' : 'translateY(-20px)',
    opacity: isVisible && !isLeaving ? 1 : 0,
    transition: 'all 0.2s ease-out',
    maxWidth: '400px',
  };

  const iconStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    color: typeStyles.border,
  };

  const messageStyle: CSSProperties = {
    flex: 1,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
  };

  const actionStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 600,
    color: typeStyles.border,
    backgroundColor: 'transparent',
    border: `1px solid ${typeStyles.border}`,
    borderRadius: cssVars.borderRadius.sm,
    cursor: 'pointer',
  };

  const dismissStyle: CSSProperties = {
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.lg,
    color: cssVars.colors.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    lineHeight: 1,
  };

  return (
    <div style={containerStyle}>
      <span style={iconStyle}>{typeStyles.icon}</span>
      <span style={messageStyle}>{toast.message}</span>
      {toast.action && (
        <button style={actionStyle} onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}
      <button style={dismissStyle} onClick={() => onDismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}

// Toast Container
interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    top: cssVars.spacing.lg,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    zIndex: 2000,
    pointerEvents: 'none',
  };

  const toastWrapperStyle: CSSProperties = {
    pointerEvents: 'auto',
  };

  return (
    <div style={containerStyle}>
      {toasts.map((toast) => (
        <div key={toast.id} style={toastWrapperStyle}>
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

export default Toast;
