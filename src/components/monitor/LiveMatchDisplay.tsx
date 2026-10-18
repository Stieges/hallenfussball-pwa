/**
 * LiveMatchDisplay - Stadium-Grade scoreboard for monitor display
 *
 * Layout optimized for 30-40m viewing distance on 55-75" TVs:
 * - Header (8%):  LIVE badge, field, group
 * - Score (55%):  Two colored blocks with score numbers
 * - Teams (12%):  Team names centered below score blocks
 * - Timer (17%):  Large centered timer with progress bar
 * - Footer (8%):  Referee info
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayFontSizes, displayLayout } from '../../design-tokens';
import type { MonitorTheme, LiveColorScheme } from '../../types/monitor';
import { DEFAULT_LIVE_COLOR_SCHEME } from '../../types/monitor';
import { LiveMatch } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';
import { MatchTimer } from './MatchTimer';
import type { ClockMode } from '../../core/match/clockDisplay';
import { LiveScoreGrid } from './LiveScoreGrid';
import { LiveFinalScore, type LiveFinalScoreProps } from './LiveFinalScore';
import { getBlockFrames, resolveColor } from './liveBlockFrame';
import { LiveHeader } from './LiveHeader';

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
  finalScore?: LiveFinalScoreProps['finalScore']; // Endstand der Ansicht (A-36c, @ZM-147)
  /** Finalrunde (K.-o., Platzierungsspiel, Finale; `MatchView.phase === 'final'`): nur dort trägt der Sieger den Pokal, den Ring jeder Sieger (@ZM-049) */
  finalRound?: boolean;
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
  finalScore,
  finalRound = false,
}) => {
  const { t } = useTranslation('monitor');
  const { themeColors } = useMonitorTheme(theme);
  const scheme = colorScheme ?? DEFAULT_LIVE_COLOR_SCHEME;
  const isRunning = match.status === 'RUNNING';
  const isPaused = match.status === 'PAUSED';

  const homeColor = resolveColor('home', scheme, match.homeTeam);
  const awayColor = resolveColor('away', scheme, match.awayTeam);

  const layout = displayLayout.scoreArea;
  const frames = getBlockFrames(homeColor, awayColor, themeColors.background, themeColors.text);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: fullscreen ? '100%' : 'auto',
    minHeight: fullscreen ? '100%' : size === 'xl' ? '70vh' : '50vh',
    padding: fullscreen ? `${layout.paddingY} ${layout.paddingX}` : cssVars.spacing.xxl,
    background: themeColors.backgroundGradient,
    borderRadius: fullscreen ? 0 : cssVars.borderRadius.xl,
    border: fullscreen ? 'none' : `4px solid ${isRunning ? themeColors.borderActive : themeColors.border}`,
    boxShadow: fullscreen ? 'none' : isRunning ? themeColors.glowActive : cssVars.shadows.lg,
    animation: isRunning && !fullscreen ? 'matchGlow 3s ease-in-out infinite' : undefined,
    position: 'relative',
    overflow: 'hidden',
  };

  // B-44a2: unterer Bereich (Uhr, Balken, Hinweise) hat in jedem Zustand dieselbe Höhe, der Block verschiebt sich nicht
  const timerAreaStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: layout.lowerHeight, // fest (nicht min): Inhalt kann die Lage nie verschieben
    paddingTop: layout.lowerPaddingTop,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
  };

  // --- Render ---------------------------------------------------------------

  return (
    <>
      <div style={containerStyle}>
        <LiveHeader
          status={match.status}
          field={match.field ?? 1}
          matchNumber={match.number}
          group={group ?? match.group}
          size={size}
          themeColors={themeColors}
        />

        {/* Raster: Kästen, Trenner, Namen (@ZM-140); Kindermodus ohne Kästen; Ende nach Mockup K5g */}
        <LiveScoreGrid
          match={match}
          size={size}
          theme={theme}
          themeColors={themeColors}
          hideScore={hideScore}
          homeColor={homeColor}
          awayColor={awayColor}
          frames={frames}
          finalScore={finalScore}
          finalRound={finalRound}
        />

        {/* Unterer Bereich: feste Höhe in jedem Zustand (B-44a2); H2: nach dem Abpfiff keine Uhr, nur das Endergebnis */}
        <div style={timerAreaStyle} data-testid="live-lower">
          {match.status === 'FINISHED' && <LiveFinalScore color={themeColors.text} accent={themeColors.progressBar} finalScore={hideScore ? undefined : finalScore} names={{ home: match.homeTeam.name, away: match.awayTeam.name }} />}
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
          {/* B1: Schiedsrichter-Zeile im reservierten unteren Bereich, immer an derselben Stelle (unten) */}
          {match.refereeName && (
            <div
              data-testid="live-referee"
              style={{
                marginTop: 'auto',
                fontSize: displayFontSizes.clockHint,
                lineHeight: layout.hintLineHeight,
                color: themeColors.text,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {t('liveMatch.referee', { name: match.refereeName })}
            </div>
          )}
        </div>
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

