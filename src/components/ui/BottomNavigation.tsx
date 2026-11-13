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
import { cssVars, iconSizeValues } from '../../design-tokens'
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
    // deckend: `surface` ist im dunklen Thema nur 5 % Weiß, Inhalt (Ergebniskästen, Texte) schien durch die Leiste (@OB-084, C-VERWALTUNG-NAV-DURCHSCHEINEND)
    background: cssVars.colors.surfaceSolid,
    borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: cssVars.zIndex.navigation,
    height: cssVars.layoutHeights.bottomNav,
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
    background: isActive ? `linear-gradient(to bottom, ${cssVars.colors.surfaceHover}, transparent)` : 'transparent', // Subtle background indication
    border: 'none',
    borderTop: isActive ? `${cssVars.borderWidth.medium} solid ${cssVars.colors.primary}` : `${cssVars.borderWidth.medium} solid transparent`, // Top border indicator
    color: isActive ? cssVars.colors.primary : cssVars.colors.textSecondary,
    transition: 'all 0.2s ease',
    gap: cssVars.spacing.xs,
    // Touch target minimum 44px
    minWidth: cssVars.touchTargets.minimum,
    minHeight: cssVars.touchTargets.minimum,
  });

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    lineHeight: 1,
    marginTop: cssVars.spacing.xs,
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
            data-testid={`bottom-nav-${item.id}`}
            style={itemStyle(isActive)}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <IconComponent
              size={iconSizeValues.md}
              color={isActive ? cssVars.colors.primary : cssVars.colors.textSecondary}
            />
            <span style={labelStyle}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
