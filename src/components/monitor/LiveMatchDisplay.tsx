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

import { CSSProperties, useState, useCallback } from 'react';
import { cssVars, displayLayout, criticalPhaseColors, type MonitorThemeColors } from '../../design-tokens';
import type { CriticalPhase } from '../../design-tokens/display';
import type { MonitorTheme, LiveColorScheme } from '../../types/monitor';
import { DEFAULT_LIVE_COLOR_SCHEME } from '../../types/monitor';
import { LiveMatch, MatchStatus } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';
import { MatchTimer } from './MatchTimer';
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
}) => {
  const { themeColors } = useMonitorTheme(theme);
  const scheme = colorScheme ?? DEFAULT_LIVE_COLOR_SCHEME;
  const statusInfo = getStatusInfo(match.status, themeColors);
  const isRunning = match.status === 'RUNNING';
  const isPaused = match.status === 'PAUSED';

  // Critical phase for pulsing border
  const [criticalPhase, setCriticalPhase] = useState<CriticalPhase>('normal');
  const handleCriticalPhaseChange = useCallback((phase: CriticalPhase) => {
    setCriticalPhase(phase);
  }, []);
  const isPulsing = criticalPhase === 'final' || criticalPhase === 'countdown';

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
    border: fullscreen
      ? isPulsing ? `4px solid ${criticalPhaseColors.critical}` : 'none'
      : `4px solid ${isPulsing ? criticalPhaseColors.critical : isRunning ? themeColors.borderActive : themeColors.border}`,
    boxShadow: isPulsing
      ? `0 0 30px ${criticalPhaseColors.pulseGlow}, 0 0 60px ${criticalPhaseColors.pulseGlow}`
      : fullscreen ? 'none' : isRunning ? themeColors.glowActive : cssVars.shadows.lg,
    animation: isPulsing
      ? 'borderPulse 0.8s ease-in-out infinite'
      : isRunning && !fullscreen ? 'matchGlow 3s ease-in-out infinite' : undefined,
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

  const scoreAreaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.blockGap,
    width: '100%',
    flex: `0 0 ${layout.score}`,
    minHeight: 0,
  };

  const separatorStyle: CSSProperties = {
    fontSize: size === 'xl' ? 'clamp(80px, 10vw, 140px)' : '64px',
    fontWeight: 700,
    color: themeColors.text,
    opacity: 0.8,
    userSelect: 'none',
    flexShrink: 0,
  };

  const teamsAreaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: layout.blockGap,
    width: '100%',
    height: layout.teamNames,
    flexShrink: 0,
    paddingTop: cssVars.spacing.md,
  };

  const teamNameContainerStyle: CSSProperties = {
    width: layout.blockWidth,
    display: 'flex',
    justifyContent: 'center',
  };

  const timerAreaStyle: CSSProperties = {
    width: '100%',
    maxWidth: '700px',
    height: layout.timer,
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
              Gruppe {group ?? match.group}
            </div>
          )}
        </div>

        {/* Score Area: [Home Block] : [Away Block] */}
        <div style={scoreAreaStyle}>
          <ScoreBlock
            score={match.homeScore}
            backgroundColor={homeColor}
            position="home"
            size={size}
          />
          <span style={separatorStyle}>:</span>
          <ScoreBlock
            score={match.awayScore}
            backgroundColor={awayColor}
            position="away"
            size={size}
          />
        </div>

        {/* Team Names */}
        <div style={teamsAreaStyle}>
          <div style={teamNameContainerStyle}>
            <TeamNameDisplay
              name={match.homeTeam.name}
              size={size}
              theme={theme}
              maxWidth="100%"
            />
          </div>
          <div style={teamNameContainerStyle}>
            <TeamNameDisplay
              name={match.awayTeam.name}
              size={size}
              theme={theme}
              maxWidth="100%"
            />
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
              onCriticalPhaseChange={handleCriticalPhaseChange}
            />
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
        @keyframes borderPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(253, 224, 71, 0.6), 0 0 60px rgba(253, 224, 71, 0.3); }
          50% { box-shadow: 0 0 50px rgba(253, 224, 71, 0.9), 0 0 100px rgba(253, 224, 71, 0.5); }
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
