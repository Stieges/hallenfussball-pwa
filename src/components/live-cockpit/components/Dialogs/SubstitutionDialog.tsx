/**
 * SubstitutionDialog - Player Substitution Dialog
 *
 * Allows tournament directors to record player substitutions.
 * BUG-009 FIX: Redesigned for multi-player substitutions with RAUS/REIN areas.
 * - Team is pre-selected based on which button was clicked
 * - Multiple players can be substituted at once (common in futsal)
 * - Auto-dismiss after 10 seconds
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §5.4
 */

import { useState, useEffect, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens'
import { useDialogTimer } from '../../../../hooks';
import moduleStyles from '../../LiveCockpit.module.css';

interface Team {
  id: string;
  name: string;
}

interface SubstitutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Callback with arrays for multi-player substitutions */
  onConfirm: (teamId: string, playersOut: number[], playersIn: number[]) => void;
  homeTeam: Team;
  awayTeam: Team;
  /** BUG-009: Pre-select team based on button clicked */
  preselectedTeamSide?: 'home' | 'away';
  /** Auto-dismiss after X seconds (default: 10, 0 = disabled) */
  autoDismissSeconds?: number;
}

// Quick-select buttons for common jersey numbers
const QUICK_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function SubstitutionDialog({
  isOpen,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
  preselectedTeamSide,
  autoDismissSeconds = 10,
}: SubstitutionDialogProps) {
  // BUG-009: Arrays for multi-player substitutions
  const [playersOut, setPlayersOut] = useState<string[]>(['']);
  const [playersIn, setPlayersIn] = useState<string[]>(['']);
  // Track which input field is active for quick-select
  const [activeField, setActiveField] = useState<{ type: 'out' | 'in'; index: number } | null>(null);

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

  // Determine selected team from preselectedTeamSide
  const selectedTeam = preselectedTeamSide === 'home' ? homeTeam :
                       preselectedTeamSide === 'away' ? awayTeam : null;

  // Auto-skip handler for timer expiry
  const handleAutoSkip = useCallback(() => {
    if (!selectedTeam) {
      onClose();
      return;
    }
    // Submit with whatever data we have
    const outNums = playersOut.filter(n => n.trim()).map(n => parseInt(n, 10));
    const inNums = playersIn.filter(n => n.trim()).map(n => parseInt(n, 10));
    onConfirm(selectedTeam.id, outNums, inNums);
    onClose();
  }, [selectedTeam, playersOut, playersIn, onConfirm, onClose]);

  // Timer hook for auto-dismiss
  const { remainingSeconds, reset: resetTimer, progressPercent, isActive } = useDialogTimer({
    durationSeconds: autoDismissSeconds,
    onExpire: handleAutoSkip,
    autoStart: isOpen && autoDismissSeconds > 0 && selectedTeam !== null,
    paused: !isOpen,
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setPlayersOut(['']);
      setPlayersIn(['']);
      setActiveField({ type: 'out', index: 0 });
      resetTimer();
    }
  }, [isOpen, resetTimer]);

  // Add another player field
  const handleAddPlayerOut = useCallback(() => {
    setPlayersOut(prev => [...prev, '']);
    setActiveField({ type: 'out', index: playersOut.length });
    resetTimer();
  }, [playersOut.length, resetTimer]);

  const handleAddPlayerIn = useCallback(() => {
    setPlayersIn(prev => [...prev, '']);
    setActiveField({ type: 'in', index: playersIn.length });
    resetTimer();
  }, [playersIn.length, resetTimer]);

  // Update player number
  const handlePlayerOutChange = useCallback((index: number, value: string) => {
    setPlayersOut(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    resetTimer();
  }, [resetTimer]);

  const handlePlayerInChange = useCallback((index: number, value: string) => {
    setPlayersIn(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    resetTimer();
  }, [resetTimer]);

  // Quick number selection
  const handleQuickNumber = useCallback((num: number) => {
    if (!activeField) {return;}
    const value = String(num);
    if (activeField.type === 'out') {
      handlePlayerOutChange(activeField.index, value);
    } else {
      handlePlayerInChange(activeField.index, value);
    }
    resetTimer();
  }, [activeField, handlePlayerOutChange, handlePlayerInChange, resetTimer]);

  // Confirm substitution
  const handleConfirm = useCallback(() => {
    if (!selectedTeam) {return;}
    const outNums = playersOut.filter(n => n.trim()).map(n => parseInt(n, 10));
    const inNums = playersIn.filter(n => n.trim()).map(n => parseInt(n, 10));
    onConfirm(selectedTeam.id, outNums, inNums);
    onClose();
  }, [selectedTeam, playersOut, playersIn, onConfirm, onClose]);

  // Check if we have at least one valid substitution
  const hasValidData = playersOut.some(n => n.trim()) || playersIn.some(n => n.trim());

  // Count mismatch warning
  const outCount = playersOut.filter(n => n.trim()).length;
  const inCount = playersIn.filter(n => n.trim()).length;
  const hasMismatch = outCount > 0 && inCount > 0 && outCount !== inCount;

  if (!isOpen) {
    return null;
  }

  // If no team preselected, show team selection (fallback)
  if (!selectedTeam) {
    return (
      <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
        <div
          style={styles.dialog}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="substitution-dialog-title"
        >
          <div style={styles.iconHeader}>
            <span style={styles.swapIcon}>🔄</span>
            <h2 id="substitution-dialog-title" style={styles.title}>Wechsel</h2>
          </div>
          <p style={styles.subtitle}>Welches Team?</p>
          <div style={styles.teamGrid}>
            <button style={styles.teamButton} onClick={onClose}>
              <span style={styles.teamLabel}>{homeTeam.name}</span>
            </button>
            <button style={styles.teamButton} onClick={onClose}>
              <span style={styles.teamLabel}>{awayTeam.name}</span>
            </button>
          </div>
          <button style={styles.cancelButton} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="substitution-dialog-title"
      >
        {/* Auto-dismiss progress bar */}
        {isActive && autoDismissSeconds > 0 && (
          <div style={styles.timerContainer}>
            <div
              style={{
                ...styles.timerBar,
                width: `${progressPercent}%`,
              }}
            />
            <span style={styles.timerText}>{remainingSeconds}s</span>
          </div>
        )}

        {/* Header with team name */}
        <div style={styles.iconHeader}>
          <span style={styles.swapIcon}>🔄</span>
          <div>
            <h2 id="substitution-dialog-title" style={styles.title}>Wechsel</h2>
            <p style={styles.teamSubtitle}>{selectedTeam.name}</p>
          </div>
        </div>

        {/* RAUS Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.outLabel}>🔴 RAUS</span>
            <button style={styles.addButton} onClick={handleAddPlayerOut} aria-label="Spieler hinzufügen">
              +
            </button>
          </div>
          <div style={styles.playerInputs}>
            {playersOut.map((value, index) => (
              <input
                key={`out-${index}`}
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="#"
                value={value}
                onChange={(e) => handlePlayerOutChange(index, e.target.value)}
                onFocus={() => setActiveField({ type: 'out', index })}
                style={{
                  ...styles.numberInputSmall,
                  borderColor: activeField !== null && activeField.type === 'out' && activeField.index === index
                    ? cssVars.colors.error
                    : cssVars.colors.borderDefault,
                }}
                min={1}
                max={99}
                autoFocus={index === 0}
              />
            ))}
          </div>
        </div>

        {/* REIN Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.inLabel}>🟢 REIN</span>
            <button style={styles.addButton} onClick={handleAddPlayerIn} aria-label="Spieler hinzufügen">
              +
            </button>
          </div>
          <div style={styles.playerInputs}>
            {playersIn.map((value, index) => (
              <input
                key={`in-${index}`}
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="#"
                value={value}
                onChange={(e) => handlePlayerInChange(index, e.target.value)}
                onFocus={() => setActiveField({ type: 'in', index })}
                style={{
                  ...styles.numberInputSmall,
                  borderColor: activeField !== null && activeField.type === 'in' && activeField.index === index
                    ? cssVars.colors.success
                    : cssVars.colors.borderDefault,
                }}
                min={1}
                max={99}
              />
            ))}
          </div>
        </div>

        {/* Mismatch Warning */}
        {hasMismatch && (
          <div style={styles.warningBanner}>
            ⚠️ Anzahl RAUS ({outCount}) ≠ REIN ({inCount})
          </div>
        )}

        {/* Quick Numbers */}
        <div style={styles.quickNumbers}>
          {QUICK_NUMBERS.map((num) => {
            const isSelectedOut = playersOut.includes(String(num));
            const isSelectedIn = playersIn.includes(String(num));
            return (
              <button
                key={num}
                style={{
                  ...styles.quickNumberButton,
                  backgroundColor: isSelectedOut
                    ? cssVars.colors.errorLight
                    : isSelectedIn
                      ? cssVars.colors.successLight
                      : cssVars.colors.surface,
                  borderColor: isSelectedOut
                    ? cssVars.colors.error
                    : isSelectedIn
                      ? cssVars.colors.success
                      : 'transparent',
                }}
                onClick={() => handleQuickNumber(num)}
              >
                {num}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.cancelButton} onClick={onClose}>
            Abbrechen
          </button>
          <button
            style={styles.confirmButton}
            onClick={handleConfirm}
            disabled={!hasValidData}
          >
            Bestätigen
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
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  timerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: cssVars.colors.surface,
    display: 'flex',
    alignItems: 'center',
  },
  timerBar: {
    height: '100%',
    backgroundColor: cssVars.colors.primary,
    transition: 'width 1s linear',
  },
  timerText: {
    position: 'absolute',
    right: cssVars.spacing.sm,
    top: 8,
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textMuted,
  },
  iconHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.sm,
  },
  swapIcon: {
    fontSize: '32px',
  },
  title: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    margin: 0,
  },
  teamSubtitle: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    textAlign: 'center',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outLabel: {
    color: cssVars.colors.error,
    fontWeight: 600,
    fontSize: cssVars.fontSizes.md,
  },
  inLabel: {
    color: cssVars.colors.success,
    fontWeight: 600,
    fontSize: cssVars.fontSizes.md,
  },
  addButton: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 600,
    color: cssVars.colors.textSecondary,
    backgroundColor: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
  playerInputs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: cssVars.spacing.sm,
  },
  numberInputSmall: {
    width: 56,
    height: 48,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 700,
    textAlign: 'center',
    backgroundColor: cssVars.colors.surface,
    border: `2px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    outline: 'none',
  },
  warningBanner: {
    backgroundColor: cssVars.colors.warningBannerBg,
    color: cssVars.colors.warning,
    padding: cssVars.spacing.sm,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    textAlign: 'center',
  },
  teamGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },
  teamButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.lg,
    backgroundColor: cssVars.colors.surface,
    border: `2px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: 56,
    transition: 'all 0.15s ease',
  },
  teamLabel: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
  },
  quickNumbers: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: cssVars.spacing.sm,
  },
  quickNumberButton: {
    height: 44,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    backgroundColor: cssVars.colors.surface,
    border: '2px solid transparent',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actions: {
    display: 'flex',
    gap: cssVars.spacing.md,
    marginTop: cssVars.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: cssVars.colors.textSecondary,
    border: `1px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
  confirmButton: {
    flex: 1,
    padding: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 600,
    backgroundColor: cssVars.colors.success,
    color: cssVars.colors.onSuccess,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
};

export default SubstitutionDialog;
