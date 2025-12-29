/**
 * GoalScorerDialog - Jersey Number Input for Goal Scorer
 *
 * Allows tournament directors to optionally record the jersey number of the scorer.
 * Simplified UX: Just enter a number (0-99) instead of selecting from player list.
 *
 * Features:
 * - 10s Auto-Dismiss Timer (Konzept §5.1)
 * - Timer resets on user interaction
 * - Visual countdown progress bar
 * - Quick-select buttons for common numbers (1-11)
 * - Manual input for any number (0-99)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';
import { useDialogTimer } from '../../../../hooks';
import moduleStyles from '../../LiveCockpit.module.css';

interface GoalScorerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback when goal is confirmed
   * @param jerseyNumber - Jersey number of scorer (null if not entered)
   * @param assists - Array of up to 2 assist jersey numbers (null entries for skipped)
   * @param incomplete - True if saved with "Ohne Nr." button
   */
  onConfirm: (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => void;
  teamName: string;
  teamColor?: string;
  /** Auto-Dismiss nach X Sekunden (default: 10, 0 = deaktiviert) */
  autoDismissSeconds?: number;
}

// Quick-select buttons for common jersey numbers
const QUICK_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function GoalScorerDialog({
  isOpen,
  onClose,
  onConfirm,
  teamName,
  teamColor = colors.primary,
  autoDismissSeconds = 10,
}: GoalScorerDialogProps) {
  const [jerseyNumber, setJerseyNumber] = useState<string>('');
  const [assist1, setAssist1] = useState<string>('');
  const [assist2, setAssist2] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss callback (stable reference) - saves as incomplete
  const handleAutoSkip = useCallback(() => {
    onConfirm(null, [], true); // incomplete = true
    setJerseyNumber('');
    setAssist1('');
    setAssist2('');
    onClose();
  }, [onConfirm, onClose]);

  // Timer hook for auto-dismiss
  const { remainingSeconds, reset: resetTimer, progressPercent, isActive } = useDialogTimer({
    durationSeconds: autoDismissSeconds,
    onExpire: handleAutoSkip,
    autoStart: isOpen && autoDismissSeconds > 0,
    paused: !isOpen,
  });

  // Reset timer and state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setJerseyNumber('');
      setAssist1('');
      setAssist2('');
      resetTimer();
      // Focus input after a short delay to ensure dialog is rendered
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, resetTimer]);

  if (!isOpen) {
    return null;
  }

  // Parse numbers from inputs
  const parsedNumber = jerseyNumber ? parseInt(jerseyNumber, 10) : null;
  const isValidNumber = parsedNumber !== null && !isNaN(parsedNumber) && parsedNumber >= 0 && parsedNumber <= 99;

  const parsedAssist1 = assist1 ? parseInt(assist1, 10) : null;
  const parsedAssist2 = assist2 ? parseInt(assist2, 10) : null;
  const isValidAssist1 = parsedAssist1 !== null && !isNaN(parsedAssist1) && parsedAssist1 >= 0 && parsedAssist1 <= 99;
  const isValidAssist2 = parsedAssist2 !== null && !isNaN(parsedAssist2) && parsedAssist2 >= 0 && parsedAssist2 <= 99;

  // Build assists array (filter out invalid entries)
  const getAssists = (): (number | null)[] => {
    const assists: (number | null)[] = [];
    if (isValidAssist1) {assists.push(parsedAssist1);}
    if (isValidAssist2) {assists.push(parsedAssist2);}
    return assists;
  };

  // "Speichern" - saves with jersey number and assists
  const handleConfirm = () => {
    onConfirm(isValidNumber ? parsedNumber : null, getAssists(), false);
    setJerseyNumber('');
    setAssist1('');
    setAssist2('');
    onClose();
  };

  // "Ohne Nr." - saves as incomplete for later completion
  const handleSkip = () => {
    onConfirm(null, [], true); // incomplete = true
    setJerseyNumber('');
    setAssist1('');
    setAssist2('');
    onClose();
  };

  // Quick-select a number
  const handleQuickSelect = (num: number) => {
    setJerseyNumber(num.toString());
    resetTimer();
  };

  // Handle input change for jersey number
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow digits, max 2 characters
    if (/^\d{0,2}$/.test(value)) {
      setJerseyNumber(value);
      resetTimer();
    }
  };

  // Handle assist input changes
  const handleAssist1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{0,2}$/.test(value)) {
      setAssist1(value);
      resetTimer();
    }
  };

  const handleAssist2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d{0,2}$/.test(value)) {
      setAssist2(value);
      resetTimer();
    }
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-scorer-dialog-title"
      >
        {/* Auto-dismiss progress bar */}
        {isActive && autoDismissSeconds > 0 && (
          <div style={styles.timerContainer}>
            <div
              style={{
                ...styles.timerProgress,
                width: `${progressPercent}%`,
                backgroundColor: progressPercent > 30 ? colors.primary : colors.warning,
              }}
            />
          </div>
        )}

        {/* Header with team color */}
        <div style={{ ...styles.header, borderColor: teamColor }}>
          <span style={styles.goalIcon}>⚽</span>
          <div>
            <div id="goal-scorer-dialog-title" style={styles.headerTitle}>Tor für</div>
            <div style={{ ...styles.teamName, color: teamColor }}>{teamName}</div>
          </div>
        </div>

        {/* Jersey Number Input */}
        <div style={styles.inputSection}>
          <label style={styles.inputLabel}>Rückennummer (optional)</label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={jerseyNumber}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="—"
            style={styles.numberInput}
            aria-label="Rückennummer eingeben"
          />
        </div>

        {/* Quick-select buttons for scorer */}
        <div style={styles.quickSelectGrid}>
          {QUICK_NUMBERS.map((num) => (
            <button
              key={num}
              style={{
                ...styles.quickButton,
                ...(jerseyNumber === num.toString() ? {
                  backgroundColor: teamColor,
                  color: colors.onPrimary,
                  borderColor: teamColor,
                } : {}),
              }}
              onClick={() => handleQuickSelect(num)}
              type="button"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Assist Input Section */}
        <div style={styles.assistSection}>
          <label style={styles.assistLabel}>Assist (optional)</label>
          <div style={styles.assistInputRow}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={assist1}
              onChange={handleAssist1Change}
              onKeyDown={handleKeyDown}
              placeholder="—"
              style={styles.assistInput}
              aria-label="Assist 1 Rückennummer"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={assist2}
              onChange={handleAssist2Change}
              onKeyDown={handleKeyDown}
              placeholder="—"
              style={styles.assistInput}
              aria-label="Assist 2 Rückennummer"
            />
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.skipButton} onClick={handleSkip}>
            Ohne Nr.{isActive && remainingSeconds > 0 ? ` (${remainingSeconds}s)` : ''}
          </button>
          <button
            style={{
              ...styles.confirmButton,
              backgroundColor: teamColor,
            }}
            onClick={handleConfirm}
          >
            Speichern
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
    maxWidth: '360px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  timerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: colors.surface,
    borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`,
    overflow: 'hidden',
  },
  timerProgress: {
    height: '100%',
    transition: 'width 0.3s linear, background-color 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottom: '3px solid',
  },
  goalIcon: {
    fontSize: '32px',
  },
  headerTitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  teamName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  inputSection: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    textAlign: 'center',
  },
  inputLabel: {
    display: 'block',
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  numberInput: {
    width: '100px',
    padding: spacing.md,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    border: `2px solid ${colors.border}`,
    borderRadius: borderRadius.lg,
    outline: 'none',
  },
  quickSelectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: spacing.xs,
    padding: `0 ${spacing.md} ${spacing.md}`,
  },
  quickButton: {
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  assistSection: {
    padding: `0 ${spacing.lg} ${spacing.md}`,
    textAlign: 'center',
  },
  assistLabel: {
    display: 'block',
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  assistInputRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: spacing.md,
  },
  assistInput: {
    width: '70px',
    padding: spacing.sm,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    outline: 'none',
  },
  actions: {
    display: 'flex',
    gap: spacing.md,
    padding: spacing.lg,
    borderTop: `1px solid ${colors.border}`,
  },
  skipButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
  confirmButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.onPrimary,
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
};

export default GoalScorerDialog;
