/**
 * TimeAdjustDialog - Manual Time Adjustment
 *
 * Allows tournament directors to manually adjust match time.
 * Use cases:
 * - Wrong start time
 * - Technical issues
 * - Paused too long by accident
 */

import { useState, useEffect, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens'
import moduleStyles from '../../LiveCockpit.module.css';

interface TimeAdjustDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newTimeSeconds: number) => void;
  currentTimeSeconds: number;
  matchDurationMinutes: number;
}

export function TimeAdjustDialog({
  isOpen,
  onClose,
  onConfirm,
  currentTimeSeconds,
  matchDurationMinutes,
}: TimeAdjustDialogProps) {
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Initialize with current time when dialog opens
  useEffect(() => {
    if (isOpen) {
      const currentMinutes = Math.floor(currentTimeSeconds / 60);
      const currentSeconds = currentTimeSeconds % 60;
      setMinutes(currentMinutes);
      setSeconds(currentSeconds);
    }
  }, [isOpen, currentTimeSeconds]);

  if (!isOpen) {
    return null;
  }

  const handleMinutesChange = (delta: number) => {
    const newMinutes = Math.max(0, Math.min(matchDurationMinutes + 10, minutes + delta));
    setMinutes(newMinutes);
  };

  const handleSecondsChange = (delta: number) => {
    let newSeconds = seconds + delta;
    if (newSeconds >= 60) {
      newSeconds = 0;
      setMinutes((m) => Math.min(matchDurationMinutes + 10, m + 1));
    } else if (newSeconds < 0) {
      if (minutes > 0) {
        newSeconds = 59;
        setMinutes((m) => m - 1);
      } else {
        newSeconds = 0;
      }
    }
    setSeconds(newSeconds);
  };

  const handleConfirm = () => {
    const totalSeconds = minutes * 60 + seconds;
    onConfirm(totalSeconds);
    onClose();
  };

  const formatTime = (m: number, s: number) => {
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentFormatted = formatTime(
    Math.floor(currentTimeSeconds / 60),
    currentTimeSeconds % 60
  );
  const newFormatted = formatTime(minutes, seconds);
  const hasChanged = currentFormatted !== newFormatted;

  return (
    <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-adjust-dialog-title"
      >
        {/* Title */}
        <h2 id="time-adjust-dialog-title" style={styles.title}>Spielzeit anpassen</h2>

        {/* Current Time */}
        <p style={styles.currentTime}>
          Aktuelle Zeit: <strong>{currentFormatted}</strong>
        </p>

        {/* Time Picker */}
        <div style={styles.pickerContainer}>
          {/* Minutes */}
          <div style={styles.pickerColumn}>
            <button
              style={styles.pickerButton}
              onClick={() => handleMinutesChange(1)}
              aria-label="Minute erhöhen"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 15l-6-6-6 6"
                  stroke={cssVars.colors.textSecondary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div style={styles.pickerValue}>
              {minutes.toString().padStart(2, '0')}
            </div>
            <button
              style={styles.pickerButton}
              onClick={() => handleMinutesChange(-1)}
              aria-label="Minute verringern"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke={cssVars.colors.textSecondary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span style={styles.pickerLabel}>Min</span>
          </div>

          {/* Separator */}
          <div style={styles.pickerSeparator}>:</div>

          {/* Seconds */}
          <div style={styles.pickerColumn}>
            <button
              style={styles.pickerButton}
              onClick={() => handleSecondsChange(10)}
              aria-label="10 Sekunden erhöhen"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 15l-6-6-6 6"
                  stroke={cssVars.colors.textSecondary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div style={styles.pickerValue}>
              {seconds.toString().padStart(2, '0')}
            </div>
            <button
              style={styles.pickerButton}
              onClick={() => handleSecondsChange(-10)}
              aria-label="10 Sekunden verringern"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke={cssVars.colors.textSecondary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span style={styles.pickerLabel}>Sek</span>
          </div>
        </div>

        {/* Quick Adjust Buttons */}
        <div style={styles.quickAdjustContainer}>
          <button
            style={styles.quickButton}
            onClick={() => {
              setMinutes(0);
              setSeconds(0);
            }}
          >
            00:00
          </button>
          <button
            style={styles.quickButton}
            onClick={() => {
              const half = Math.floor(matchDurationMinutes / 2);
              setMinutes(half);
              setSeconds(0);
            }}
          >
            Halbzeit
          </button>
          <button
            style={styles.quickButton}
            onClick={() => {
              setMinutes(matchDurationMinutes);
              setSeconds(0);
            }}
          >
            Ende
          </button>
        </div>

        {/* Change Indicator */}
        {hasChanged && (
          <div style={styles.changeIndicator}>
            {currentFormatted} → {newFormatted}
          </div>
        )}

        {/* Action Buttons */}
        <div style={styles.buttonContainer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Abbrechen
          </button>
          <button
            style={{
              ...styles.confirmButton,
              opacity: hasChanged ? 1 : 0.5,
            }}
            onClick={handleConfirm}
            disabled={!hasChanged}
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cssVars.colors.overlayDialog,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: cssVars.spacing.lg,
  },
  dialog: {
    backgroundColor: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.xl,
    padding: cssVars.spacing.xl,
    maxWidth: '360px',
    width: '100%',
    textAlign: 'center',
  },
  title: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.md,
  },
  currentTime: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.xl,
  },
  pickerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.lg,
  },
  pickerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  },
  pickerButton: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cssVars.colors.surface,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
  pickerValue: {
    fontSize: '48px',
    fontWeight: 700,
    color: cssVars.colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    padding: `${cssVars.spacing.sm} 0`,
  },
  pickerLabel: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  pickerSeparator: {
    fontSize: '48px',
    fontWeight: 700,
    color: cssVars.colors.textSecondary,
    alignSelf: 'center',
    marginTop: '-24px',
  },
  quickAdjustContainer: {
    display: 'flex',
    gap: cssVars.spacing.sm,
    justifyContent: 'center',
    marginBottom: cssVars.spacing.lg,
  },
  quickButton: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    backgroundColor: cssVars.colors.surface,
    color: cssVars.colors.textSecondary,
    border: 'none',
    borderRadius: cssVars.borderRadius.full,
    cursor: 'pointer',
  },
  changeIndicator: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.primary,
    backgroundColor: `${cssVars.colors.primary}20`,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    marginBottom: cssVars.spacing.lg,
    display: 'inline-block',
  },
  buttonContainer: {
    display: 'flex',
    gap: cssVars.spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: cssVars.colors.textSecondary,
    border: `1px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
  confirmButton: {
    flex: 1,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 600,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
};

export default TimeAdjustDialog;
