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

import { CSSProperties, useId } from 'react';
import { cssVars } from '../../design-tokens'
import { DialogSurface } from './molecules/DialogSurface';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /**
   * Tasten-Fuß (z. B. `DialogActions`): Mit Fuß bleiben Griff, Titel und Fuß stehen, nur der Inhalt scrollt
   * (DA-2a, @OB-062). Ohne Fuß bleibt das Blatt wie bisher.
   */
  footer?: React.ReactNode;
  /** data-testid der Fläche (Standard der DialogSurface: dialog-surface) */
  testId?: string;
}

/** Blatt von unten; Fläche, Abdunkelung, Fokusfalle und Scroll-Sperre kommen aus DialogSurface (B-43a). */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  footer,
  testId,
}) => {
  // Stable unique ID for aria-labelledby (React 18+)
  const generatedId = useId();

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

  const handleAndTitle = (
    <>
      {/* Drag Handle */}
      <div style={handleStyle}>
        <div style={handleBarStyle} />
      </div>

      {/* Title */}
      {title && <h2 id={titleId} style={titleStyle}>{title}</h2>}
    </>
  );

  return (
    <DialogSurface
      isOpen={isOpen}
      onClose={onClose}
      placement="sheet"
      maxWidth="100%"
      zIndex={cssVars.zIndex.floating}
      labelledBy={titleId}
      ariaLabel={titleId ? undefined : 'Bottom Sheet'}
      header={footer ? handleAndTitle : undefined}
      footer={footer}
      testId={testId}
    >
      {!footer && handleAndTitle}

      {/* Content */}
      <div style={contentStyle}>
        {children}
      </div>
    </DialogSurface>
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
