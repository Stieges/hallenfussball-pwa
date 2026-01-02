/**
 * FoulBar - Foul counter display
 *
 * Based on mockup: scoreboard-mobile.html, scoreboard-desktop.html
 * Shows foul counts for both teams with warning/danger styling
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FoulBarProps {
  homeTeamName: string;
  awayTeamName: string;
  homeFouls: number;
  awayFouls: number;
  variant?: 'inline' | 'bar';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FoulBar: React.FC<FoulBarProps> = ({
  homeTeamName,
  awayTeamName,
  homeFouls,
  awayFouls,
  variant = 'bar',
}) => {
  const getFoulStyle = (fouls: number): CSSProperties => {
    const baseStyle: CSSProperties = {
      padding: `2px ${cssVars.spacing.sm}`,
      borderRadius: cssVars.borderRadius.sm,
      fontWeight: cssVars.fontWeights.bold,
      fontSize: cssVars.fontSizes.sm,
    };

    if (fouls >= 5) {
      return {
        ...baseStyle,
        background: cssVars.colors.dangerHighlight,
        color: cssVars.colors.error,
      };
    }
    if (fouls >= 4) {
      return {
        ...baseStyle,
        background: cssVars.colors.warningBannerBg,
        color: cssVars.colors.warning,
      };
    }
    return {
      ...baseStyle,
      background: cssVars.colors.surfaceElevated,
      color: cssVars.colors.textPrimary,
    };
  };

  // ---------------------------------------------------------------------------
  // Bar variant (mobile - separate row)
  // ---------------------------------------------------------------------------

  if (variant === 'bar') {
    const containerStyle: CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
      background: cssVars.colors.surfaceSolid,
      borderBottom: `1px solid ${cssVars.colors.borderSolid}`,
      fontSize: cssVars.fontSizes.xs,
    };

    const teamStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: cssVars.spacing.sm,
    };

    const labelStyle: CSSProperties = {
      color: cssVars.colors.textMuted,
      textTransform: 'uppercase',
      fontSize: cssVars.fontSizes.xs,
    };

    return (
      <div style={containerStyle}>
        <div style={teamStyle}>
          <span>{homeTeamName}</span>
          <span style={getFoulStyle(homeFouls)}>{homeFouls}</span>
        </div>
        <span style={labelStyle}>FOULS</span>
        <div style={teamStyle}>
          <span style={getFoulStyle(awayFouls)}>{awayFouls}</span>
          <span>{awayTeamName}</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Inline variant (desktop - in match header)
  // ---------------------------------------------------------------------------

  const inlineStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
  };

  return (
    <div style={inlineStyle}>
      <span style={{ color: cssVars.colors.textSecondary }}>Fouls:</span>
      <span style={getFoulStyle(homeFouls)}>{homeFouls}</span>
      <span style={{ color: cssVars.colors.textMuted }}>–</span>
      <span style={getFoulStyle(awayFouls)}>{awayFouls}</span>
    </div>
  );
};

export default FoulBar;
