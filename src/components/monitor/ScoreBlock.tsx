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
import { scoreDigitFontSize } from './scoreDigitSize';
import type { BlockFrame } from './liveBlockFrame';

export interface ScoreBlockProps {
  /** Score number to display */
  score: number;
  /** Block background color (hex) */
  backgroundColor: string;
  /** Position for semantic clarity */
  position: 'home' | 'away';
  /** Size variant */
  size?: 'md' | 'lg' | 'xl';
  /** Kindermodus (B-16e2, @W2A-031): Stand verbergen, der farbige Block bleibt */
  hideScore?: boolean;
  /** Rahmen (B-44a2): dezent, bei zu geringem Kontrast zum Hintergrund kräftig (@ZM-140) */
  frame?: BlockFrame;
  /** Ende (Mockup K5g): Sieger-Kasten mit Ring in `ringColor`, Verlierer abgedunkelt */
  outcome?: 'winner' | 'loser';
  ringColor?: string;
  /** Schleierfarbe des Verlierers (Hintergrund der Folie, Anteil `loserDimShare`) */
  dimColor?: string;
}

/** Dezenter Schleier statt Scrim (Mockup K5g `--lose-ov`): Folienhintergrund mit `loserDimShare` Deckkraft */
function loserVeil(dimColor: string | undefined): string {
  const schleier = `color-mix(in srgb, ${dimColor ?? cssVars.colors.background} ${displayLayout.scoreArea.loserDimShare}, transparent)`;
  return `linear-gradient(${schleier}, ${schleier})`;
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
    // B-17 Fixrunde: keine Mindesthöhe, der Stand passt sich der Flex-Fläche an (sonst überlagert er die Kopfzeile bei 600 px Höhe)
    minHeight: '0px',
  },
} as const;

export const ScoreBlock: React.FC<ScoreBlockProps> = ({
  score,
  backgroundColor,
  position,
  size = 'xl',
  hideScore = false,
  frame,
  outcome,
  ringColor,
  dimColor,
}) => {
  const textColor = getScoreTextColor(backgroundColor);
  const config = sizeConfig[size];

  const blockStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', // die Zelle im Raster bestimmt die Breite (displayLayout.scoreArea.blockWidth)
    // Controller-Zusatz H3: Ziffern richten sich nach dem Kasten (nur Live-Monitor, size xl)
    containerType: size === 'xl' ? 'size' : undefined,
    minHeight: config.minHeight,
    height: '100%',
    backgroundColor,
    borderRadius: config.borderRadius,
    boxSizing: 'border-box',
    border: frame ? `${frame.width} solid ${frame.color}` : undefined,
    ...(outcome === 'winner' ? { outline: `${displayLayout.scoreArea.frameWidthStrong} solid ${ringColor}`, outlineOffset: displayLayout.scoreArea.frameWidthSubtle } : {}),
    ...(outcome === 'loser' ? { backgroundImage: loserVeil(dimColor) } : {}),
    position: 'relative',
    overflow: 'hidden',
  };

  const scoreStyle: CSSProperties = {
    fontSize: size === 'xl' ? scoreDigitFontSize() : config.fontSize,
    fontWeight: 700,
    color: textColor,
    fontFamily: cssVars.fontFamilies.body,
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
      data-outcome={outcome}
      aria-label={hideScore ? (position === 'home' ? 'Heim' : 'Gast') : `${position === 'home' ? 'Heim' : 'Gast'}: ${score}`}
    >
      <div style={glowStyle} />
      {!hideScore && <span style={scoreStyle} data-monitor="stand">{score}</span>}
    </div>
  );
};
