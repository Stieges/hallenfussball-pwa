/**
 * EditTimeDialog - Dialog for adjusting match time
 *
 * QW-001: Replaces window.prompt() with proper +/- button UI for MM:SS.
 * MF-004: Accessibility improvements (focus trap, Escape key, ARIA)
 */

import { CSSProperties, useState, useEffect, useCallback, useRef } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
import { Button } from '../ui';
import { useIsMobile } from '../../hooks/useIsMobile';

interface EditTimeDialogProps {
  currentElapsedSeconds: number;
  durationSeconds: number;
  onSubmit: (newElapsedSeconds: number) => void;
  onCancel: () => void;
}

export const EditTimeDialog: React.FC<EditTimeDialogProps> = ({
  currentElapsedSeconds,
  durationSeconds,
  onSubmit,
  onCancel,
}) => {
  const currentMinutes = Math.floor(currentElapsedSeconds / 60);
  const currentSeconds = currentElapsedSeconds % 60;

  const [minutes, setMinutes] = useState(currentMinutes);
  const [seconds, setSeconds] = useState(currentSeconds);

  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);

  // MF-004: Focus management and Escape key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    // Focus dialog container on mount
    setTimeout(() => dialogRef.current?.focus(), 50);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const maxMinutes = Math.floor(durationSeconds / 60) + 5; // Allow some overtime

  const handleSubmit = () => {
    const newElapsedSeconds = minutes * 60 + seconds;
    onSubmit(newElapsedSeconds);
  };

  const handleMinutesChange = (delta: number) => {
    setMinutes((prev) => Math.max(0, Math.min(maxMinutes, prev + delta)));
  };

  const handleSecondsChange = (delta: number) => {
    const newSeconds = seconds + delta;
    if (newSeconds >= 60) {
      setSeconds(0);
      handleMinutesChange(1);
    } else if (newSeconds < 0) {
      if (minutes > 0) {
        setSeconds(59);
        handleMinutesChange(-1);
      }
    } else {
      setSeconds(newSeconds);
    }
  };

  const newElapsedSeconds = minutes * 60 + seconds;
  const hasChanged = newElapsedSeconds !== currentElapsedSeconds;

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: spacing.md,
  };

  const containerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    padding: isMobile ? spacing.lg : spacing.xl,
    borderRadius: borderRadius.lg,
    border: `2px solid ${colors.secondary}`,
    background: 'linear-gradient(135deg, rgba(0, 176, 255, 0.15), rgba(0, 120, 200, 0.1))',
    backgroundColor: colors.background,
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.lg : fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.secondary,
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  };

  const currentTimeStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  };

  const timeInputContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  };

  const timeBlockStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };

  const timeControlsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
  };

  const timeButtonStyle: CSSProperties = {
    width: isMobile ? '56px' : '48px',
    height: isMobile ? '44px' : '36px',
    borderRadius: borderRadius.md,
    border: `2px solid ${colors.border}`,
    background: 'rgba(255, 255, 255, 0.1)',
    color: colors.textPrimary,
    fontSize: isMobile ? fontSizes.lg : fontSizes.md,
    fontWeight: fontWeights.bold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  };

  const timeDisplayStyle: CSSProperties = {
    fontSize: isMobile ? '48px' : '40px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    fontFamily: 'ui-monospace, monospace',
    minWidth: isMobile ? '70px' : '60px',
    textAlign: 'center',
  };

  const colonStyle: CSSProperties = {
    fontSize: isMobile ? '40px' : '36px',
    color: colors.textSecondary,
    fontWeight: fontWeights.bold,
    alignSelf: 'center',
  };

  const durationInfoStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  };

  const buttonsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  };

  const formatTime = (m: number, s: number) => {
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const durationMinutes = Math.floor(durationSeconds / 60);

  return (
    <div style={overlayStyle} onClick={onCancel}>
      {/* MF-004: Modal mit korrekten ARIA-Attributen */}
      <div
        ref={dialogRef}
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-time-dialog-title"
        tabIndex={-1}
      >
        <div id="edit-time-dialog-title" style={titleStyle}>
          <span aria-hidden="true">⏱️</span>
          <span>Spielzeit anpassen</span>
        </div>

        <div style={currentTimeStyle}>
          Aktuelle Zeit: <strong>{formatTime(currentMinutes, currentSeconds)}</strong>
        </div>

        <div style={timeInputContainerStyle}>
          <div style={timeBlockStyle}>
            <div style={labelStyle} id="minutes-label">Minuten</div>
            <div style={timeControlsStyle}>
              <button
                style={timeButtonStyle}
                onClick={() => handleMinutesChange(1)}
                disabled={minutes >= maxMinutes}
                type="button"
                aria-label="Minuten erhöhen"
              >
                +
              </button>
              <div
                style={timeDisplayStyle}
                aria-labelledby="minutes-label"
                aria-live="polite"
              >
                {minutes.toString().padStart(2, '0')}
              </div>
              <button
                style={{
                  ...timeButtonStyle,
                  opacity: minutes === 0 ? 0.5 : 1,
                  cursor: minutes === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => handleMinutesChange(-1)}
                disabled={minutes === 0}
                type="button"
                aria-label="Minuten verringern"
              >
                −
              </button>
            </div>
          </div>

          <div style={colonStyle} aria-hidden="true">:</div>

          <div style={timeBlockStyle}>
            <div style={labelStyle} id="seconds-label">Sekunden</div>
            <div style={timeControlsStyle}>
              <button
                style={timeButtonStyle}
                onClick={() => handleSecondsChange(1)}
                type="button"
                aria-label="Sekunden erhöhen"
              >
                +
              </button>
              <div
                style={timeDisplayStyle}
                aria-labelledby="seconds-label"
                aria-live="polite"
              >
                {seconds.toString().padStart(2, '0')}
              </div>
              <button
                style={{
                  ...timeButtonStyle,
                  opacity: seconds === 0 && minutes === 0 ? 0.5 : 1,
                  cursor: seconds === 0 && minutes === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => handleSecondsChange(-1)}
                disabled={seconds === 0 && minutes === 0}
                type="button"
                aria-label="Sekunden verringern"
              >
                −
              </button>
            </div>
          </div>
        </div>

        <div style={durationInfoStyle}>
          Spieldauer: {durationMinutes}:00 Min
        </div>

        <div style={buttonsStyle}>
          <Button
            variant="primary"
            size={isMobile ? 'md' : 'sm'}
            onClick={handleSubmit}
            disabled={!hasChanged}
            style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
          >
            Speichern
          </Button>
          <Button
            variant="secondary"
            size={isMobile ? 'md' : 'sm'}
            onClick={onCancel}
            style={{ flex: 1, minHeight: isMobile ? '48px' : 'auto' }}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
};
