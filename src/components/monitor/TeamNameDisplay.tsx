/**
 * TeamNameDisplay - Team name for stadium-grade monitor display
 *
 * Phase 1: CSS-based truncation for long names.
 * Phase 3: Will integrate generateDisplayNames() for smart abbreviation.
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 15
 */

import { CSSProperties } from 'react';
import { cssVars, displayFontSizes } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';

export interface TeamNameDisplayProps {
  /** Full team name */
  name: string;
  /** Size variant */
  size?: 'md' | 'lg' | 'xl';
  /** Theme (dark/light/auto) */
  theme?: MonitorTheme;
  /** Max width constraint (CSS value) */
  maxWidth?: string;
}

const sizeConfig = {
  md: { fontSize: '28px' },
  lg: { fontSize: '42px' },
  xl: { fontSize: displayFontSizes.teamName },
} as const;

export const TeamNameDisplay: React.FC<TeamNameDisplayProps> = ({
  name,
  size = 'xl',
  theme = 'dark',
  maxWidth = '100%',
}) => {
  const { themeColors } = useMonitorTheme(theme);
  const config = sizeConfig[size];

  const nameStyle: CSSProperties = {
    fontSize: config.fontSize,
    fontWeight: 700,
    color: themeColors.text,
    fontFamily: cssVars.fontFamilies.display,
    textAlign: 'center',
    maxWidth,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textShadow: themeColors.textShadow,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  };

  return (
    <div style={nameStyle} title={name}>
      {name}
    </div>
  );
};
