/**
 * LiveMatchDisplay - Stadium-Grade scoreboard for monitor display
 *
 * Layout optimized for 30-40m viewing distance on 55-75" TVs:
 * - Header (8%):  LIVE badge, field, group
 * - Score (55%):  Two colored blocks with score numbers
 * - Teams (12%):  Team names centered below score blocks
 * - Timer (17%):  Large centered timer with progress bar
 * - Footer (8%):  Referee info
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout } from '../../design-tokens';
import type { MonitorTheme, LiveColorScheme } from '../../types/monitor';
import { DEFAULT_LIVE_COLOR_SCHEME } from '../../types/monitor';
import { LiveMatch } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';
import { MatchTimer } from './MatchTimer';
import { TEAM_NAME_ZEILENHOEHE } from './teamNameFit';
import type { ClockMode } from '../../core/match/clockDisplay';
import { ScoreBlock } from './ScoreBlock';
import { TeamNameDisplay } from './TeamNameDisplay';
import { getStatusInfo } from './liveStatus';
import { getBlockFrame } from './liveBlockFrame';

export { NoMatchDisplay } from './NoMatchDisplay';
export type { NoMatchDisplayProps } from './NoMatchDisplay';

export interface LiveMatchDisplayProps {
  /** The live match to display */
  match: LiveMatch;
  /** Optional group name */
  group?: string;
  /** Size variant */
  size?: 'md' | 'lg' | 'xl';
  /** Whether in fullscreen mode (uses 100% height) */
  fullscreen?: boolean;
  /** Theme (dark/light/auto) */
  theme?: MonitorTheme;
  /** Color scheme for position colors (home/away blocks) */
  colorScheme?: LiveColorScheme;
  /** Kindermodus (B-16e2, @W2A-031): ohne Stand, Paarung/Uhr/Phase bleiben */
  hideScore?: boolean;
  /** Uhr-Art des Turniers (@ZM-137) */
  clockMode?: ClockMode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve team color: team color (if enabled + available) → scheme color
 */
function resolveColor(
  position: 'home' | 'away',
  scheme: LiveColorScheme,
  team?: { colors?: { primary?: string } },
): string {
  if (scheme.useTeamColors && team?.colors?.primary) {
    return team.colors.primary;
  }
  return position === 'home' ? scheme.homeColor : scheme.awayColor;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LiveMatchDisplay: React.FC<LiveMatchDisplayProps> = ({
  match,
  group,
  size = 'xl',
  fullscreen = false,
  theme = 'dark',
  colorScheme,
  hideScore = false,
  clockMode,
}) => {
  const { t } = useTranslation('monitor');
  const { themeColors } = useMonitorTheme(theme);
  const scheme = colorScheme ?? DEFAULT_LIVE_COLOR_SCHEME;
  const statusInfo = getStatusInfo(match.status, themeColors);
  const isRunning = match.status === 'RUNNING';
  const isPaused = match.status === 'PAUSED';

  const homeColor = resolveColor('home', scheme, match.homeTeam);
  const awayColor = resolveColor('away', scheme, match.awayTeam);

  const layout = displayLayout.scoreArea;

  // --- Styles ---------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: fullscreen ? '100%' : 'auto',
    minHeight: fullscreen ? '100%' : size === 'xl' ? '70vh' : '50vh',
    padding: fullscreen ? `${layout.paddingY} clamp(24px, 3vw, 48px)` : cssVars.spacing.xxl,
    background: themeColors.backgroundGradient,
    borderRadius: fullscreen ? 0 : cssVars.borderRadius.xl,
    border: fullscreen ? 'none' : `4px solid ${isRunning ? themeColors.borderActive : themeColors.border}`,
    boxShadow: fullscreen ? 'none' : isRunning ? themeColors.glowActive : cssVars.shadows.lg,
    animation: isRunning && !fullscreen ? 'matchGlow 3s ease-in-out infinite' : undefined,
    position: 'relative',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: layout.header,
    marginBottom: layout.headerGap,
    flexShrink: 0,
  };

  // @ZM-140 Raster: Kasten (Zeile 1) und Namen (Zeile 2) teilen sich ein Raster, Spalten 1 | 2 | 3
  // B-44a2: Zeile 1 hat die feste Kastenhöhe (auch im Kindermodus, gleiche Lage), Zeile 2 reserviert zwei Namenszeilen
  const nameRowHeight = `calc(${displayFontSizes.teamName} * ${TEAM_NAME_ZEILENHOEHE * layout.nameLines})`;
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${layout.separatorWidth} minmax(0, 1fr)`,
    gridTemplateRows: `${layout.blockHeight} ${nameRowHeight}`,
    columnGap: layout.blockGap,
    rowGap: layout.teamNamesGap,
    alignItems: 'center',
    width: '100%',
    flexShrink: 0,
  };

  // B-44a2: Doppelpunkt genau mittig – Zelle ohne Breite, Flex mit Mitte lässt das Zeichen nach beiden Seiten gleich überstehen
  const separatorStyle: CSSProperties = {
    gridRow: 1,
    gridColumn: 2,
    display: 'flex',
    justifyContent: 'center',
    justifySelf: 'center',
    alignSelf: 'center',
    width: 0,
    fontSize: size === 'xl' ? 'clamp(80px, 10vw, 140px)' : '64px',
    fontWeight: 700,
    lineHeight: 1,
    color: themeColors.text,
    opacity: 0.8,
    userSelect: 'none',
  };

  const blockCellStyle = (column: 1 | 3): CSSProperties => ({
    gridRow: 1,
    gridColumn: column,
    display: 'flex',
    justifyContent: 'center',
    justifySelf: 'center',
    width: layout.blockWidth,
    height: layout.blockHeight,
    minWidth: 0,
  });

  // B-44a2: Namen oben bündig unter dem Kasten, höchstens so breit wie der Kasten; im Kindermodus mittig über beide Zeilen (kein Kasten darüber)
  const nameCellStyle = (column: 1 | 3): CSSProperties => ({
    gridRow: hideScore ? '1 / 3' : 2,
    gridColumn: column,
    justifySelf: 'center',
    alignSelf: hideScore ? 'center' : 'start',
    width: layout.teamNameWidth,
    display: 'flex',
    justifyContent: 'center',
    minWidth: 0,
    maxWidth: '100%',
  });

  // B-44a2: unterer Bereich (Uhr, Balken, Hinweise) hat in jedem Zustand dieselbe Höhe, der Block verschiebt sich nicht
  const timerAreaStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: layout.lowerHeight,
    paddingTop: layout.lowerPaddingTop,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
  };

  const footerStyle: CSSProperties = {
    height: layout.footer,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.xl}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: statusInfo.bgColor,
    color: statusInfo.color,
    fontSize: size === 'xl' ? '20px' : '16px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    animation: isRunning ? 'livePulse 1.5s ease-in-out infinite' : undefined,
  };

  const liveDotStyle: CSSProperties = {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: statusInfo.color,
    boxShadow: isRunning ? `0 0 8px ${statusInfo.color}` : undefined,
    animation: isRunning ? 'liveDotPulse 1s ease-in-out infinite' : undefined,
  };

  const infoStyle: CSSProperties = {
    fontSize: size === 'xl' ? 'clamp(24px, 2.5vw, 36px)' : '20px',
    fontWeight: 600,
    color: themeColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };

  // --- Render ---------------------------------------------------------------

  return (
    <>
      <div style={containerStyle}>
        {/* Header: LIVE badge | Field | Group */}
        <div style={headerStyle}>
          <div style={badgeStyle}>
            {isRunning && <span style={liveDotStyle} />}
            {statusInfo.label}
          </div>
          <div style={infoStyle}>
            Feld {match.field ?? 1} — Spiel {match.number}
          </div>
          {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: show if either has value */}
          {(group || match.group) && (
            <div style={{ ...infoStyle, color: themeColors.text }}>
              {t('liveMatch.group', { group: group ?? match.group })}
            </div>
          )}
        </div>

        {/* Raster: Kästen, Trenner, Namen mittig unter ihrem Kasten (@ZM-140); Kindermodus ohne Kästen */}
        <div style={gridStyle} data-testid="live-grid">
          {!hideScore && (
            <div style={blockCellStyle(1)} data-testid="live-block-home">
              <ScoreBlock
                score={match.homeScore}
                backgroundColor={homeColor}
                position="home"
                size={size}
                frame={getBlockFrame(homeColor, themeColors.background, themeColors.text)}
              />
            </div>
          )}
          {!hideScore && (
            <span style={separatorStyle} data-testid="live-separator">:</span>
          )}
          {!hideScore && (
            <div style={blockCellStyle(3)} data-testid="live-block-away">
              <ScoreBlock
                score={match.awayScore}
                backgroundColor={awayColor}
                position="away"
                size={size}
                frame={getBlockFrame(awayColor, themeColors.background, themeColors.text)}
              />
            </div>
          )}
          <div style={nameCellStyle(1)} data-testid="live-name-home">
            <TeamNameDisplay name={match.homeTeam.name} size={size} theme={theme} maxWidth="100%" />
          </div>
          <div style={nameCellStyle(3)} data-testid="live-name-away">
            <TeamNameDisplay name={match.awayTeam.name} size={size} theme={theme} maxWidth="100%" />
          </div>
        </div>

        {/* Unterer Bereich: feste Höhe in jedem Zustand (B-44a2); H2: nach dem Abpfiff keine Uhr, nur das Endergebnis */}
        <div style={timerAreaStyle} data-testid="live-lower">
          {(isRunning || isPaused) && (
            <MatchTimer
              elapsedSeconds={match.elapsedSeconds}
              durationSeconds={match.durationSeconds}
              status={match.status}
              size={size}
              showProgress
              timerStartTime={match.timerStartTime}
              timerElapsedSeconds={match.timerElapsedSeconds}
              theme={theme}
              clockMode={clockMode}
            />
          )}
          {/* Kindermodus (@W2A-031): lesbar in Textfarbe, mit Abstand zur Uhr */}
          {hideScore && (
            <div
              data-testid="live-without-result"
              style={{
                fontSize: displayFontSizes.clockHint,
                color: themeColors.text,
                textAlign: 'center',
                marginTop: layout.hintGapAbove,
              }}
            >
              {t('liveMatch.withoutResult')}
            </div>
          )}
        </div>

        {/* Footer: Referee */}
        {match.refereeName && (
          <div style={footerStyle}>
            <span style={{ ...infoStyle, fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>
              Schiedsrichter: {match.refereeName}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes matchGlow {
          0%, 100% { box-shadow: ${themeColors.glow}; }
          50% { box-shadow: ${themeColors.glowActive}; }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes liveDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </>
  );
};

