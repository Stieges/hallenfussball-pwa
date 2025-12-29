/**
 * HalftimeResetDialog - Halftime Reset Confirmation
 *
 * Prompts the user to reset timer and accumulated fouls at halftime.
 * According to futsal rules, accumulated fouls reset after each half.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §3.3
 *
 * Features:
 * - Shows current foul counts for both teams
 * - Option to reset fouls (default: yes)
 * - Option to reset/restart timer (default: yes)
 * - Clear warning about what will be reset
 */

import { useState, useEffect, useCallback } from 'react';
import { colors, spacing, fontSizes, borderRadius } from '../../../../design-tokens';
import { triggerHaptic } from '../../../../utils/haptics';
import moduleStyles from '../../LiveCockpit.module.css';

interface Team {
  id: string;
  name: string;
}

interface HalftimeResetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback when reset is confirmed
   * @param resetFouls - Whether to reset foul counts
   * @param resetTimer - Whether to reset the timer
   */
  onConfirm: (resetFouls: boolean, resetTimer: boolean) => void;
  homeTeam: Team;
  awayTeam: Team;
  homeFouls: number;
  awayFouls: number;
  /** Current half (1 or 2) */
  currentHalf: 1 | 2;
}

export function HalftimeResetDialog({
  isOpen,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
  homeFouls,
  awayFouls,
  currentHalf,
}: HalftimeResetDialogProps) {
  const [resetFouls, setResetFouls] = useState(true);
  const [resetTimer, setResetTimer] = useState(true);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) {return;}
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleConfirm = useCallback(() => {
    triggerHaptic('success');
    onConfirm(resetFouls, resetTimer);
    onClose();
  }, [resetFouls, resetTimer, onConfirm, onClose]);

  if (!isOpen) {
    return null;
  }

  const nextHalf = currentHalf === 1 ? 2 : 1;

  return (
    <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="halftime-dialog-title"
      >
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.icon}>⏸️</span>
          <div>
            <h2 id="halftime-dialog-title" style={styles.title}>
              Halbzeit
            </h2>
            <p style={styles.subtitle}>
              {currentHalf}. Halbzeit beendet
            </p>
          </div>
        </div>

        {/* Current Fouls Display */}
        <div style={styles.foulsSection}>
          <div style={styles.foulsTitle}>Aktuelle Fouls</div>
          <div style={styles.foulsGrid}>
            <div style={styles.foulTeam}>
              <span style={styles.foulTeamName}>{homeTeam.name}</span>
              <span style={{
                ...styles.foulCount,
                color: homeFouls >= 5 ? colors.error : colors.warning,
              }}>
                {homeFouls}
              </span>
            </div>
            <div style={styles.foulDivider}>:</div>
            <div style={styles.foulTeam}>
              <span style={styles.foulTeamName}>{awayTeam.name}</span>
              <span style={{
                ...styles.foulCount,
                color: awayFouls >= 5 ? colors.error : colors.warning,
              }}>
                {awayFouls}
              </span>
            </div>
          </div>
        </div>

        {/* Reset Options */}
        <div style={styles.optionsSection}>
          <label style={styles.optionRow}>
            <input
              type="checkbox"
              checked={resetFouls}
              onChange={(e) => setResetFouls(e.target.checked)}
              style={styles.checkbox}
            />
            <div style={styles.optionContent}>
              <span style={styles.optionTitle}>Fouls zurücksetzen</span>
              <span style={styles.optionDescription}>
                Akkumulierte Fouls auf 0 setzen (Regelkonform)
              </span>
            </div>
          </label>

          <label style={styles.optionRow}>
            <input
              type="checkbox"
              checked={resetTimer}
              onChange={(e) => setResetTimer(e.target.checked)}
              style={styles.checkbox}
            />
            <div style={styles.optionContent}>
              <span style={styles.optionTitle}>Timer zurücksetzen</span>
              <span style={styles.optionDescription}>
                Spielzeit für {nextHalf}. Halbzeit neu starten
              </span>
            </div>
          </label>
        </div>

        {/* Warning if nothing selected */}
        {!resetFouls && !resetTimer && (
          <div style={styles.warningBanner}>
            <span>⚠️</span>
            <span>Keine Änderungen ausgewählt</span>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.cancelButton} onClick={onClose}>
            Abbrechen
          </button>
          <button
            style={styles.confirmButton}
            onClick={handleConfirm}
          >
            {nextHalf}. Halbzeit starten
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
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
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: '32px',
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    margin: 0,
  },
  foulsSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  foulsTitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  foulsGrid: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  foulTeam: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 80,
  },
  foulTeamName: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  foulCount: {
    fontSize: fontSizes.xxl,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  foulDivider: {
    fontSize: fontSizes.xl,
    color: colors.textMuted,
  },
  optionsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  optionRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
  },
  checkbox: {
    width: 24,
    height: 24,
    marginTop: 2,
    accentColor: colors.primary,
    cursor: 'pointer',
  },
  optionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  optionTitle: {
    fontSize: fontSizes.md,
    fontWeight: 500,
    color: colors.textPrimary,
  },
  optionDescription: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningBannerBg,
    borderRadius: borderRadius.md,
    color: colors.warning,
    fontSize: fontSizes.sm,
  },
  actions: {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
  confirmButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: 600,
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
};

export default HalftimeResetDialog;
