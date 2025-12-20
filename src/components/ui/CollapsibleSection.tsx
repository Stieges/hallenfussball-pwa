import { CSSProperties, ReactNode, useState } from 'react';
import { theme } from '../../styles/theme';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: string;
  badge?: string;
  variant?: 'default' | 'primary' | 'secondary';
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  icon,
  badge,
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getVariantStyles = (): { border: string; bg: string; headerBg: string } => {
    switch (variant) {
      case 'primary':
        return {
          border: 'rgba(0, 230, 118, 0.3)',
          bg: 'rgba(0, 230, 118, 0.05)',
          headerBg: 'rgba(0, 230, 118, 0.1)',
        };
      case 'secondary':
        return {
          border: 'rgba(0, 176, 255, 0.3)',
          bg: 'rgba(0, 176, 255, 0.05)',
          headerBg: 'rgba(0, 176, 255, 0.1)',
        };
      default:
        return {
          border: theme.colors.border,
          bg: 'transparent',
          headerBg: 'rgba(255, 255, 255, 0.03)',
        };
    }
  };

  const variantStyles = getVariantStyles();

  const containerStyle: CSSProperties = {
    marginTop: '16px',
    border: `1px solid ${variantStyles.border}`,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    background: variantStyles.bg,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: variantStyles.headerBg,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.2s',
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    margin: 0,
  };

  const badgeStyle: CSSProperties = {
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: theme.fontWeights.medium,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    color: theme.colors.text.secondary,
  };

  const chevronStyle: CSSProperties = {
    fontSize: '12px',
    color: theme.colors.text.secondary,
    transition: 'transform 0.2s',
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
  };

  const contentStyle: CSSProperties = {
    padding: isOpen ? '16px' : '0 16px',
    maxHeight: isOpen ? '2000px' : '0',
    overflow: 'hidden',
    transition: 'all 0.3s ease-in-out',
    opacity: isOpen ? 1 : 0,
  };

  return (
    <div style={containerStyle}>
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
        {icon && <span aria-hidden="true">{icon}</span>}
        <h3 style={titleStyle}>{title}</h3>
        {badge && <span style={badgeStyle}>{badge}</span>}
        <span style={chevronStyle} aria-hidden="true">▼</span>
      </div>
      <div style={contentStyle}>{children}</div>
    </div>
  );
};
