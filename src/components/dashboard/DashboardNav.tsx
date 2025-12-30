/**
 * DashboardNav - Adaptive Navigation for Dashboard
 *
 * Mobile: Bottom Navigation (fixed at bottom)
 * Desktop: Tab Bar (inline at top)
 *
 * Tabs:
 * - Turniere (active: running, upcoming, draft)
 * - Archiv (finished tournaments)
 * - Papierkorb (soft-deleted, 30-day retention)
 */

import { CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius, shadows } from '../../design-tokens';
import { Icons } from '../ui/Icons';
import { useIsMobile } from '../../hooks/useIsMobile';

export type DashboardTab = 'turniere' | 'archiv' | 'papierkorb';

interface DashboardNavItem {
  id: DashboardTab;
  label: string;
  icon: keyof typeof Icons;
  badge?: number;
  badgeType?: 'count' | 'warning';
}

interface DashboardNavProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  /** Number of trashed tournaments (shown as badge on Papierkorb) */
  trashedCount?: number;
  /** Number of tournaments expiring soon (within 7 days) */
  expiringSoonCount?: number;
}

export const DashboardNav: React.FC<DashboardNavProps> = ({
  activeTab,
  onTabChange,
  trashedCount = 0,
  expiringSoonCount = 0,
}) => {
  const isMobile = useIsMobile();

  const navItems: DashboardNavItem[] = [
    {
      id: 'turniere',
      label: 'Turniere',
      icon: 'Trophy',
    },
    {
      id: 'archiv',
      label: 'Archiv',
      icon: 'Archive',
    },
    {
      id: 'papierkorb',
      label: 'Papierkorb',
      icon: 'Trash',
      badge: trashedCount > 0 ? trashedCount : undefined,
      badgeType: expiringSoonCount > 0 ? 'warning' : 'count',
    },
  ];

  if (isMobile) {
    return <MobileNav items={navItems} activeTab={activeTab} onTabChange={onTabChange} />;
  }

  return <DesktopTabs items={navItems} activeTab={activeTab} onTabChange={onTabChange} />;
};

// =============================================================================
// Mobile Bottom Navigation
// =============================================================================

interface NavItemsProps {
  items: DashboardNavItem[];
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

const MobileNav: React.FC<NavItemsProps> = ({ items, activeTab, onTabChange }) => {
  const containerStyle: CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    background: colors.surface,
    borderTop: `1px solid ${colors.border}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 1000,
    height: '64px',
    boxShadow: shadows.lg,
  };

  const itemStyle = (isActive: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    padding: `${spacing.xs} 0`,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: isActive ? colors.primary : colors.textSecondary,
    transition: 'color 0.2s ease, transform 0.1s ease',
    gap: '4px',
    minWidth: '64px',
    minHeight: '48px',
    position: 'relative',
  });

  const iconContainerStyle = (isActive: boolean): CSSProperties => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '28px',
    borderRadius: borderRadius.full,
    background: isActive ? `${colors.primary}15` : 'transparent',
    transition: 'background 0.2s ease',
  });

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: 1,
  };

  return (
    <nav style={containerStyle} data-testid="dashboard-bottom-nav">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const IconComponent = Icons[item.icon];

        return (
          <button
            key={item.id}
            style={itemStyle(isActive)}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`nav-tab-${item.id}`}
          >
            <div style={iconContainerStyle(isActive)}>
              <IconComponent
                size={24}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              {item.badge !== undefined && item.badge > 0 && (
                <Badge count={item.badge} type={item.badgeType} />
              )}
            </div>
            <span style={labelStyle}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// =============================================================================
// Desktop Tab Bar
// =============================================================================

const DesktopTabs: React.FC<NavItemsProps> = ({ items, activeTab, onTabChange }) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.xs,
    background: colors.surfaceElevated,
    padding: spacing.xs,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  };

  const tabStyle = (isActive: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    fontSize: fontSizes.md,
    fontWeight: isActive ? fontWeights.semibold : fontWeights.medium,
    color: isActive ? colors.primary : colors.textSecondary,
    background: isActive ? colors.surface : 'transparent',
    boxShadow: isActive ? shadows.sm : 'none',
    transition: 'all 0.2s ease',
    position: 'relative',
  });

  return (
    <nav style={containerStyle} data-testid="dashboard-tabs">
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const IconComponent = Icons[item.icon];

        return (
          <button
            key={item.id}
            style={tabStyle(isActive)}
            onClick={() => onTabChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`tab-${item.id}`}
          >
            <IconComponent
              size={20}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <Badge count={item.badge} type={item.badgeType} inline />
            )}
          </button>
        );
      })}
    </nav>
  );
};

// =============================================================================
// Badge Component
// =============================================================================

interface BadgeProps {
  count: number;
  type?: 'count' | 'warning';
  inline?: boolean;
}

const Badge: React.FC<BadgeProps> = ({ count, type = 'count', inline = false }) => {
  const isWarning = type === 'warning';

  const style: CSSProperties = inline
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '20px',
        padding: '0 6px',
        borderRadius: borderRadius.full,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semibold,
        background: isWarning ? colors.statusWarning : colors.textSecondary,
        color: isWarning ? colors.textOnDark : colors.surface,
        marginLeft: spacing.xs,
      }
    : {
        position: 'absolute',
        top: '-2px',
        right: '2px',
        minWidth: '18px',
        height: '18px',
        padding: '0 4px',
        borderRadius: borderRadius.full,
        fontSize: '10px',
        fontWeight: fontWeights.bold,
        background: isWarning ? colors.statusWarning : colors.primary,
        color: colors.textOnDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${colors.surface}`,
      };

  return (
    <span style={style} data-testid="nav-badge">
      {count > 99 ? '99+' : count}
    </span>
  );
};
