import { CSSProperties, ReactNode, useState } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';

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
          border: colors.borderActive,
          bg: colors.primarySubtle,
          headerBg: colors.primaryMedium,
        };
      case 'secondary':
        return {
          border: colors.secondaryBorderActive,
          bg: colors.secondarySubtle,
          headerBg: colors.secondaryMedium,
        };
      case 'live':
        return {
          border: `${colors.statusLive}40`,
          bg: colors.statusLiveBg,
          headerBg: colors.statusLiveBg,
          titleColor: colors.statusLive,
        };
      default:
        return {
          border: colors.border,
          bg: 'transparent',
          headerBg: colors.surface,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const containerStyle: CSSProperties = {
    marginTop: spacing.lg,
    border: `1px solid ${variantStyles.border}`,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    background: variantStyles.bg,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    background: variantStyles.headerBg,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.2s',
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: variantStyles.titleColor ?? colors.textPrimary,
    margin: 0,
  };

  const badgeStyle: CSSProperties = {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    background: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    color: colors.textSecondary,
  };

  const chevronStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    transition: 'transform 0.2s',
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
  };

  const contentStyle: CSSProperties = {
    padding: isOpen ? spacing.md : `0 ${spacing.md}`,
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
