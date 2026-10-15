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
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../design-tokens';
import { needsContrastFrame } from '../../design-tokens/display';
import type { MonitorTheme, LiveColorScheme } from '../../types/monitor';
import { DEFAULT_LIVE_COLOR_SCHEME } from '../../types/monitor';
import { LiveMatch, MatchStatus } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';
import { MatchTimer } from './MatchTimer';
import type { ClockMode } from '../../core/match/clockDisplay';
import { ScoreBlock } from './ScoreBlock';
import { TeamNameDisplay } from './TeamNameDisplay';

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

function getStatusInfo(
  status: MatchStatus,
  themeColors: MonitorThemeColors
): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'RUNNING':
      return { label: 'LIVE', color: themeColors.liveBadgeText, bgColor: themeColors.liveBadgeBg };
    case 'PAUSED':
      return { label: 'PAUSE', color: themeColors.pauseBadgeText, bgColor: themeColors.pauseBadgeBg };
    case 'FINISHED':
      return { label: 'BEENDET', color: themeColors.textSecondary, bgColor: themeColors.border };
    case 'NOT_STARTED':
    default:
      return { label: 'WARTET', color: themeColors.textSecondary, bgColor: themeColors.border };
  }
}

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
    padding: fullscreen ? 'clamp(24px, 3vw, 48px)' : cssVars.spacing.xxl,
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
    flexShrink: 0,
  };

  // @ZM-140 Raster: Kasten (Zeile 1) und Namen (Zeile 2) teilen sich ein Raster, Spalten 1 | 2 | 3
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${layout.separatorWidth} minmax(0, 1fr)`,
    columnGap: layout.blockGap,
    rowGap: layout.teamNamesGap,
    alignItems: 'center',
    width: '100%',
    flexShrink: 0,
  };

  const separatorStyle: CSSProperties = {
    gridRow: 1,
    gridColumn: 2,
    fontSize: size === 'xl' ? 'clamp(80px, 10vw, 140px)' : '64px',
    fontWeight: 700,
    color: themeColors.text,
    opacity: 0.8,
    userSelect: 'none',
    textAlign: 'center',
  };

  const blockCellStyle = (column: 1 | 3): CSSProperties => ({
    gridRow: 1,
    gridColumn: column,
    display: 'flex',
    justifyContent: 'center',
    height: '100%',
    minWidth: 0,
  });

  const nameCellStyle = (column: 1 | 3, row: number): CSSProperties => ({
    gridRow: row,
    gridColumn: column,
    justifySelf: 'center',
    display: 'flex',
    justifyContent: 'center',
    minWidth: 0,
    maxWidth: '100%',
  });

  const timerAreaStyle: CSSProperties = {
    width: '100%',
    maxWidth: '700px',
    minHeight: layout.timer,
    display: 'flex',
    alignItems: 'center',
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
                frameColor={needsContrastFrame(homeColor, themeColors.background) ? themeColors.text : undefined}
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
                frameColor={needsContrastFrame(awayColor, themeColors.background) ? themeColors.text : undefined}
              />
            </div>
          )}
          <div style={nameCellStyle(1, hideScore ? 1 : 2)} data-testid="live-name-home">
            <TeamNameDisplay name={match.homeTeam.name} size={size} theme={theme} maxWidth="100%" />
          </div>
          <div style={nameCellStyle(3, hideScore ? 1 : 2)} data-testid="live-name-away">
            <TeamNameDisplay name={match.awayTeam.name} size={size} theme={theme} maxWidth="100%" />
          </div>
        </div>

        {/* Timer */}
        {(isRunning || isPaused || match.status === 'FINISHED') && (
          <div style={timerAreaStyle}>
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
          </div>
        )}

        {/* Kindermodus: klein unter der Uhr (@W2A-031) */}
        {hideScore && (
          <div style={{ fontSize: displayFontSizes.bodySM, color: themeColors.textSecondary, textAlign: 'center' }}>
            {t('liveMatch.withoutResult')}
          </div>
        )}

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

// ---------------------------------------------------------------------------
// No Match Display (unchanged)
// ---------------------------------------------------------------------------

export interface NoMatchDisplayProps {
  message?: string;
  size?: 'md' | 'lg' | 'xl';
  fullscreen?: boolean;
  theme?: MonitorTheme;
}

export const NoMatchDisplay: React.FC<NoMatchDisplayProps> = ({
  message = 'Kein laufendes Spiel',
  size = 'xl',
  fullscreen = false,
  theme = 'dark',
}) => {
  const { themeColors } = useMonitorTheme(theme);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: fullscreen ? 'clamp(32px, 4vw, 64px)' : size === 'xl' ? '64px' : cssVars.spacing.xxl,
    background: themeColors.backgroundGradient,
    borderRadius: fullscreen ? 0 : cssVars.borderRadius.xl,
    border: fullscreen ? 'none' : `3px solid ${themeColors.border}`,
    minHeight: fullscreen ? '100%' : size === 'xl' ? '50vh' : '35vh',
    height: fullscreen ? '100%' : 'auto',
    width: '100%',
    maxWidth: fullscreen ? 'none' : '1200px',
    margin: '0 auto',
    boxShadow: fullscreen ? 'none' : cssVars.shadows.lg,
  };

  return (
    <div style={containerStyle}>
      <div style={{ fontSize: size === 'xl' ? '100px' : '72px', marginBottom: cssVars.spacing.xl, opacity: 0.6 }}>
        ⏸️
      </div>
      <div style={{
        fontSize: size === 'xl' ? 'clamp(36px, 4vw, 48px)' : '28px',
        fontWeight: 600,
        color: themeColors.text,
        textAlign: 'center',
        textShadow: themeColors.textShadowLight,
      }}>
        {message}
      </div>
      <div style={{
        fontSize: size === 'xl' ? 'clamp(18px, 2vw, 24px)' : '18px',
        color: themeColors.textSecondary,
        marginTop: cssVars.spacing.lg,
        textAlign: 'center',
      }}>
        Die Tabellen werden angezeigt, bis ein Spiel gestartet wird
      </div>
    </div>
  );
};
