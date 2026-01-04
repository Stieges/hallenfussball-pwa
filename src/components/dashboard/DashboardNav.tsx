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
import { useNavigate, useLocation } from 'react-router-dom';
import { cssVars } from '../../design-tokens'
import { Icons } from '../ui/Icons';
import { useIsMobile } from '../../hooks/useIsMobile';
import { DashboardTab, TAB_PATHS, getTabFromPath } from './dashboardUtils';

interface DashboardNavItem {
  id: DashboardTab;
  label: string;
  icon: keyof typeof Icons;
  badge?: number;
  badgeType?: 'count' | 'warning';
}

interface DashboardNavProps {
  /** Active tab (optional when using URL-based navigation) */
  activeTab?: DashboardTab;
  /** Tab change callback (optional when using URL-based navigation) */
  onTabChange?: (tab: DashboardTab) => void;
  /** Number of trashed tournaments (shown as badge on Papierkorb) */
  trashedCount?: number;
  /** Number of tournaments expiring soon (within 7 days) */
  expiringSoonCount?: number;
  /** Use URL-based navigation (default: true) */
  useUrlNavigation?: boolean;
}

export const DashboardNav: React.FC<DashboardNavProps> = ({
  activeTab: activeTabProp,
  onTabChange,
  trashedCount = 0,
  expiringSoonCount = 0,
  useUrlNavigation = true,
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from URL or prop
  const activeTab = useUrlNavigation ? getTabFromPath(location.pathname) : (activeTabProp ?? 'turniere');

  // Handle tab change - navigate to URL or call callback
  const handleTabChange = (tab: DashboardTab) => {
    if (useUrlNavigation) {
      void navigate(TAB_PATHS[tab]);
    }
    onTabChange?.(tab);
  };

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
    return <MobileNav items={navItems} activeTab={activeTab} onTabChange={handleTabChange} />;
  }

  return <DesktopTabs items={navItems} activeTab={activeTab} onTabChange={handleTabChange} />;
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
    background: cssVars.colors.surface,
    borderTop: `1px solid ${cssVars.colors.border}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 1000,
    height: '64px',
    boxShadow: cssVars.shadows.lg,
  };

  const itemStyle = (isActive: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    padding: `${cssVars.spacing.xs} 0`,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: isActive ? cssVars.colors.primary : cssVars.colors.textSecondary,
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
    borderRadius: cssVars.borderRadius.full,
    background: isActive ? `${cssVars.colors.primary}15` : 'transparent',
    transition: 'background 0.2s ease',
  });

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
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
                color={isActive ? cssVars.colors.primary : cssVars.colors.textSecondary}
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
    gap: cssVars.spacing.xs,
    background: cssVars.colors.surfaceElevated,
    padding: cssVars.spacing.xs,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.lg,
  };

  const tabStyle = (isActive: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    borderRadius: cssVars.borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.md,
    fontWeight: isActive ? cssVars.fontWeights.semibold : cssVars.fontWeights.medium,
    color: isActive ? cssVars.colors.primary : cssVars.colors.textSecondary,
    background: isActive ? cssVars.colors.surface : 'transparent',
    boxShadow: isActive ? cssVars.shadows.sm : 'none',
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
              color={isActive ? cssVars.colors.primary : cssVars.colors.textSecondary}
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
        borderRadius: cssVars.borderRadius.full,
        fontSize: cssVars.fontSizes.xs,
        fontWeight: cssVars.fontWeights.semibold,
        background: isWarning ? cssVars.colors.statusWarning : cssVars.colors.textSecondary,
        color: isWarning ? cssVars.colors.textOnDark : cssVars.colors.surface,
        marginLeft: cssVars.spacing.xs,
      }
    : {
        position: 'absolute',
        top: '-2px',
        right: '2px',
        minWidth: '18px',
        height: '18px',
        padding: '0 4px',
        borderRadius: cssVars.borderRadius.full,
        fontSize: '10px',
        fontWeight: cssVars.fontWeights.bold,
        background: isWarning ? cssVars.colors.statusWarning : cssVars.colors.primary,
        color: cssVars.colors.textOnDark,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${cssVars.colors.surface}`,
      };

  return (
    <span style={style} data-testid="nav-badge">
      {count > 99 ? '99+' : count}
    </span>
  );
};
