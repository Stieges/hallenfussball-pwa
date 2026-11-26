/**
 * Maße und Farben der Tabelle „Platzierung über alle Gruppen“ (aus `TabellenTab.tsx` herausgelöst, ohne Änderung).
 * Handy und breite Ansicht unterscheiden sich nur in Polster und Schriftgröße (`isMobile`).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import type { Medal } from '../tabellenAnsicht';

export interface RankingStyles {
  table: CSSProperties;
  th: CSSProperties;
  /** Spalten mit Kurzform im Kopf (@OB-075): nur so breit wie der Inhalt. */
  fixedTh: CSSProperties;
  td: CSSProperties;
}

export function rankingStyles(isMobile: boolean): RankingStyles {
  const th: CSSProperties = {
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    padding: isMobile ? '8px 6px' : '12px 16px',
    textAlign: 'left',
    fontWeight: cssVars.fontWeights.semibold,
    borderBottom: `2px solid ${cssVars.colors.border}`,
    fontSize: isMobile ? '12px' : cssVars.fontSizes.md,
  };
  return {
    table: { width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '14px' : cssVars.fontSizes.md },
    th,
    fixedTh: { ...th, width: '1%', textAlign: 'center', whiteSpace: 'nowrap' },
    td: {
      padding: isMobile ? '10px 6px' : '12px 16px',
      borderBottom: `1px solid ${cssVars.colors.border}`,
      color: cssVars.colors.textPrimary,
    },
  };
}

const medalColor: Record<Medal, string> = {
  gold: cssVars.colors.medalGold, silver: cssVars.colors.medalSilver, bronze: cssVars.colors.medalBronze, none: cssVars.colors.surface,
};

export function medalStyle(medal: Medal, isMobile: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: isMobile ? '28px' : '32px',
    height: isMobile ? '28px' : '32px',
    borderRadius: '50%',
    fontWeight: cssVars.fontWeights.bold,
    fontSize: isMobile ? '12px' : cssVars.fontSizes.md,
    background: medalColor[medal],
    color: medal === 'none' ? cssVars.colors.textPrimary : cssVars.colors.onWarning,
  };
}
