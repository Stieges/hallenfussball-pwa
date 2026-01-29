/**
 * ScoreBlock - Colored score block for stadium-grade monitor display
 *
 * Renders a large colored rectangle with the score number centered.
 * Text color is automatically computed from background luminance.
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 4.3
 */

import { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout, getScoreTextColor } from '../../design-tokens';

export interface ScoreBlockProps {
  /** Score number to display */
  score: number;
  /** Block background color (hex) */
  backgroundColor: string;
  /** Position for semantic clarity */
  position: 'home' | 'away';
  /** Size variant */
  size?: 'md' | 'lg' | 'xl';
}

const sizeConfig = {
  md: {
    fontSize: '72px',
    borderRadius: '12px',
    minHeight: '120px',
  },
  lg: {
    fontSize: '120px',
    borderRadius: '16px',
    minHeight: '200px',
  },
  xl: {
    fontSize: displayFontSizes.scoreXXL,
    borderRadius: '20px',
    minHeight: '280px',
  },
} as const;

export const ScoreBlock: React.FC<ScoreBlockProps> = ({
  score,
  backgroundColor,
  position,
  size = 'xl',
}) => {
  const textColor = getScoreTextColor(backgroundColor);
  const config = sizeConfig[size];

  const blockStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: displayLayout.scoreArea.blockWidth,
    minHeight: config.minHeight,
    height: '100%',
    backgroundColor,
    borderRadius: config.borderRadius,
    position: 'relative',
    overflow: 'hidden',
  };

  const scoreStyle: CSSProperties = {
    fontSize: config.fontSize,
    fontWeight: 700,
    color: textColor,
    fontFamily: cssVars.fontFamilies.display,
    lineHeight: 1,
    textShadow: `0 2px 8px rgba(0, 0, 0, 0.3)`,
    userSelect: 'none',
  };

  // Subtle inner glow for depth
  const glowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: config.borderRadius,
    boxShadow: `inset 0 0 60px rgba(255, 255, 255, 0.1)`,
    pointerEvents: 'none',
  };

  return (
    <div
      style={blockStyle}
      data-position={position}
      aria-label={`${position === 'home' ? 'Heim' : 'Gast'}: ${score}`}
    >
      <div style={glowStyle} />
      <span style={scoreStyle}>{score}</span>
    </div>
  );
};
