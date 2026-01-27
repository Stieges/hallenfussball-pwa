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

import { CSSProperties, useEffect, useId } from 'react';
import { cssVars } from '../../design-tokens'
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  // Focus trap for accessibility
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
  });

  // Stable unique ID for aria-labelledby (React 18+)
  const generatedId = useId();

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) {return null;}

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: cssVars.colors.overlay,
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    animation: 'fadeIn 0.2s ease-out',
  };

  const sheetStyle: CSSProperties = {
    background: cssVars.colors.surface,
    borderRadius: '16px 16px 0 0',
    maxHeight: '80vh',
    overflow: 'auto',
    paddingBottom: 'env(safe-area-inset-bottom, 16px)',
    animation: 'slideUp 0.3s ease-out',
  };

  const handleStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    cursor: 'grab',
  };

  const handleBarStyle: CSSProperties = {
    width: '32px',
    height: '4px',
    background: cssVars.colors.border,
    borderRadius: cssVars.borderRadius.full,
  };

  const titleStyle: CSSProperties = {
    padding: `0 ${cssVars.spacing.lg} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    margin: 0,
  };

  const contentStyle: CSSProperties = {
    padding: cssVars.spacing.md,
  };

  // Use stable ID for aria-labelledby when title exists
  const titleId = title ? generatedId : undefined;

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
          ref={focusTrap.containerRef}
          style={sheetStyle}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-label={titleId ? undefined : 'Bottom Sheet'}
        >
          {/* Drag Handle */}
          <div style={handleStyle}>
            <div style={handleBarStyle} />
          </div>

          {/* Title */}
          {title && <h2 id={titleId} style={titleStyle}>{title}</h2>}

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
  /** Test ID for E2E tests */
  'data-testid'?: string;
}

export const BottomSheetItem: React.FC<BottomSheetItemProps> = ({
  icon,
  label,
  description,
  onClick,
  isActive = false,
  'data-testid': testId,
}) => {
  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    cursor: 'pointer',
    background: isActive ? cssVars.colors.secondaryLight : 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
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
    borderRadius: cssVars.borderRadius.md,
    background: isActive ? cssVars.colors.primary : cssVars.colors.surfaceLight,
    color: isActive ? 'white' : cssVars.colors.textSecondary,
  };

  const textContainerStyle: CSSProperties = {
    flex: 1,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const descriptionStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: '2px 0 0',
  };

  return (
    <button
      style={itemStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = cssVars.colors.surfaceHover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? cssVars.colors.secondaryLight : 'transparent';
      }}
      data-testid={testId}
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
