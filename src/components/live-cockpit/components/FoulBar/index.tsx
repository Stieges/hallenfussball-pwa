/**
 * FoulBar - Foul counter display
 *
 * Based on mockup: scoreboard-mobile.html, scoreboard-desktop.html
 * Shows foul counts for both teams with warning/danger styling
 */

import { type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';

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
      padding: `2px ${spacing.sm}`,
      borderRadius: borderRadius.sm,
      fontWeight: fontWeights.bold,
      fontSize: fontSizes.sm,
    };

    if (fouls >= 5) {
      return {
        ...baseStyle,
        background: colors.dangerHighlight,
        color: colors.error,
      };
    }
    if (fouls >= 4) {
      return {
        ...baseStyle,
        background: colors.warningBannerBg,
        color: colors.warning,
      };
    }
    return {
      ...baseStyle,
      background: colors.surfaceElevated,
      color: colors.textPrimary,
    };
  };

  // ---------------------------------------------------------------------------
  // Bar variant (mobile - separate row)
  // ---------------------------------------------------------------------------

  if (variant === 'bar') {
    const containerStyle: CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      padding: `${spacing.sm} ${spacing.md}`,
      background: colors.surfaceSolid,
      borderBottom: `1px solid ${colors.borderSolid}`,
      fontSize: fontSizes.xs,
    };

    const teamStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
    };

    const labelStyle: CSSProperties = {
      color: colors.textMuted,
      textTransform: 'uppercase',
      fontSize: '11px',
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
    gap: spacing.md,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  };

  return (
    <div style={inlineStyle}>
      <span style={{ color: colors.textSecondary }}>Fouls:</span>
      <span style={getFoulStyle(homeFouls)}>{homeFouls}</span>
      <span style={{ color: colors.textMuted }}>–</span>
      <span style={getFoulStyle(awayFouls)}>{awayFouls}</span>
    </div>
  );
};

export default FoulBar;
