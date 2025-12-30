/**
 * RestartConfirmDialog - Confirmation for Match Restart
 *
 * Critical action dialog that prevents accidental match restarts.
 * Shows current score that will be lost.
 */

import { useEffect, useCallback } from 'react';
import { colors, spacing, fontSizes, borderRadius } from '../../../../design-tokens';
import moduleStyles from '../../LiveCockpit.module.css';

interface RestartConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  elapsedTime: string;
}

export function RestartConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  elapsedTime,
}: RestartConfirmDialogProps) {
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

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="restart-confirm-dialog-title"
      >
        {/* Warning Icon */}
        <div style={styles.iconContainer}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.warning}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Title */}
        <h2 id="restart-confirm-dialog-title" style={styles.title}>Spiel neu starten?</h2>

        {/* Current Score Display */}
        <div style={styles.scoreContainer}>
          <div style={styles.scoreRow}>
            <span style={styles.teamName}>{homeTeam}</span>
            <span style={styles.score}>{homeScore}</span>
          </div>
          <div style={styles.scoreDivider}>:</div>
          <div style={styles.scoreRow}>
            <span style={styles.score}>{awayScore}</span>
            <span style={styles.teamName}>{awayTeam}</span>
          </div>
        </div>

        <p style={styles.timeInfo}>
          Spielzeit: <strong>{elapsedTime}</strong>
        </p>

        {/* Warning Text */}
        <p style={styles.warningText}>
          Der aktuelle Spielstand und alle Events werden gelöscht.
          Diese Aktion kann nicht rückgängig gemacht werden.
        </p>

        {/* Action Buttons */}
        <div style={styles.buttonContainer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Abbrechen
          </button>
          <button style={styles.confirmButton} onClick={handleConfirm}>
            Neu starten
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
    backgroundColor: colors.overlayDialog,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
    marginBottom: spacing.lg,
  },
  scoreContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamName: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  score: {
    fontSize: fontSizes.xxl,
    fontWeight: 700,
    color: colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  },
  scoreDivider: {
    fontSize: fontSizes.xl,
    color: colors.textSecondary,
  },
  timeInfo: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    margin: 0,
    marginBottom: spacing.lg,
  },
  warningText: {
    fontSize: fontSizes.sm,
    color: colors.warning,
    margin: 0,
    marginBottom: spacing.xl,
    lineHeight: 1.5,
  },
  buttonContainer: {
    display: 'flex',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: fontSizes.md,
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
  confirmButton: {
    flex: 1,
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: fontSizes.md,
    fontWeight: 600,
    backgroundColor: colors.warning,
    color: colors.onWarning,
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
};

export default RestartConfirmDialog;
