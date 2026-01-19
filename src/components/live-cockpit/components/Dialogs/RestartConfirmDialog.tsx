/**
 * RestartConfirmDialog - Confirmation for Match Restart
 *
 * Critical action dialog that prevents accidental match restarts.
 * Shows current score that will be lost.
 */

import { cssVars } from '../../../../design-tokens'
import { useFocusTrap } from '../../../../hooks';
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
  // WCAG 4.1.3: Focus trap for accessibility
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
  });

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
        ref={focusTrap.containerRef}
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
            stroke={cssVars.colors.warning}
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
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
  },
  iconContainer: {
    marginBottom: cssVars.spacing.md,
  },
  title: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
  },
  scoreContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surface,
    padding: cssVars.spacing.md,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.md,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  teamName: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  score: {
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: 700,
    color: cssVars.colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  },
  scoreDivider: {
    fontSize: cssVars.fontSizes.xl,
    color: cssVars.colors.textSecondary,
  },
  timeInfo: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
  },
  warningText: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.warning,
    margin: 0,
    marginBottom: cssVars.spacing.xl,
    lineHeight: 1.5,
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
    backgroundColor: cssVars.colors.warning,
    color: cssVars.colors.onWarning,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
};

export default RestartConfirmDialog;
