/**
 * TeamNameDisplay - Team name for stadium-grade monitor display
 *
 * Größe xl (Live-Folie, @ZM-087): der volle Name steht da, umbricht auf höchstens zwei Zeilen, und die
 * Schrift passt sich zwischen 3 % der Bildschirmhöhe und der Vorgabe an. Passt auch das nicht, kommt der
 * Kurzname, und nur zuletzt wird gekürzt (@ZM-088).
 * Größen md und lg: wie bisher, Kürzung über die Auswahl nach Zeichen (teamDisplayNames).
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 15
 */

import { CSSProperties, useEffect, useRef } from 'react';
import { cssVars, displayFontSizes } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';
import { getDisplayNames, selectVariant } from '../../utils/teamDisplayNames';
import { TEAM_NAME_MAX_ZEILEN, TEAM_NAME_ZEILENHOEHE, useTeamNameFit } from './teamNameFit';

export interface TeamNameDisplayProps {
  /** Full team name */
  name: string;
  /** Size variant */
  size?: 'md' | 'lg' | 'xl';
  /** Theme (dark/light/auto) */
  theme?: MonitorTheme;
  /** Max width constraint (CSS value) */
  maxWidth?: string;
  /** Schriftgröße (CSS) statt der Vorgabe der Größe, z. B. große Namen im Kindermodus (B-44a2) */
  fontSize?: string;
  /** B3: gemeinsame Größe beider Namen (px), vom Elternteil aus beiden Messungen gewählt */
  sizePx?: number;
  /** B3: meldet die eigene passende Größe (px) an das Elternteil */
  onFitPx?: (px: number) => void;
  /** Override: force a specific variant */
  variant?: 'full' | 'medium' | 'short';
}

/** Max characters that fit per size (md/lg; xl passt die Schrift an, siehe teamNameFit) */
const MAX_CHARS_BY_SIZE = { md: 10, lg: 14 } as const;

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
  fontSize,
  sizePx,
  onFitPx,
  variant,
}) => {
  const { themeColors } = useMonitorTheme(theme);
  const config = { fontSize: fontSize ?? sizeConfig[size].fontSize };
  const ref = useRef<HTMLDivElement>(null);

  const displayNames = getDisplayNames(name);
  const passtAnpassen = size === 'xl' && !variant;
  const wahl = useTeamNameFit(
    ref,
    [displayNames.full, displayNames.medium, displayNames.short],
    passtAnpassen,
    config.fontSize,
    sizePx,
  );
  const eigenPx = wahl?.px;
  useEffect(() => {
    if (eigenPx !== undefined && Number.isFinite(eigenPx)) { onFitPx?.(eigenPx); }
  }, [eigenPx, onFitPx]);

  let displayText: string;
  if (variant) {
    displayText = displayNames[variant];
  } else if (passtAnpassen) {
    displayText = wahl?.text ?? displayNames.full;
  } else {
    displayText = selectVariant(displayNames, MAX_CHARS_BY_SIZE[size === 'md' ? 'md' : 'lg']);
  }

  const nameStyle: CSSProperties = {
    fontSize: config.fontSize,
    fontWeight: 700,
    color: themeColors.text,
    fontFamily: cssVars.fontFamilies.body,
    textAlign: 'center',
    maxWidth,
    width: passtAnpassen ? '100%' : undefined,
    textShadow: themeColors.textShadow,
    letterSpacing: '-0.01em',
    lineHeight: TEAM_NAME_ZEILENHOEHE,
    ...(passtAnpassen
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: TEAM_NAME_MAX_ZEILEN,
          overflow: 'hidden',
          overflowWrap: 'normal',
          whiteSpace: 'normal',
        }
      : {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }),
  };

  return (
    <div ref={ref} style={nameStyle} title={name} data-fit-vorgabe={config.fontSize}>
      {displayText}
    </div>
  );
};
