/**
 * ConfirmDialog - Reusable confirmation dialog
 *
 * QW-001: Replaces window.confirm() with proper modal UI.
 * MF-004: Accessibility improvements (focus trap, Escape key, ARIA)
 */

import { CSSProperties, useEffect, useRef, useCallback } from 'react';
import { theme } from '../../styles/theme';
import { Button } from '../ui';
import { useIsMobile } from '../../hooks/useIsMobile';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'warning',
  onConfirm,
  onCancel,
}) => {
  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);

  // MF-004: Focus management and Escape key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    // Focus dialog container on mount
    setTimeout(() => dialogRef.current?.focus(), 50);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const variantColors = {
    danger: theme.colors.error,
    warning: theme.colors.warning,
    info: theme.colors.secondary,
  };

  const variantIcons = {
    danger: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const color = variantColors[variant];
  const icon = variantIcons[variant];

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: theme.spacing.md,
  };

  const containerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '440px',
    padding: isMobile ? theme.spacing.lg : theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    border: `2px solid ${color}`,
    background: `linear-gradient(135deg, ${color}20, ${color}10)`,
    backgroundColor: theme.colors.background,
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.lg : theme.fontSizes.xl,
    fontWeight: theme.fontWeights.bold,
    color: color,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const messageStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    lineHeight: 1.6,
    marginBottom: theme.spacing.lg,
    whiteSpace: 'pre-line',
  };

  const buttonsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
  };

  return (
    <div style={overlayStyle} onClick={onCancel}>
      {/* MF-004: Modal mit korrekten ARIA-Attributen */}
      <div
        ref={dialogRef}
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
      >
        <div id="confirm-dialog-title" style={titleStyle}>
          <span aria-hidden="true">{icon}</span>
          <span>{title}</span>
        </div>

        <div id="confirm-dialog-message" style={messageStyle}>{message}</div>

        <div style={buttonsStyle}>
          <Button
            variant="secondary"
            size={isMobile ? 'md' : 'sm'}
            onClick={onCancel}
            style={{ flex: isMobile ? 1 : 'none', minHeight: isMobile ? '48px' : 'auto' }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size={isMobile ? 'md' : 'sm'}
            onClick={onConfirm}
            style={{ flex: isMobile ? 1 : 'none', minHeight: isMobile ? '48px' : 'auto' }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
