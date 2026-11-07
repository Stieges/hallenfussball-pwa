import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { cssVars } from '../../design-tokens'

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Icon as React node or emoji string */
  icon?: ReactNode;
  /** Badge text (e.g., count) */
  badge?: string | number;
  /** Visual variant */
  variant?: 'default' | 'primary' | 'secondary' | 'live';
  /** Optional data-testid */
  testId?: string;
  /** Knappere Abstände (Handy: alle Turniere des Tages ohne Scrollen, @OB-079) */
  compact?: boolean;
  /**
   * Überlauf im offenen Abschnitt. Voreinstellung `hidden` (Rahmen schneidet ab, Wizard und Admin Center bleiben unverändert);
   * `visible` nur, wo Inhalt bewusst herausragt – das Aktionsmenü einer Turnierkarte (@OB-079).
   */
  overflowWhenOpen?: 'hidden' | 'visible';
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  icon,
  badge,
  variant = 'default',
  testId,
  compact = false,
  overflowWhenOpen = 'hidden',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  // Mit `overflowWhenOpen="visible"` bleibt im offenen, ausgeklappten Abschnitt nichts abgeschnitten (das Aktionsmenü einer Karte ragt aus
  // dem Abschnitt); `hidden` gilt beim Auf- und Zuklappen (Animation) und ohne die Option immer (@OB-079).
  const [settled, setSettled] = useState(defaultOpen);
  useEffect(() => {
    if (!isOpen) {
      setSettled(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSettled(true), 350);
    return () => window.clearTimeout(timer);
  }, [isOpen]);
  const overflow = overflowWhenOpen === 'visible' && isOpen && settled ? 'visible' : 'hidden';

  const getVariantStyles = (): { border: string; bg: string; headerBg: string; titleColor?: string } => {
    switch (variant) {
      case 'primary':
        return {
          border: cssVars.colors.borderActive,
          bg: cssVars.colors.primarySubtle,
          headerBg: cssVars.colors.primaryMedium,
        };
      case 'secondary':
        return {
          border: cssVars.colors.secondaryBorderActive,
          bg: cssVars.colors.secondarySubtle,
          headerBg: cssVars.colors.secondaryMedium,
        };
      case 'live':
        return {
          border: cssVars.colors.statusLive,
          bg: cssVars.colors.statusLiveBg,
          headerBg: cssVars.colors.statusLiveBg,
          titleColor: cssVars.colors.statusLive,
        };
      default:
        return {
          border: cssVars.colors.border,
          bg: 'transparent',
          headerBg: cssVars.colors.surface,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const containerStyle: CSSProperties = {
    marginTop: compact ? cssVars.spacing.sm : cssVars.spacing.lg,
    border: `${cssVars.borderWidth.thin} solid ${variantStyles.border}`,
    borderRadius: cssVars.borderRadius.md,
    overflow,
    background: variantStyles.bg,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: compact ? cssVars.spacing.sm : cssVars.spacing.md,
    minHeight: cssVars.touchTargets.minimum, // @OB-022: Kopfzeile ist die Bedienfläche (auch im knappen Abstand)
    background: variantStyles.headerBg,
    // ohne abschneidenden Rahmen trägt die Kopfzeile ihre oberen Rundungen selbst
    borderRadius: overflow === 'visible' ? `${cssVars.borderRadius.md} ${cssVars.borderRadius.md} 0 0` : undefined,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.2s',
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: variantStyles.titleColor ?? cssVars.colors.textPrimary,
    margin: 0,
  };

  const badgeStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.lg,
    color: cssVars.colors.textSecondary,
  };

  const chevronStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    transition: 'transform 0.2s',
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
  };

  const contentStyle: CSSProperties = {
    padding: isOpen ? (compact ? cssVars.spacing.sm : cssVars.spacing.md) : `0 ${compact ? cssVars.spacing.sm : cssVars.spacing.md}`,
    maxHeight: isOpen ? '50000px' : '0',
    overflow,
    transition: 'all 0.3s ease-in-out',
    opacity: isOpen ? 1 : 0,
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      <div
        style={headerStyle}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center' }} aria-hidden="true">{icon}</span>}
        <h3 style={titleStyle}>{title}</h3>
        {badge !== undefined && <span style={badgeStyle}>{badge}</span>}
        <span style={chevronStyle} aria-hidden="true">▼</span>
      </div>
      <div style={contentStyle}>{children}</div>
    </div>
  );
};
