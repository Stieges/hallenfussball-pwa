/**
 * TimePenaltyDialog - Time Penalty Assignment Dialog
 *
 * Allows tournament directors to assign time penalties (1, 2, or 5 minutes).
 *
 * BUG-006 FIX: When preselectedDuration and preselectedTeam are provided,
 * the dialog skips directly to player number input with 10s auto-close.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §5.3
 *
 * Time penalties run a countdown and are displayed in PenaltyIndicators.
 */

import { useState, useEffect, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens'
import { useDialogTimer } from '../../../../hooks';
import moduleStyles from '../../LiveCockpit.module.css';

interface Team {
  id: string;
  name: string;
}

interface TimePenaltyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback when time penalty is confirmed
   * @param durationSeconds - Penalty duration in seconds
   * @param teamId - Team that received the penalty
   * @param playerNumber - Player number (optional)
   * @param incomplete - True if saved with "Ohne Details" button
   */
  onConfirm: (durationSeconds: number, teamId: string, playerNumber?: number, incomplete?: boolean) => void;
  homeTeam: Team;
  awayTeam: Team;
  /** BUG-006: Pre-selected duration in seconds (skips step 1) */
  preselectedDurationSeconds?: number;
  /** BUG-006: Pre-selected team side (skips step 2) */
  preselectedTeamSide?: 'home' | 'away';
  /** Auto-Dismiss nach X Sekunden (default: 10, 0 = deaktiviert) */
  autoDismissSeconds?: number;
}

// Available penalty durations
const PENALTY_DURATIONS = [
  { seconds: 60, label: '1 Min' },
  { seconds: 120, label: '2 Min' },
  { seconds: 300, label: '5 Min' },
] as const;

export function TimePenaltyDialog({
  isOpen,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
  preselectedDurationSeconds,
  preselectedTeamSide,
  autoDismissSeconds = 10,
}: TimePenaltyDialogProps) {
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [playerNumber, setPlayerNumber] = useState<string>('');
  const [step, setStep] = useState<1 | 2 | 3>(1);

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

  // BUG-006: Determine if we're in quick mode (preselected values)
  const isQuickMode = preselectedDurationSeconds !== undefined && preselectedTeamSide !== undefined;

  // Auto-dismiss callback - saves as incomplete
  const handleAutoSkip = useCallback(() => {
    const duration = preselectedDurationSeconds ?? durationSeconds;
    const team = preselectedTeamSide ? (preselectedTeamSide === 'home' ? homeTeam : awayTeam) : selectedTeam;
    if (duration && team) {
      onConfirm(duration, team.id, undefined, true);
    }
    onClose();
  }, [preselectedDurationSeconds, durationSeconds, preselectedTeamSide, homeTeam, awayTeam, selectedTeam, onConfirm, onClose]);

  // Timer hook for auto-dismiss (only in quick mode)
  const { remainingSeconds, reset: resetTimer, progressPercent, isActive } = useDialogTimer({
    durationSeconds: isQuickMode ? autoDismissSeconds : 0,
    onExpire: handleAutoSkip,
    autoStart: isOpen && isQuickMode && autoDismissSeconds > 0,
    paused: !isOpen,
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // BUG-006: If preselected values, skip to step 3 directly
      if (preselectedDurationSeconds !== undefined && preselectedTeamSide !== undefined) {
        setDurationSeconds(preselectedDurationSeconds);
        setSelectedTeam(preselectedTeamSide === 'home' ? homeTeam : awayTeam);
        setStep(3);
      } else {
        setDurationSeconds(null);
        setSelectedTeam(null);
        setStep(1);
      }
      setPlayerNumber('');
      resetTimer();
    }
  }, [isOpen, preselectedDurationSeconds, preselectedTeamSide, homeTeam, awayTeam, resetTimer]);

  const handleDurationSelect = useCallback((seconds: number) => {
    setDurationSeconds(seconds);
    setStep(2);
  }, []);

  const handleTeamSelect = useCallback((team: Team) => {
    setSelectedTeam(team);
    setStep(3);
  }, []);

  // "Speichern" - saves with complete details
  const handleConfirm = useCallback(() => {
    if (!durationSeconds || !selectedTeam) {
      return;
    }
    const num = playerNumber.trim() ? parseInt(playerNumber, 10) : undefined;
    onConfirm(durationSeconds, selectedTeam.id, num, false); // incomplete = false
    onClose();
  }, [durationSeconds, selectedTeam, playerNumber, onConfirm, onClose]);

  const handleBack = useCallback(() => {
    // BUG-006: In quick mode, we can't go back (no previous steps)
    if (isQuickMode) {
      onClose();
      return;
    }
    if (step === 3) {
      setStep(2);
      setPlayerNumber('');
    } else if (step === 2) {
      setStep(1);
      setSelectedTeam(null);
    }
  }, [step, isQuickMode, onClose]);

  // "Ohne Details" - saves as incomplete for later completion
  const handleSkipPlayer = useCallback(() => {
    if (!durationSeconds || !selectedTeam) {
      return;
    }
    onConfirm(durationSeconds, selectedTeam.id, undefined, true); // incomplete = true
    onClose();
  }, [durationSeconds, selectedTeam, onConfirm, onClose]);

  if (!isOpen) {
    return null;
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} Min`;
  };

  const renderStep1Duration = () => (
    <>
      <div style={styles.iconHeader}>
        <span style={styles.timerIcon}>⏱️</span>
        <h2 id="penalty-dialog-title" style={styles.title}>Zeitstrafe</h2>
      </div>
      <p style={styles.subtitle}>Strafzeit wählen</p>

      <div style={styles.durationGrid}>
        {PENALTY_DURATIONS.map(({ seconds, label }) => (
          <button
            key={seconds}
            style={styles.durationButton}
            onClick={() => handleDurationSelect(seconds)}
          >
            <span style={styles.durationValue}>{label}</span>
          </button>
        ))}
      </div>

      <button style={styles.cancelButton} onClick={onClose}>
        Abbrechen
      </button>
    </>
  );

  const renderStep2Team = () => (
    <>
      <div style={styles.headerWithBack}>
        <button style={styles.backButton} onClick={handleBack} aria-label="Zurück">
          ←
        </button>
        <div style={styles.headerContent}>
          <span style={styles.timerIconSmall}>⏱️</span>
          <h2 style={styles.title}>
            {formatDuration(durationSeconds ?? 0)} Zeitstrafe
          </h2>
        </div>
        <div style={{ width: 44 }} />
      </div>

      <p style={styles.subtitle}>Für welches Team?</p>

      <div style={styles.teamGrid}>
        <button
          style={styles.teamButton}
          onClick={() => handleTeamSelect(homeTeam)}
        >
          <span style={styles.teamLabel}>{homeTeam.name}</span>
        </button>

        <button
          style={styles.teamButton}
          onClick={() => handleTeamSelect(awayTeam)}
        >
          <span style={styles.teamLabel}>{awayTeam.name}</span>
        </button>
      </div>

      <button style={styles.cancelButton} onClick={onClose}>
        Abbrechen
      </button>
    </>
  );

  const renderStep3Player = () => (
    <>
      <div style={styles.headerWithBack}>
        <button style={styles.backButton} onClick={handleBack} aria-label="Zurück">
          ←
        </button>
        <div style={styles.headerContent}>
          <span style={styles.timerIconSmall}>⏱️</span>
          <div>
            <h2 style={styles.titleSmall}>
              {formatDuration(durationSeconds ?? 0)} Zeitstrafe
            </h2>
            <p style={styles.teamSubtitle}>{selectedTeam?.name}</p>
          </div>
        </div>
        <div style={{ width: 44 }} />
      </div>

      <p style={styles.subtitle}>Rückennummer (optional)</p>

      <div style={styles.inputContainer}>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="#"
          value={playerNumber}
          onChange={(e) => {
            setPlayerNumber(e.target.value);
            resetTimer();
          }}
          style={styles.numberInput}
          autoFocus
          min={1}
          max={99}
        />
      </div>

      <div style={styles.quickNumbers}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
          <button
            key={num}
            style={{
              ...styles.quickNumberButton,
              backgroundColor:
                playerNumber === String(num)
                  ? cssVars.colors.primaryLight
                  : cssVars.colors.surface,
              borderColor:
                playerNumber === String(num) ? cssVars.colors.primary : 'transparent',
            }}
            onClick={() => {
              setPlayerNumber(String(num));
              resetTimer();
            }}
          >
            {num}
          </button>
        ))}
      </div>

      <div style={styles.actions}>
        <button style={styles.skipButton} onClick={handleSkipPlayer}>
          Ohne Nr.{isActive && remainingSeconds > 0 ? ` (${remainingSeconds}s)` : ''}
        </button>
        <button
          style={styles.confirmButton}
          onClick={handleConfirm}
        >
          Speichern
        </button>
      </div>
    </>
  );

  return (
    <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="penalty-dialog-title"
      >
        {/* BUG-006: Auto-dismiss progress bar in quick mode */}
        {isActive && isQuickMode && autoDismissSeconds > 0 && (
          <div style={styles.timerContainer}>
            <div
              style={{
                ...styles.timerProgress,
                width: `${progressPercent}%`,
                backgroundColor: progressPercent > 30 ? cssVars.colors.primary : cssVars.colors.warning,
              }}
            />
          </div>
        )}
        {step === 1 && renderStep1Duration()}
        {step === 2 && renderStep2Team()}
        {step === 3 && renderStep3Player()}
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
    gap: cssVars.spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  timerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: cssVars.colors.surface,
    borderRadius: `${cssVars.borderRadius.xl} ${cssVars.borderRadius.xl} 0 0`,
    overflow: 'hidden',
  },
  timerProgress: {
    height: '100%',
    transition: 'width 1s linear, background-color 0.3s ease',
  },
  iconHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
  },
  timerIcon: {
    fontSize: '32px',
  },
  timerIconSmall: {
    fontSize: cssVars.fontSizes.xxl,
  },
  headerWithBack: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.xl,
    color: cssVars.colors.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  title: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    margin: 0,
    textAlign: 'center',
  },
  titleSmall: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    margin: 0,
  },
  teamSubtitle: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
  },
  subtitle: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    textAlign: 'center',
  },
  durationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: cssVars.spacing.md,
  },
  durationButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.lg,
    backgroundColor: `${cssVars.colors.primary}15`,
    border: `2px solid ${cssVars.colors.primary}`,
    borderRadius: cssVars.borderRadius.xl,
    cursor: 'pointer',
    minHeight: 80,
    transition: 'transform 0.15s ease',
  },
  durationValue: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 700,
    color: cssVars.colors.primary,
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
  inputContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
  numberInput: {
    width: 100,
    height: 64,
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: 700,
    textAlign: 'center',
    backgroundColor: cssVars.colors.surface,
    border: `2px solid ${cssVars.colors.borderDefault}`,
    borderRadius: cssVars.borderRadius.lg,
    color: cssVars.colors.textPrimary,
    outline: 'none',
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
    width: '100%',
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
  skipButton: {
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
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
};

export default TimePenaltyDialog;
