/**
 * CenterBlock - Timer display and match control buttons
 *
 * MF-002: Uses useMatchTimerExtended for local timer calculation (performance)
 * MF-004: Accessibility improvements (button, aria-label, role="status")
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { Button } from '../../ui';
import { useToast } from '../../ui/Toast';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useMatchTimerExtended } from '../../../hooks/useMatchTimer';
import { MatchStatus } from '../MatchCockpit';
import { formatTime, getStatusLabel, getStatusColor } from '../utils/matchPanelUtils';

export interface CenterBlockProps {
  matchId: string;
  // MF-002: Timer-Props für lokale Berechnung
  timerStartTime: string | null | undefined;
  timerElapsedSeconds: number;
  durationSeconds: number;
  status: MatchStatus;
  phaseLabel: string;
  awaitingTiebreakerChoice?: boolean;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onFinish(): void;
  onOpenTimeDialog(): void;
  onOpenRestartConfirm(): void;
}

const CenterBlockComponent: React.FC<CenterBlockProps> = ({
  matchId: _matchId,
  timerStartTime,
  timerElapsedSeconds,
  durationSeconds,
  status,
  phaseLabel,
  awaitingTiebreakerChoice,
  onStart,
  onPause,
  onResume,
  onFinish,
  onOpenTimeDialog,
  onOpenRestartConfirm,
}) => {
  // matchId is unused now that we use dialog callbacks
  void _matchId;
  const { showInfo } = useToast();
  const isMobile = useIsMobile();

  // MF-002: Lokale Timer-Berechnung statt globaler State-Updates
  const { displaySeconds: displayTime } = useMatchTimerExtended(
    timerStartTime,
    timerElapsedSeconds,
    status,
    durationSeconds,
    'elapsed' // CenterBlock displays elapsed time (00:00 → 10:00)
  );

  const blockStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: isMobile ? cssVars.spacing.md : cssVars.spacing.sm,
    padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.sm,
    background: isMobile ? `linear-gradient(135deg, ${cssVars.colors.panelGradientStart}, ${cssVars.colors.panelGradientEnd})` : 'transparent',
    border: isMobile ? `1px solid ${cssVars.colors.border}` : 'none',
    borderRadius: isMobile ? cssVars.borderRadius.lg : '0',
  };

  // MF-004: Button-Style für Timer (statt div)
  const timerButtonStyle: CSSProperties = {
    fontFamily: 'ui-monospace, monospace',
    fontSize: isMobile ? '40px' : '26px',
    fontWeight: cssVars.fontWeights.semibold,
    padding: isMobile ? `${cssVars.spacing.md} ${cssVars.spacing.lg}` : `6px ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.full,
    border: `1px solid ${cssVars.colors.border}`,
    background: `radial-gradient(circle at top, ${cssVars.colors.timerGradientBg}, ${cssVars.colors.backgroundDeep})`,
    boxShadow: `0 0 25px ${cssVars.colors.primary}40`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minHeight: isMobile ? '60px' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: cssVars.colors.textPrimary,
  };

  const phaseLabelStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const statusPillStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.xs,
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.full,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    border: `1px solid ${getStatusColor(status)}`,
    background: `${getStatusColor(status)}20`,
    color: getStatusColor(status),
  };

  const dotStyle: CSSProperties = {
    width: isMobile ? '9px' : '7px',
    height: isMobile ? '9px' : '7px',
    borderRadius: cssVars.borderRadius.full,
    background: 'currentColor',
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: isMobile ? cssVars.spacing.md : cssVars.spacing.sm,
    marginTop: cssVars.spacing.sm,
    justifyContent: 'center',
    width: isMobile ? '100%' : 'auto',
  };

  const minutes = Math.floor(durationSeconds / 60);

  const handleTimeClick = () => {
    // QW-001: Use dialog instead of prompt
    onOpenTimeDialog();
  };

  const handleStartClick = () => {
    // Fall 1: Spiel ist pausiert → Warnung, dass Beenden-Button genutzt werden muss
    if (status === 'PAUSED') {
      showInfo('Das Spiel ist pausiert. Bitte den "Fortsetzen" Button nutzen.', { duration: 5000 });
      return;
    }

    // Fall 2: Spiel ist beendet → Bestätigungsdialog öffnen
    if (status === 'FINISHED') {
      // QW-001: Use dialog instead of window.confirm
      onOpenRestartConfirm();
      return;
    }

    // Normaler Start
    onStart();
  };

  const handlePauseResumeClick = () => {
    if (status === 'RUNNING') {
      onPause();
    } else if (status === 'PAUSED') {
      onResume();
    }
  };

  return (
    <div style={blockStyle}>
      {/* MF-004: Timer als Button für Keyboard-Zugänglichkeit */}
      <button
        style={timerButtonStyle}
        onClick={handleTimeClick}
        aria-label={`Spielzeit ${formatTime(displayTime)}. Klicken zum Bearbeiten`}
        type="button"
        data-testid="match-timer-display"
      >
        {formatTime(displayTime)}
      </button>
      <div style={phaseLabelStyle}>
        {phaseLabel} · {minutes}:00 Min
      </div>
      {/* MF-004: Status mit role="status" für Screen-Reader */}
      <div
        style={statusPillStyle}
        role="status"
        aria-live="polite"
        aria-label={`Spielstatus: ${getStatusLabel(status)}`}
      >
        <span style={dotStyle} aria-hidden="true" />
        <span>{getStatusLabel(status)}</span>
      </div>
      <div style={controlsStyle}>
        <Button
          variant="primary"
          size={isMobile ? "md" : "sm"}
          onClick={handleStartClick}
          disabled={status === 'RUNNING' || awaitingTiebreakerChoice}
          aria-label="Spiel starten"
          style={{
            flex: isMobile ? '1 1 100%' : '0 1 auto',
            minHeight: isMobile ? '48px' : 'auto'
          }}
        >
          Start
        </Button>
        <Button
          variant={status === 'PAUSED' ? 'primary' : 'secondary'}
          size={isMobile ? "md" : "sm"}
          onClick={handlePauseResumeClick}
          disabled={status === 'NOT_STARTED' || status === 'FINISHED' || awaitingTiebreakerChoice}
          aria-label={status === 'PAUSED' ? 'Spiel fortsetzen' : 'Spiel pausieren'}
          style={{
            flex: isMobile ? '1 1 calc(50% - 8px)' : '0 1 auto',
            minHeight: isMobile ? '48px' : 'auto'
          }}
        >
          {status === 'PAUSED' ? 'Fortsetzen' : 'Pause'}
        </Button>
        <Button
          variant="danger"
          size={isMobile ? "md" : "sm"}
          onClick={onFinish}
          disabled={status === 'FINISHED' || awaitingTiebreakerChoice}
          aria-label="Spiel beenden"
          style={{
            flex: isMobile ? '1 1 calc(50% - 8px)' : '0 1 auto',
            minHeight: isMobile ? '48px' : 'auto'
          }}
        >
          Beenden
        </Button>
      </div>
    </div>
  );
};

// MF-002: React.memo für Performance-Optimierung
export const CenterBlock = React.memo(CenterBlockComponent, (prevProps, nextProps) => {
  // Nur re-render wenn relevante Props sich ändern
  return (
    prevProps.status === nextProps.status &&
    prevProps.timerStartTime === nextProps.timerStartTime &&
    prevProps.timerElapsedSeconds === nextProps.timerElapsedSeconds &&
    prevProps.durationSeconds === nextProps.durationSeconds &&
    prevProps.phaseLabel === nextProps.phaseLabel &&
    prevProps.awaitingTiebreakerChoice === nextProps.awaitingTiebreakerChoice
  );
});
