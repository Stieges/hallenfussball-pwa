/**
 * ConfirmDialog - Styled modal for confirmations
 *
 * Replaces window.confirm with a consistent, accessible modal.
 * Supports warning and danger variants.
 */

import { CSSProperties, useEffect, useCallback, useRef } from 'react';
import { theme } from '../../styles/theme';

export type ConfirmDialogVariant = 'warning' | 'danger' | 'info';

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message (can include line breaks) */
  message: string;
  /** Variant affects colors */
  variant?: ConfirmDialogVariant;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Called when confirmed */
  onConfirm: () => void;
  /** Called when cancelled or closed */
  onCancel: () => void;
  /** Optional additional details to show */
  details?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  variant = 'warning',
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  onConfirm,
  onCancel,
  details,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus confirm button when dialog opens
      setTimeout(() => confirmButtonRef.current?.focus(), 50);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {return null;}

  const variantColors = {
    warning: {
      icon: '⚠️',
      accent: theme.colors.warning,
      confirmBg: theme.colors.warning,
      confirmHover: '#e68a00',
    },
    danger: {
      icon: '🚨',
      accent: theme.colors.error,
      confirmBg: theme.colors.error,
      confirmHover: '#cc0000',
    },
    info: {
      icon: 'ℹ️',
      accent: theme.colors.primary,
      confirmBg: theme.colors.primary,
      confirmHover: '#00b862',
    },
  };

  const colors = variantColors[variant];

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: theme.spacing.lg,
    animation: 'fadeIn 0.15s ease-out',
  };

  const dialogStyle: CSSProperties = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `2px solid ${colors.accent}`,
    boxShadow: `0 0 30px rgba(0, 0, 0, 0.5), 0 0 15px ${colors.accent}40`,
    maxWidth: '480px',
    width: '100%',
    animation: 'slideIn 0.2s ease-out',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: `${colors.accent}15`,
  };

  const iconStyle: CSSProperties = {
    fontSize: '28px',
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    margin: 0,
  };

  const bodyStyle: CSSProperties = {
    padding: theme.spacing.lg,
  };

  const messageStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    color: theme.colors.text.primary,
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
    margin: 0,
  };

  const detailsStyle: CSSProperties = {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    fontFamily: 'monospace',
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  };

  const buttonBaseStyle: CSSProperties = {
    padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '120px',
    minHeight: '44px',
  };

  const cancelButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.text.primary,
  };

  const confirmButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: colors.confirmBg,
    border: `1px solid ${colors.confirmBg}`,
    color: '#000',
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <>
      <div
        style={overlayStyle}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div ref={dialogRef} style={dialogStyle}>
          <div style={headerStyle}>
            <span style={iconStyle}>{colors.icon}</span>
            <h2 id="confirm-dialog-title" style={titleStyle}>{title}</h2>
          </div>

          <div style={bodyStyle}>
            <p style={messageStyle}>{message}</p>
            {details && <div style={detailsStyle}>{details}</div>}
          </div>

          <div style={footerStyle}>
            <button
              style={cancelButtonStyle}
              onClick={onCancel}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {cancelText}
            </button>
            <button
              ref={confirmButtonRef}
              style={confirmButtonStyle}
              onClick={onConfirm}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.confirmHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.confirmBg;
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
};

/**
 * Hook for managing confirm dialog state
 */
export interface UseConfirmDialogOptions {
  title: string;
  message: string;
  variant?: ConfirmDialogVariant;
  confirmText?: string;
  cancelText?: string;
  details?: string;
}

export interface UseConfirmDialogReturn {
  isOpen: boolean;
  dialogProps: ConfirmDialogProps;
  confirm: (options?: Partial<UseConfirmDialogOptions>) => Promise<boolean>;
  close: () => void;
}

import { useState } from 'react';

export function useConfirmDialog(defaultOptions: UseConfirmDialogOptions): UseConfirmDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((overrideOptions?: Partial<UseConfirmDialogOptions>): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions({ ...defaultOptions, ...overrideOptions });
      setIsOpen(true);
    });
  }, [defaultOptions]);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    resolverRef.current = null;
  }, []);

  return {
    isOpen,
    dialogProps: {
      isOpen,
      title: options.title,
      message: options.message,
      variant: options.variant,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      details: options.details,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    confirm,
    close,
  };
}
