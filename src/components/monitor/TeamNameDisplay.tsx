/**
 * TeamNameDisplay - Team name for stadium-grade monitor display
 *
 * Der Name kommt aus `monitorTeamName` (MS1, @ZM-087, @ZM-149): Vereinswörter nach fester Liste gekürzt, sonst
 * der volle Name; nie Kürzel aus Anfangsbuchstaben, nie „…“. Er umbricht an Leerzeichen auf höchstens zwei Zeilen.
 * Größe xl (Live-Folie): die Schrift passt sich zwischen 3 % der Bildschirmhöhe und der Vorgabe an
 * (die Folien-Teilung bei Platzmangel kommt mit MS3).
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 15
 */

import { CSSProperties, useEffect, useRef } from 'react';
import { cssVars, displayFontSizes } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';
import { monitorTeamName } from '../../core/models/teamNameAbbrev';
import { TEAM_NAME_ZEILENHOEHE, useTeamNameFit } from './teamNameFit';

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
  /** Hinterlegter Kurzname (hat Vorrang vor der Kürzung nach Liste) */
  shortName?: string | null;
  /** Ende (Mockup K5g): Verlierer zurückgenommen (Textfarbe zweiter Ordnung, 600), Sieger in voller Stärke (800) */
  emphasis?: 'winner' | 'loser';
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
  fontSize,
  sizePx,
  onFitPx,
  shortName,
  emphasis,
}) => {
  const { themeColors } = useMonitorTheme(theme);
  const config = { fontSize: fontSize ?? sizeConfig[size].fontSize };
  const ref = useRef<HTMLDivElement>(null);

  const displayText = monitorTeamName(name, shortName);
  const passtAnpassen = size === 'xl';
  const wahl = useTeamNameFit(ref, [displayText], passtAnpassen, config.fontSize, sizePx);
  const eigenPx = wahl?.px;
  useEffect(() => {
    if (eigenPx !== undefined && Number.isFinite(eigenPx)) { onFitPx?.(eigenPx); }
  }, [eigenPx, onFitPx]);

  const nameStyle: CSSProperties = {
    fontSize: config.fontSize,
    fontWeight: emphasis === 'winner' ? cssVars.fontWeights.extrabold : emphasis === 'loser' ? cssVars.fontWeights.semibold : cssVars.fontWeights.bold,
    color: emphasis === 'loser' ? themeColors.textSecondary : themeColors.text,
    fontFamily: cssVars.fontFamilies.body,
    textAlign: 'center',
    maxWidth,
    width: passtAnpassen ? '100%' : undefined,
    textShadow: themeColors.textShadow,
    letterSpacing: '-0.01em',
    lineHeight: TEAM_NAME_ZEILENHOEHE,
    overflowWrap: 'normal',
    whiteSpace: 'normal',
  };

  return (
    <div ref={ref} style={nameStyle} title={name} data-teamname data-fit-vorgabe={config.fontSize}>
      {displayText}
    </div>
  );
};
