/**
 * MatchTimer - Restzeit-Uhr für die Monitor-Ansicht (@ZM-139, @ZM-137)
 *
 * - Zeigt die Restzeit des Abschnitts (zentrale Funktion getClockDisplay)
 * - Neutral bis zur angehaltenen Schlussphase, dann eigene Hervorhebung (keine Teamfarbe, keine Eskalation)
 * - Hinweise: „Uhr hält bei Unterbrechung“, bei angehaltener Uhr zusätzlich „angehalten“
 * - Nach Ablauf 00:00 und „Spielzeit abgelaufen – Ergebnis folgt“
 */

import { CSSProperties, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, criticalPhaseColors } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { MatchStatus } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';
import { getClockDisplay, DEFAULT_CLOCK_MODE, type ClockMode } from '../../core/match/clockDisplay';

export interface MatchTimerProps {
  /** Gespielte Sekunden im Abschnitt (Vorbelegung, falls kein Zeitstempel) */
  elapsedSeconds: number;
  /** Abschnittslänge in Sekunden */
  durationSeconds: number;
  /** Match status */
  status: MatchStatus;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show progress bar */
  showProgress?: boolean;
  /** Timer start time for real-time calculation */
  timerStartTime?: string;
  /** Timer elapsed seconds before current run */
  timerElapsedSeconds?: number;
  /** Theme (dark/light/auto) */
  theme?: MonitorTheme;
  /** Uhr-Art des Turniers (Vorgabe: durchlaufend, letzte Minute angehalten) */
  clockMode?: ClockMode;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/** Gespielte Zeit im Abschnitt; bei laufendem Spiel aus dem Zeitstempel */
function calculateRealTimeElapsed(
  status: MatchStatus,
  timerStartTime?: string,
  timerElapsedSeconds?: number,
  fallbackElapsed?: number
): number {
  if (status === 'NOT_STARTED') {
    return 0;
  }
  if (status !== 'RUNNING' || !timerStartTime) {
    return timerElapsedSeconds ?? fallbackElapsed ?? 0;
  }
  const runtimeSeconds = Math.floor((Date.now() - new Date(timerStartTime).getTime()) / 1000);
  return (timerElapsedSeconds ?? 0) + runtimeSeconds;
}

const sizeStyles: Record<string, { time: string; progress: string; gap: string; hint: string }> = {
  sm: { time: '18px', progress: '6px', gap: '6px', hint: '12px' },
  md: { time: '28px', progress: '8px', gap: '10px', hint: '14px' },
  lg: { time: '42px', progress: '12px', gap: '14px', hint: '18px' },
  xl: { time: 'clamp(48px, 5vw, 72px)', progress: '16px', gap: '20px', hint: 'clamp(16px, 1.6vw, 22px)' },
};

export const MatchTimer: React.FC<MatchTimerProps> = ({
  elapsedSeconds: propElapsedSeconds,
  durationSeconds,
  status,
  size = 'lg',
  showProgress = true,
  timerStartTime,
  timerElapsedSeconds,
  theme = 'dark',
  clockMode = DEFAULT_CLOCK_MODE,
}) => {
  const { t } = useTranslation('monitor');
  const { themeColors } = useMonitorTheme(theme);

  const [displayElapsed, setDisplayElapsed] = useState(() =>
    calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds)
  );

  useEffect(() => {
    const update = () => setDisplayElapsed(
      calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds)
    );
    update();
    if (status !== 'RUNNING') {
      return undefined;
    }
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [status, timerStartTime, timerElapsedSeconds, propElapsedSeconds, durationSeconds]);

  const clock = getClockDisplay({
    gespielt: displayElapsed,
    abschnittSekunden: durationSeconds,
    uhrArt: clockMode,
    angehalten: status === 'PAUSED',
  });
  const abgelaufen = clock.phase === 'abgelaufen';
  const progressPercent = Math.min(100, (displayElapsed / durationSeconds) * 100);
  const currentSize = sizeStyles[size];
  const highlight = clock.hervorhebung;

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: currentSize.gap,
    width: '100%',
  };

  const timeContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: size === 'xl' ? '12px' : '8px',
    ...(highlight && {
      backgroundColor: criticalPhaseColors.critical,
      padding: `${size === 'xl' ? '8px' : '4px'} ${size === 'xl' ? '24px' : '12px'}`,
      borderRadius: '999px',
    }),
  };

  const timeStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: cssVars.fontWeights.bold,
    fontFamily: cssVars.fontFamilies.heading,
    color: highlight ? criticalPhaseColors.criticalText : abgelaufen ? themeColors.timerOvertime : themeColors.timerNormal,
    textShadow: highlight ? 'none' : themeColors.textShadowLight,
    letterSpacing: '0.02em',
  };

  const hintStyle: CSSProperties = {
    fontSize: currentSize.hint,
    fontWeight: cssVars.fontWeights.bold,
    color: highlight ? criticalPhaseColors.criticalText : themeColors.textSecondary,
    textAlign: 'center',
  };

  const progressContainerStyle: CSSProperties = {
    width: '100%',
    height: currentSize.progress,
    backgroundColor: themeColors.progressTrack,
    borderRadius: currentSize.progress,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: themeColors.progressInsetShadow,
  };

  const progressBarStyle: CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    background: highlight
      ? criticalPhaseColors.critical
      : `linear-gradient(90deg, ${themeColors.progressBar} 0%, ${themeColors.liveBadgeText} 100%)`,
    borderRadius: currentSize.progress,
    transition: 'width 1s linear',
    boxShadow: themeColors.progressShadow,
  };

  return (
    <>
      <div style={containerStyle}>
        <div style={timeContainerStyle} data-testid="monitor-clock" data-phase={clock.phase}>
          <span style={timeStyle}>{formatTime(clock.restSekunden)}</span>
        </div>

        {showProgress && (
          <div style={progressContainerStyle}>
            <div style={progressBarStyle} />
          </div>
        )}

        {abgelaufen && (
          <div style={hintStyle}>{t('liveMatch.clock.ended')}</div>
        )}
        {!abgelaufen && clock.hinweisUhrHaelt && (
          <div style={hintStyle}>{t('liveMatch.clock.holdsOnInterruption')}</div>
        )}
        {clock.angehalten && (
          <div style={hintStyle}>{t('liveMatch.clock.stopped')}</div>
        )}
        {status === 'PAUSED' && !clock.angehalten && (
          <div style={hintStyle}>Pause</div>
        )}
      </div>
    </>
  );
};
