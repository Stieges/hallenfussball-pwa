/**
 * TeamNameDisplay - Team name for stadium-grade monitor display
 *
 * Uses smart abbreviation (3-stage cascade) to fit team names
 * into the available space based on display size.
 *
 * Cascade: full → medium → short → micro
 * CSS ellipsis remains as safety net.
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 15
 */

import { CSSProperties } from 'react';
import { cssVars, displayFontSizes } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';
import { getDisplayNames, selectVariant } from '../../utils/teamDisplayNames';

export interface TeamNameDisplayProps {
  /** Full team name */
  name: string;
  /** Size variant */
  size?: 'md' | 'lg' | 'xl';
  /** Theme (dark/light/auto) */
  theme?: MonitorTheme;
  /** Max width constraint (CSS value) */
  maxWidth?: string;
  /** Override: force a specific variant */
  variant?: 'full' | 'medium' | 'short' | 'micro';
}

/** Max characters that fit per size (heuristic based on monitor layout) */
const MAX_CHARS_BY_SIZE = { md: 10, lg: 14, xl: 18 } as const;

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
  variant,
}) => {
  const { themeColors } = useMonitorTheme(theme);
  const config = sizeConfig[size];

  const displayNames = getDisplayNames(name);
  const maxChars = MAX_CHARS_BY_SIZE[size];
  const displayText = variant
    ? displayNames[variant]
    : selectVariant(displayNames, maxChars);

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
      {displayText}
    </div>
  );
};
