/**
 * ToastContainer Component
 *
 * Fixed container that displays all active toasts.
 * Positioned at bottom-right of the screen.
 */

import { CSSProperties } from 'react';
import { Toast, ToastProps } from './Toast';

interface ToastContainerProps {
  toasts: Omit<ToastProps, 'onDismiss'>[];
  onDismiss: (id: string) => void;
}

const containerStyle: CSSProperties = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  pointerEvents: 'none',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) {return null;}

  return (
    <div style={containerStyle} aria-live="polite" aria-label="Benachrichtigungen">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
