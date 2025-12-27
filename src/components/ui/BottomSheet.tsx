/**
 * BottomSheet - Mobile-optimierter Modal-Ersatz
 *
 * Features:
 * - Slides up from bottom (thumb-friendly)
 * - Drag handle for intuitive closing
 * - Click outside to close
 * - Backdrop overlay
 *
 * Gemäß Mobile UX Konzept (docs/concepts/MOBILE-UX-CONCEPT.md)
 */

import { CSSProperties, useEffect, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../../design-tokens';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
}) => {
  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {return null;}

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    animation: 'fadeIn 0.2s ease-out',
  };

  const sheetStyle: CSSProperties = {
    background: colors.surface,
    borderRadius: '16px 16px 0 0',
    maxHeight: '80vh',
    overflow: 'auto',
    paddingBottom: 'env(safe-area-inset-bottom, 16px)',
    animation: 'slideUp 0.3s ease-out',
  };

  const handleStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: `${spacing.sm} 0`,
    cursor: 'grab',
  };

  const handleBarStyle: CSSProperties = {
    width: '32px',
    height: '4px',
    background: colors.border,
    borderRadius: borderRadius.full,
  };

  const titleStyle: CSSProperties = {
    padding: `0 ${spacing.lg} ${spacing.md}`,
    fontSize: '18px',
    fontWeight: 600,
    color: colors.textPrimary,
    borderBottom: `1px solid ${colors.border}`,
    margin: 0,
  };

  const contentStyle: CSSProperties = {
    padding: spacing.md,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={overlayStyle}
        onClick={onClose}
        role="presentation"
      >
        {/* Sheet */}
        <div
          style={sheetStyle}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Bottom Sheet'}
        >
          {/* Drag Handle */}
          <div style={handleStyle}>
            <div style={handleBarStyle} />
          </div>

          {/* Title */}
          {title && <h2 style={titleStyle}>{title}</h2>}

          {/* Content */}
          <div style={contentStyle}>
            {children}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

/**
 * BottomSheetItem - Einzel-Eintrag im Bottom Sheet Menü
 */
interface BottomSheetItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  isActive?: boolean;
}

export const BottomSheetItem: React.FC<BottomSheetItemProps> = ({
  icon,
  label,
  description,
  onClick,
  isActive = false,
}) => {
  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    cursor: 'pointer',
    background: isActive ? colors.secondaryLight : 'transparent',
    border: 'none',
    borderRadius: borderRadius.md,
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.2s ease',
    // Touch target
    minHeight: '56px',
  };

  const iconContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: borderRadius.md,
    background: isActive ? colors.primary : colors.surfaceLight,
    color: isActive ? 'white' : colors.textSecondary,
  };

  const textContainerStyle: CSSProperties = {
    flex: 1,
  };

  const labelStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: 500,
    color: colors.textPrimary,
    margin: 0,
  };

  const descriptionStyle: CSSProperties = {
    fontSize: '13px',
    color: colors.textSecondary,
    margin: '2px 0 0',
  };

  return (
    <button
      style={itemStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = colors.surfaceHover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? colors.secondaryLight : 'transparent';
      }}
    >
      <div style={iconContainerStyle}>
        {icon}
      </div>
      <div style={textContainerStyle}>
        <p style={labelStyle}>{label}</p>
        {description && <p style={descriptionStyle}>{description}</p>}
      </div>
    </button>
  );
};
