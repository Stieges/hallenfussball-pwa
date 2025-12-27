import { ReactNode, useEffect, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { borderRadius, colors, fontSizes, fontWeights, gradients, shadows, spacing } from '../../design-tokens';
import { Icons } from '../ui/Icons';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  closeOnBackdropClick?: boolean;
}

export const Dialog = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '500px',
  closeOnBackdropClick = true,
}: DialogProps) => {
  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) {return null;}

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

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
    zIndex: 1000,
    padding: spacing.lg,
    overflowY: 'auto',
  };

  const modalStyle: CSSProperties = {
    background: gradients.card,
    backdropFilter: 'blur(20px)',
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.lg,
    boxShadow: shadows.lg,
    width: '100%',
    maxWidth: maxWidth,
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    animation: 'dialogSlideIn 0.2s ease-out',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottom: `1px solid ${colors.border}`,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    margin: 0,
  };

  const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: spacing.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    transition: 'background-color 0.2s',
    color: colors.textSecondary,
  };

  const contentStyle: CSSProperties = {
    padding: spacing.xl,
  };

  const dialog = (
    <div style={overlayStyle} className="dialog-overlay" onClick={handleBackdropClick}>
      <div style={modalStyle} className="dialog-modal" onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            aria-label="Schließen"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Icons.X size={20} />
          </button>
        </div>
        <div style={contentStyle}>{children}</div>
      </div>

      <style>{`
        @keyframes dialogSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 767px) {
          .dialog-overlay {
            padding: 12px !important;
            align-items: flex-start !important;
            padding-top: 32px !important;
          }

          .dialog-modal {
            max-width: 100% !important;
            border-radius: 12px !important;
          }

          .dialog-modal > div:first-child {
            padding: 16px !important;
          }

          .dialog-modal > div:last-child {
            padding: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .dialog-overlay {
            padding: 8px !important;
            padding-top: 24px !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(dialog, document.body);
};
