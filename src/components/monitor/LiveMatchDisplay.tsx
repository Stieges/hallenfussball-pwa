/**
 * LiveMatchDisplay - TV-optimized match display for monitor view
 *
 * Features:
 * - Large, readable team names and score
 * - Field and match number info
 * - Integrated real-time timer with progress bar
 * - Running match glow animation
 * - Pause and overtime indicators
 * - Responsive sizing for different screens
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens'
import { LiveMatch, MatchStatus } from '../../hooks/useLiveMatches';
import { MatchTimer } from './MatchTimer';

export interface LiveMatchDisplayProps {
  /** The live match to display */
  match: LiveMatch;
  /** Optional group name */
  group?: string;
  /** Size variant */
  size?: 'md' | 'lg' | 'xl';
  /** Whether in fullscreen mode (uses 100% height) */
  fullscreen?: boolean;
}

/**
 * Get status label and color
 */
function getStatusInfo(status: MatchStatus): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'RUNNING':
      return {
        label: 'LIVE',
        color: cssVars.colors.statusLive,
        bgColor: 'rgba(0, 230, 118, 0.2)',
      };
    case 'PAUSED':
      return {
        label: 'PAUSE',
        color: cssVars.colors.warning,
        bgColor: 'rgba(255, 145, 0, 0.2)',
      };
    case 'FINISHED':
      return {
        label: 'BEENDET',
        color: cssVars.colors.textSecondary,
        bgColor: 'rgba(255, 255, 255, 0.1)',
      };
    case 'NOT_STARTED':
    default:
      return {
        label: 'WARTET',
        color: cssVars.colors.textSecondary,
        bgColor: 'rgba(255, 255, 255, 0.1)',
      };
  }
}

export const LiveMatchDisplay: React.FC<LiveMatchDisplayProps> = ({
  match,
  group,
  size = 'xl',
  fullscreen = false,
}) => {
  const statusInfo = getStatusInfo(match.status);
  const isRunning = match.status === 'RUNNING';
  const isPaused = match.status === 'PAUSED';

  // Size-based styling - optimized for TV viewing from distance
  const sizeStyles = {
    md: {
      teamName: '32px',
      score: '90px',
      separator: '48px',
      info: '18px',
      padding: cssVars.spacing.xl,
      timerMaxWidth: '400px',
    },
    lg: {
      teamName: '48px',
      score: '130px',
      separator: '64px',
      info: '24px',
      padding: cssVars.spacing.xxl,
      timerMaxWidth: '550px',
    },
    xl: {
      teamName: 'clamp(56px, 6vw, 80px)',
      score: 'clamp(160px, 18vw, 240px)',
      separator: 'clamp(80px, 9vw, 120px)',
      info: 'clamp(24px, 2.5vw, 36px)',
      padding: 'clamp(32px, 4vw, 64px)',
      timerMaxWidth: '700px',
    },
  };

  const currentSize = sizeStyles[size];

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: fullscreen ? 'clamp(24px, 3vw, 48px)' : currentSize.padding,
    background: fullscreen
      ? 'transparent'
      : isRunning
        ? 'linear-gradient(180deg, rgba(0, 230, 118, 0.12) 0%, rgba(0, 100, 50, 0.08) 50%, rgba(15, 23, 42, 0.9) 100%)'
        : 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
    borderRadius: fullscreen ? 0 : cssVars.borderRadius.xl,
    border: fullscreen ? 'none' : `4px solid ${isRunning ? cssVars.colors.primary : cssVars.colors.border}`,
    boxShadow: fullscreen
      ? 'none'
      : isRunning
        ? '0 0 60px rgba(0, 230, 118, 0.3), inset 0 0 40px rgba(0, 230, 118, 0.05)'
        : cssVars.shadows.lg,
    animation: isRunning && !fullscreen ? 'matchGlow 3s ease-in-out infinite' : undefined,
    minHeight: fullscreen ? '100%' : size === 'xl' ? '70vh' : size === 'lg' ? '55vh' : '40vh',
    height: fullscreen ? '100%' : 'auto',
    width: '100%',
    maxWidth: fullscreen ? 'none' : size === 'xl' ? '1400px' : '1200px',
    margin: '0 auto',
    position: 'relative',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    marginBottom: size === 'xl' ? cssVars.spacing.xxl : cssVars.spacing.xl,
  };

  const fieldInfoStyle: CSSProperties = {
    fontSize: currentSize.info,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };

  const groupInfoStyle: CSSProperties = {
    fontSize: currentSize.info,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  };

  const statusBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: size === 'xl'
      ? `${cssVars.spacing.sm} ${cssVars.spacing.xl}`
      : `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: statusInfo.bgColor,
    color: statusInfo.color,
    fontSize: size === 'xl' ? '20px' : size === 'lg' ? '16px' : '14px',
    fontWeight: cssVars.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    animation: isRunning ? 'livePulse 1.5s ease-in-out infinite' : undefined,
  };

  const matchupContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: cssVars.spacing.xl,
    marginBottom: size === 'xl' ? cssVars.spacing.xxl : cssVars.spacing.xl,
  };

  const teamContainerStyle = (side: 'home' | 'away'): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: side === 'home' ? 'flex-end' : 'flex-start',
    gap: cssVars.spacing.sm,
  });

  const teamNameStyle: CSSProperties = {
    fontSize: currentSize.teamName,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    fontFamily: cssVars.fontFamilies.heading,
    lineHeight: 1.15,
    wordBreak: 'break-word',
    maxWidth: '100%',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    letterSpacing: '-0.01em',
  };

  const scoreContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: size === 'xl' ? cssVars.spacing.xl : cssVars.spacing.lg,
    padding: size === 'xl' ? `0 ${cssVars.spacing.xxl}` : `0 ${cssVars.spacing.xl}`,
    flexShrink: 0,
  };

  const scoreStyle: CSSProperties = {
    fontSize: currentSize.score,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
    fontFamily: cssVars.fontFamilies.heading,
    minWidth: size === 'xl' ? '160px' : size === 'lg' ? '100px' : '70px',
    textAlign: 'center',
    textShadow: isRunning
      ? '0 0 30px rgba(0, 230, 118, 0.6), 0 0 60px rgba(0, 230, 118, 0.3)'
      : '0 2px 10px rgba(0, 0, 0, 0.3)',
    letterSpacing: '-0.02em',
  };

  const separatorStyle: CSSProperties = {
    fontSize: currentSize.separator,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    opacity: 0.8,
  };

  const timerContainerStyle: CSSProperties = {
    width: '100%',
    maxWidth: currentSize.timerMaxWidth,
    marginTop: size === 'xl' ? cssVars.spacing.xxl : cssVars.spacing.xl,
  };

  const liveDotStyle: CSSProperties = {
    width: size === 'xl' ? '14px' : '10px',
    height: size === 'xl' ? '14px' : '10px',
    borderRadius: '50%',
    backgroundColor: statusInfo.color,
    boxShadow: isRunning ? `0 0 8px ${statusInfo.color}` : undefined,
    animation: isRunning ? 'liveDotPulse 1s ease-in-out infinite' : undefined,
  };

  return (
    <>
      <div style={containerStyle}>
        {/* Header: Field, Group, Status */}
        <div style={headerStyle}>
          <div style={fieldInfoStyle}>
            ⚽ Feld {match.field || 1} - Spiel {match.number}
          </div>
          {(group || match.group) && (
            <div style={groupInfoStyle}>
              Gruppe {group || match.group}
            </div>
          )}
          <div style={statusBadgeStyle}>
            {isRunning && <span style={liveDotStyle} />}
            {statusInfo.label}
          </div>
        </div>

        {/* Matchup: Team A - Score - Team B */}
        <div style={matchupContainerStyle}>
          <div style={teamContainerStyle('home')}>
            <div style={{ ...teamNameStyle, textAlign: 'right' }}>
              {match.homeTeam.name}
            </div>
          </div>

          <div style={scoreContainerStyle}>
            <div style={scoreStyle}>{match.homeScore}</div>
            <div style={separatorStyle}>:</div>
            <div style={scoreStyle}>{match.awayScore}</div>
          </div>

          <div style={teamContainerStyle('away')}>
            <div style={{ ...teamNameStyle, textAlign: 'left' }}>
              {match.awayTeam.name}
            </div>
          </div>
        </div>

        {/* Timer and Progress */}
        {(isRunning || isPaused || match.status === 'FINISHED') && (
          <div style={timerContainerStyle}>
            <MatchTimer
              elapsedSeconds={match.elapsedSeconds}
              durationSeconds={match.durationSeconds}
              status={match.status}
              size={size}
              showProgress={true}
              timerStartTime={match.timerStartTime}
              timerElapsedSeconds={match.timerElapsedSeconds}
            />
          </div>
        )}

        {/* Referee info */}
        {match.refereeName && (
          <div style={{
            marginTop: cssVars.spacing.xl,
            fontSize: currentSize.info,
            color: cssVars.colors.textSecondary,
          }}>
            Schiedsrichter: {match.refereeName}
          </div>
        )}
      </div>

      <style>{`
        @keyframes matchGlow {
          0%, 100% {
            box-shadow: 0 0 40px rgba(0, 230, 118, 0.2);
          }
          50% {
            box-shadow: 0 0 60px rgba(0, 230, 118, 0.4);
          }
        }

        @keyframes livePulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes liveDotPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.8;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }

        @media (max-width: 768px) {
          /* Responsive adjustments for tablets */
        }
      `}</style>
    </>
  );
};

/**
 * Placeholder component when no match is running
 */
export interface NoMatchDisplayProps {
  message?: string;
  size?: 'md' | 'lg' | 'xl';
  fullscreen?: boolean;
}

export const NoMatchDisplay: React.FC<NoMatchDisplayProps> = ({
  message = 'Kein laufendes Spiel',
  size = 'xl',
  fullscreen = false,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: fullscreen ? 'clamp(32px, 4vw, 64px)' : size === 'xl' ? '64px' : cssVars.spacing.xxl,
    background: fullscreen
      ? 'transparent'
      : 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
    borderRadius: fullscreen ? 0 : cssVars.borderRadius.xl,
    border: fullscreen ? 'none' : `3px solid ${cssVars.colors.border}`,
    minHeight: fullscreen ? '100%' : size === 'xl' ? '50vh' : size === 'lg' ? '35vh' : '25vh',
    height: fullscreen ? '100%' : 'auto',
    width: '100%',
    maxWidth: fullscreen ? 'none' : size === 'xl' ? '1200px' : '1000px',
    margin: '0 auto',
    boxShadow: fullscreen ? 'none' : cssVars.shadows.lg,
  };

  const iconStyle: CSSProperties = {
    fontSize: size === 'xl' ? '100px' : size === 'lg' ? '72px' : '48px',
    marginBottom: cssVars.spacing.xl,
    opacity: 0.6,
  };

  const messageStyle: CSSProperties = {
    fontSize: size === 'xl' ? 'clamp(36px, 4vw, 48px)' : size === 'lg' ? '28px' : '20px',
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
  };

  const subMessageStyle: CSSProperties = {
    fontSize: size === 'xl' ? 'clamp(18px, 2vw, 24px)' : size === 'lg' ? '18px' : '14px',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: cssVars.spacing.lg,
    textAlign: 'center',
  };

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>⏸️</div>
      <div style={messageStyle}>{message}</div>
      <div style={subMessageStyle}>
        Die Tabellen werden angezeigt, bis ein Spiel gestartet wird
      </div>
    </div>
  );
};
