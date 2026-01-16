/* eslint-disable react-refresh/only-export-components -- Dialog hook must be co-located with component */
/**
 * ConfirmDialog - Styled modal for confirmations
 *
 * Replaces window.confirm with a consistent, accessible modal.
 * Supports warning and danger variants.
 */

import { CSSProperties, useEffect, useCallback, useRef } from 'react';
import { cssVars, fontSizesMd3, shadowSemantics } from '../../design-tokens'
import { useFocusTrap } from '../../hooks/useFocusTrap';
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

  // Focus trap for accessibility
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: effectiveOnCancel,
  });

  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management and body scroll prevention
  useEffect(() => {
    if (isOpen) {
      // Focus confirm button when dialog opens
      setTimeout(() => confirmButtonRef.current?.focus(), 50);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) {return null;}

  const variantColors = {
    warning: {
      icon: '⚠️',
      accent: cssVars.colors.warning,
      confirmBg: cssVars.colors.warning,
      confirmHover: cssVars.colors.warningHover,
    },
    danger: {
      icon: '🚨',
      accent: cssVars.colors.error,
      confirmBg: cssVars.colors.error,
      confirmHover: cssVars.colors.errorHover,
    },
    info: {
      icon: 'ℹ️',
      accent: cssVars.colors.primary,
      confirmBg: cssVars.colors.primary,
      confirmHover: cssVars.colors.primaryHover,
    },
  };

  const variantConfig = variantColors[variant];

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cssVars.colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: cssVars.spacing.lg,
    animation: 'fadeIn 0.15s ease-out',
  };

  const dialogStyle: CSSProperties = {
    backgroundColor: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
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
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.lg,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    backgroundColor: `${variantConfig.accent}15`,
  };

  const iconStyle: CSSProperties = {
    fontSize: fontSizesMd3.displaySmall,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const bodyStyle: CSSProperties = {
    padding: cssVars.spacing.lg,
  };

  const messageStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    lineHeight: 1.6,
    whiteSpace: 'pre-line',
    margin: 0,
  };

  const detailsStyle: CSSProperties = {
    marginTop: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surfaceDarkMedium,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    fontFamily: cssVars.fontFamilies.mono,
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.lg,
    borderTop: `1px solid ${cssVars.colors.border}`,
    backgroundColor: cssVars.colors.surfaceDarkLight,
  };

  const buttonBaseStyle: CSSProperties = {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.xl}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '120px',
    minHeight: '44px',
  };

  const cancelButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    color: cssVars.colors.textPrimary,
  };

  const confirmButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: variantConfig.confirmBg,
    border: `1px solid ${variantConfig.confirmBg}`,
    color: cssVars.colors.onWarning,
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
      >
        <div
          ref={focusTrap.containerRef}
          style={dialogStyle}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
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
              data-testid="confirm-dialog-cancel"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = cssVars.colors.surfaceLight;
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
                    borderColor: cssVars.colors.error,
                    color: cssVars.colors.error,
                  }),
                }}
                onClick={handleSecondaryAction}
                data-testid="confirm-dialog-secondary"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = cssVars.colors.surfaceLight;
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
              data-testid="confirm-dialog-confirm"
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
