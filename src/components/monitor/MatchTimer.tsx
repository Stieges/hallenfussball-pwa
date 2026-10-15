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
import { cssVars, displayFontSizes, displayLayout, displaySpacing } from '../../design-tokens';
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

const sizeStyles: Record<string, { time: string; progress: string; gap: string }> = {
  sm: { time: '18px', progress: '6px', gap: '6px' },
  md: { time: '28px', progress: '8px', gap: '10px' },
  lg: { time: '42px', progress: '12px', gap: '14px' },
  xl: { time: displayFontSizes.clockXL, progress: '1.2vh', gap: '1.2vh' },
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
    // M2: neutrale Hervorhebung (Umkehrung der Textfarbe), keine Buntfarbe
    // B-44a2: Größe und Lage der Uhr sind in jeder Phase gleich, nur die Füllung wechselt
    padding: `${size === 'xl' ? '0.8vh' : '4px'} ${size === 'xl' ? '2vh' : '12px'}`,
    borderRadius: '999px',
    backgroundColor: highlight ? themeColors.text : 'transparent',
  };

  const timeStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: cssVars.fontWeights.bold,
    fontFamily: cssVars.fontFamilies.heading,
    // M3: abgelaufen ist neutral, der Text trägt die Aussage
    color: highlight ? themeColors.background : themeColors.timerNormal,
    textShadow: highlight ? 'none' : themeColors.textShadowLight,
    letterSpacing: '0.02em',
    lineHeight: 1,
  };

  // H1: Hinweise stehen direkt auf dem Monitor-Hintergrund, Text in der Textfarbe (Kontrast ≥ 4,5 : 1)
  // B-44a2: Hinweise in Hinweisgröße (≥ 3 % Bildhöhe), kompakt gesetzt, mit Abstand zur Uhr (xl)
  const hintStyle: CSSProperties = {
    fontSize: size === 'xl' ? displayFontSizes.clockHint : displayFontSizes.bodySM,
    fontWeight: cssVars.fontWeights.bold,
    color: themeColors.text,
    textAlign: 'center',
  };

  const hintGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    // B-44a2: immer dieselbe Zeile, feste Höhe auch ohne Hinweis (Lage ändert sich nie)
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
    minHeight: size === 'xl' ? `calc(${displayFontSizes.clockHint} * 1.2)` : undefined,
    justifyContent: 'center',
    columnGap: displaySpacing.sectionMD,
    rowGap: displayLayout.scoreArea.hintGap,
    lineHeight: 1.2,
    marginTop: size === 'xl' ? displayLayout.scoreArea.hintGapAbove : undefined,
  };

  const progressContainerStyle: CSSProperties = {
    width: '100%',
    maxWidth: size === 'xl' ? displayLayout.scoreArea.progressWidth : undefined,
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
      ? themeColors.text
      : `linear-gradient(90deg, ${themeColors.progressBar} 0%, ${themeColors.liveBadgeText} 100%)`,
    borderRadius: currentSize.progress,
    transition: 'width 1s linear',
    boxShadow: themeColors.progressShadow,
  };

  // H2: der Text „abgelaufen“ nur ohne Abpfiff (nicht FINISHED)
  const hints: string[] = [];
  if (abgelaufen && status !== 'FINISHED') { hints.push(t('liveMatch.clock.ended')); }
  if (!abgelaufen && clock.hinweisUhrHaelt) { hints.push(t('liveMatch.clock.holdsOnInterruption')); }
  if (clock.angehalten) { hints.push(t('liveMatch.clock.stopped')); }
  if (status === 'PAUSED' && !clock.angehalten) { hints.push(t('timer.pause')); }

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

        {(hints.length > 0 || size === 'xl') && (
          <div style={hintGroupStyle} data-testid="clock-hints">
            {hints.map(text => <div key={text} style={hintStyle}>{text}</div>)}
          </div>
        )}
      </div>
    </>
  );
};
