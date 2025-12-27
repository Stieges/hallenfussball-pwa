/**
 * BottomNavigation - Mobile-optimierte Tab-Navigation
 *
 * Zeigt 4 Haupt-Tabs am unteren Bildschirmrand:
 * - Spielplan
 * - Tabellen
 * - Live (Turnierleitung)
 * - Mehr (öffnet Bottom Sheet)
 *
 * Gemäß Mobile UX Konzept (docs/concepts/MOBILE-UX-CONCEPT.md)
 */

import { CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights } from '../../design-tokens';
import { Icons } from './Icons';

export type BottomNavTab = 'schedule' | 'tabellen' | 'management' | 'more';

interface BottomNavItem {
  id: BottomNavTab;
  label: string;
  icon: keyof typeof Icons;
}

const NAV_ITEMS: BottomNavItem[] = [
  { id: 'schedule', label: 'Spielplan', icon: 'List' },
  { id: 'tabellen', label: 'Tabellen', icon: 'BarChart' },
  { id: 'management', label: 'Live', icon: 'Play' },
  { id: 'more', label: 'Mehr', icon: 'MoreHorizontal' },
];

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: BottomNavTab) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
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
    background: colors.surface,
    borderTop: `1px solid ${colors.border}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 1000,
    height: '56px',
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
    transition: 'color 0.2s ease',
    gap: '2px',
    // Touch target minimum 44px
    minWidth: '44px',
    minHeight: '44px',
  });

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: 1,
    marginTop: '2px',
  };

  return (
    <nav style={containerStyle}>
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id ||
          // "more" is active when any of the "more" menu tabs are active
          (item.id === 'more' && ['teams', 'settings', 'monitor'].includes(activeTab));
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
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <span style={labelStyle}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
