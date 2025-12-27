/* eslint-disable react-refresh/only-export-components -- Dialog hook must be co-located with component */
/**
 * ConfirmDialog - Styled modal for confirmations
 *
 * Replaces window.confirm with a consistent, accessible modal.
 * Supports warning and danger variants.
 */

import { CSSProperties, useEffect, useCallback, useRef } from 'react';
import { borderRadius, colors, fontSizes, fontSizesMd3, fontWeights, spacing, shadowSemantics } from '../../design-tokens';
export type ConfirmDialogVariant = 'warning' | 'danger' | 'info';

/** Secondary action button configuration */
export interface SecondaryAction {
  text: string;
  onClick: () => void;
  variant?: 'secondary' | 'danger';
}

export interface ConfirmDialogProps {
  /** Whether the dialog is open (optional - always visible if not provided) */
  isOpen?: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message (can include line breaks) */
  message: string | React.ReactNode;
  /** Variant affects colors */
  variant?: ConfirmDialogVariant;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Called when confirmed */
  onConfirm: () => void;
  /** Called when cancelled or closed (optional if onClose is provided) */
  onCancel?: () => void;
  /** Optional additional details to show */
  details?: string;
  /** Optional secondary action (third button between cancel and confirm) */
  secondaryAction?: SecondaryAction;
  /** Alias for confirmText (for backwards compatibility) */
  confirmLabel?: string;
  /** Alias for cancelText (for backwards compatibility) */
  cancelLabel?: string;
  /** Alias for onCancel (for backwards compatibility with dialogs version) */
  onClose?: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen = true, // Default to visible for match-cockpit compatibility
  title,
  message,
  variant = 'warning',
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  details,
  secondaryAction,
  // Backwards compatibility aliases
  confirmLabel,
  cancelLabel,
  onClose,
}) => {
  // Handle backwards compatibility
  const effectiveConfirmText = confirmText ?? confirmLabel ?? 'Bestätigen';
  const effectiveCancelText = cancelText ?? cancelLabel ?? 'Abbrechen';

  // Memoize the cancel handler to prevent unnecessary re-renders
  const effectiveOnCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else if (onClose) {
      onClose();
    }
  }, [onCancel, onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      effectiveOnCancel();
    }
  }, [effectiveOnCancel]);

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
      accent: colors.warning,
      confirmBg: colors.warning,
      confirmHover: colors.warningHover,
    },
    danger: {
      icon: '🚨',
      accent: colors.error,
      confirmBg: colors.error,
      confirmHover: colors.errorHover,
    },
    info: {
      icon: 'ℹ️',
      accent: colors.primary,
      confirmBg: colors.primary,
      confirmHover: colors.primaryHover,
    },
  };

  const variantConfig = variantColors[variant];

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: spacing.lg,
    animation: 'fadeIn 0.15s ease-out',
  };

  const dialogStyle: CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    border: `2px solid ${variantConfig.accent}`,
    boxShadow: `${shadowSemantics.dialog}, 0 0 15px ${variantConfig.accent}40`,
    maxWidth: '480px',
    width: '100%',
    animation: 'slideIn 0.2s ease-out',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: `${variantConfig.accent}15`,
  };

  const iconStyle: CSSProperties = {
    fontSize: fontSizesMd3.displaySmall,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
  };

  const bodyStyle: CSSProperties = {
    padding: spacing.lg,
  };

  const messageStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
    margin: 0,
  };

  const detailsStyle: CSSProperties = {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceDarkMedium,
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing.md,
    padding: spacing.lg,
    borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceDarkLight,
  };

  const buttonBaseStyle: CSSProperties = {
    padding: `${spacing.sm} ${spacing.xl}`,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '120px',
    minHeight: '44px',
  };

  const cancelButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border}`,
    color: colors.textPrimary,
  };

  const confirmButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: variantConfig.confirmBg,
    border: `1px solid ${variantConfig.confirmBg}`,
    color: colors.onWarning,
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      effectiveOnCancel();
    }
  };

  const handleSecondaryAction = () => {
    secondaryAction?.onClick();
    effectiveOnCancel();
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
            <span style={iconStyle}>{variantConfig.icon}</span>
            <h2 id="confirm-dialog-title" style={titleStyle}>{title}</h2>
          </div>

          <div style={bodyStyle}>
            <p style={messageStyle}>{message}</p>
            {details && <div style={detailsStyle}>{details}</div>}
          </div>

          <div style={footerStyle}>
            <button
              style={cancelButtonStyle}
              onClick={effectiveOnCancel}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.surfaceLight;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {effectiveCancelText}
            </button>
            {secondaryAction && (
              <button
                style={{
                  ...cancelButtonStyle,
                  ...(secondaryAction.variant === 'danger' && {
                    borderColor: colors.error,
                    color: colors.error,
                  }),
                }}
                onClick={handleSecondaryAction}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surfaceLight;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {secondaryAction.text}
              </button>
            )}
            <button
              ref={confirmButtonRef}
              style={confirmButtonStyle}
              onClick={onConfirm}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = variantConfig.confirmHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = variantConfig.confirmBg;
              }}
            >
              {effectiveConfirmText}
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
