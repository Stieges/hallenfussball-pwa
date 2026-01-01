/**
 * CollapsibleInfoPanel - Collapsible info/instruction panel
 *
 * Used for showing contextual help or instructions that users can dismiss.
 * Collapse state is persisted to localStorage per key.
 *
 * Features:
 * - Collapsible with smooth animation
 * - localStorage persistence for collapse state
 * - Icon and title support
 * - Customizable styling variants
 */

import { type CSSProperties, useState, useEffect, type ReactNode } from 'react';
import { cssVars } from '../../design-tokens';

export interface CollapsibleInfoPanelProps {
  /** Unique key for localStorage persistence */
  storageKey: string;
  /** Panel title */
  title: string;
  /** Panel content */
  children: ReactNode;
  /** Icon (emoji or React node) */
  icon?: ReactNode;
  /** Visual variant */
  variant?: 'info' | 'tip' | 'warning';
  /** Default collapsed state (if no localStorage value) */
  defaultCollapsed?: boolean;
  /** Test ID for E2E tests */
  testId?: string;
}

export const CollapsibleInfoPanel: React.FC<CollapsibleInfoPanelProps> = ({
  storageKey,
  title,
  children,
  icon = 'ℹ️',
  variant = 'info',
  defaultCollapsed = false,
  testId,
}) => {
  // Initialize state from localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(`infoPanel_${storageKey}`);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as unknown;
        return typeof parsed === 'boolean' ? parsed : defaultCollapsed;
      }
      return defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem(`infoPanel_${storageKey}`, JSON.stringify(isCollapsed));
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey, isCollapsed]);

  const getVariantStyles = (): { border: string; bg: string; iconBg: string } => {
    switch (variant) {
      case 'tip':
        return {
          border: cssVars.colors.success,
          bg: `${cssVars.colors.success}10`,
          iconBg: `${cssVars.colors.success}20`,
        };
      case 'warning':
        return {
          border: cssVars.colors.warning,
          bg: `${cssVars.colors.warning}10`,
          iconBg: `${cssVars.colors.warning}20`,
        };
      default: // info
        return {
          border: cssVars.colors.primary,
          bg: cssVars.colors.primarySubtle,
          iconBg: cssVars.colors.primaryLight,
        };
    }
  };

  const variantStyles = getVariantStyles();

  const containerStyle: CSSProperties = {
    marginBottom: cssVars.spacing.md,
    border: `1px solid ${variantStyles.border}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: variantStyles.bg,
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  };

  const contentId = `panel-content-${storageKey}`;

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    cursor: 'pointer',
    userSelect: 'none',
    minHeight: '44px', // Touch target minimum
  };

  const iconContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: variantStyles.iconBg,
    fontSize: cssVars.fontSizes.md,
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const chevronStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    transition: 'transform 0.2s ease',
    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
  };

  const contentStyle: CSSProperties = {
    padding: isCollapsed ? 0 : `0 ${cssVars.spacing.md} ${cssVars.spacing.md}`,
    maxHeight: isCollapsed ? 0 : '500px',
    overflow: 'hidden',
    opacity: isCollapsed ? 0 : 1,
    transition: 'all 0.2s ease',
  };

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      <div
        style={headerStyle}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <span style={iconContainerStyle} aria-hidden="true">
          {icon}
        </span>
        <h4 style={titleStyle}>{title}</h4>
        <span style={chevronStyle} aria-hidden="true">▼</span>
      </div>
      <div id={contentId} style={contentStyle}>
        {children}
      </div>
    </div>
  );
};

export default CollapsibleInfoPanel;
