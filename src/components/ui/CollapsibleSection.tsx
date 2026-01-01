import { CSSProperties, ReactNode, useState } from 'react';
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
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  icon,
  badge,
  variant = 'default',
  testId,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
          border: `${cssVars.colors.statusLive}40`,
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
    marginTop: cssVars.spacing.lg,
    border: `1px solid ${variantStyles.border}`,
    borderRadius: cssVars.borderRadius.md,
    overflow: 'hidden',
    background: variantStyles.bg,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: variantStyles.headerBg,
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
    padding: isOpen ? cssVars.spacing.md : `0 ${cssVars.spacing.md}`,
    maxHeight: isOpen ? '2000px' : '0',
    overflow: 'hidden',
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
