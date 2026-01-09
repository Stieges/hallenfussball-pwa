/**
 * PublicBottomNav - Bottom Navigation for Public View
 *
 * Shows 3 tabs for the public/spectator view:
 * - Spiele (Schedule)
 * - Tabellen (Standings)
 * - Settings (Theme, QR-Code, Info)
 *
 * @see docs/concepts/PUBLIC-PAGE-KONZEPT-v4-FINAL.md Section 4
 */

import { CSSProperties } from 'react';
import { cssVars, layoutHeights } from '../../design-tokens';
import { Icons } from './Icons';

export type PublicNavTab = 'schedule' | 'standings' | 'settings';

interface PublicNavItem {
  id: PublicNavTab;
  label: string;
  icon: keyof typeof Icons;
}

const NAV_ITEMS: PublicNavItem[] = [
  { id: 'schedule', label: 'Spiele', icon: 'List' },
  { id: 'standings', label: 'Tabellen', icon: 'BarChart' },
  { id: 'settings', label: 'Info', icon: 'Settings' },
];

export interface PublicBottomNavProps {
  activeTab: PublicNavTab;
  onTabChange: (tab: PublicNavTab) => void;
}

export const PublicBottomNav: React.FC<PublicBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
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
    height: layoutHeights.bottomNav,
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
    background: isActive
      ? `linear-gradient(to bottom, ${cssVars.colors.surfaceHover}, transparent)`
      : 'transparent',
    border: 'none',
    borderTop: isActive
      ? `2px solid ${cssVars.colors.primary}`
      : '2px solid transparent',
    color: isActive ? cssVars.colors.primary : cssVars.colors.textSecondary,
    transition: 'all 0.2s ease',
    gap: '2px',
    // Touch target minimum 44px
    minWidth: '44px',
    minHeight: '44px',
  });

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    lineHeight: 1,
    marginTop: '2px',
  };

  return (
    <nav style={containerStyle} aria-label="Public Navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const IconComponent = Icons[item.icon];

        return (
          <button
            key={item.id}
            style={itemStyle(isActive)}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <IconComponent
              size={24}
              color={isActive ? cssVars.colors.primary : cssVars.colors.textSecondary}
            />
            <span style={labelStyle}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
