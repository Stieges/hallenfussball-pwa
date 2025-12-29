/**
 * SubstitutionDialog - Player Substitution Dialog
 *
 * Allows tournament directors to record player substitutions.
 * Flow: Team → Player Out → Player In
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §5.4
 */

import { useState, useEffect, useCallback } from 'react';
import { colors, spacing, fontSizes, borderRadius } from '../../../../design-tokens';
import moduleStyles from '../../LiveCockpit.module.css';

interface Team {
  id: string;
  name: string;
}

interface SubstitutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (teamId: string, playerOutNumber?: number, playerInNumber?: number) => void;
  homeTeam: Team;
  awayTeam: Team;
}

export function SubstitutionDialog({
  isOpen,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
}: SubstitutionDialogProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [playerOutNumber, setPlayerOutNumber] = useState<string>('');
  const [playerInNumber, setPlayerInNumber] = useState<string>('');
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedTeam(null);
      setPlayerOutNumber('');
      setPlayerInNumber('');
      setStep(1);
    }
  }, [isOpen]);

  const handleTeamSelect = useCallback((team: Team) => {
    setSelectedTeam(team);
    setStep(2);
  }, []);

  const handlePlayerOutConfirm = useCallback(() => {
    setStep(3);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedTeam) {
      return;
    }
    const outNum = playerOutNumber.trim() ? parseInt(playerOutNumber, 10) : undefined;
    const inNum = playerInNumber.trim() ? parseInt(playerInNumber, 10) : undefined;
    onConfirm(selectedTeam.id, outNum, inNum);
    onClose();
  }, [selectedTeam, playerOutNumber, playerInNumber, onConfirm, onClose]);

  const handleBack = useCallback(() => {
    if (step === 3) {
      setStep(2);
      setPlayerInNumber('');
    } else if (step === 2) {
      setStep(1);
      setPlayerOutNumber('');
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    if (!selectedTeam) {
      return;
    }
    onConfirm(selectedTeam.id, undefined, undefined);
    onClose();
  }, [selectedTeam, onConfirm, onClose]);

  if (!isOpen) {
    return null;
  }

  const renderStep1Team = () => (
    <>
      <div style={styles.iconHeader}>
        <span style={styles.swapIcon}>🔄</span>
        <h2 id="substitution-dialog-title" style={styles.title}>Wechsel</h2>
      </div>
      <p style={styles.subtitle}>Welches Team?</p>

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

  const renderStep2PlayerOut = () => (
    <>
      <div style={styles.headerWithBack}>
        <button style={styles.backButton} onClick={handleBack} aria-label="Zurück">
          ←
        </button>
        <div style={styles.headerContent}>
          <span style={styles.swapIconSmall}>🔄</span>
          <div>
            <h2 style={styles.titleSmall}>Wechsel</h2>
            <p style={styles.teamSubtitle}>{selectedTeam?.name}</p>
          </div>
        </div>
        <div style={{ width: 44 }} />
      </div>

      <p style={styles.subtitle}>
        <span style={styles.outLabel}>RAUS</span> - Rückennummer
      </p>

      <div style={styles.inputContainer}>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="#"
          value={playerOutNumber}
          onChange={(e) => setPlayerOutNumber(e.target.value)}
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
                playerOutNumber === String(num)
                  ? colors.errorLight
                  : colors.surface,
              borderColor:
                playerOutNumber === String(num) ? colors.error : 'transparent',
            }}
            onClick={() => setPlayerOutNumber(String(num))}
          >
            {num}
          </button>
        ))}
      </div>

      <div style={styles.actions}>
        <button style={styles.skipButton} onClick={handleSkip}>
          Überspringen
        </button>
        <button
          style={styles.nextButton}
          onClick={handlePlayerOutConfirm}
        >
          Weiter
        </button>
      </div>
    </>
  );

  const renderStep3PlayerIn = () => (
    <>
      <div style={styles.headerWithBack}>
        <button style={styles.backButton} onClick={handleBack} aria-label="Zurück">
          ←
        </button>
        <div style={styles.headerContent}>
          <span style={styles.swapIconSmall}>🔄</span>
          <div>
            <h2 style={styles.titleSmall}>Wechsel</h2>
            <p style={styles.teamSubtitle}>
              {selectedTeam?.name} · #{playerOutNumber || '?'} raus
            </p>
          </div>
        </div>
        <div style={{ width: 44 }} />
      </div>

      <p style={styles.subtitle}>
        <span style={styles.inLabel}>REIN</span> - Rückennummer
      </p>

      <div style={styles.inputContainer}>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="#"
          value={playerInNumber}
          onChange={(e) => setPlayerInNumber(e.target.value)}
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
                playerInNumber === String(num)
                  ? colors.successLight
                  : colors.surface,
              borderColor:
                playerInNumber === String(num) ? colors.success : 'transparent',
            }}
            onClick={() => setPlayerInNumber(String(num))}
          >
            {num}
          </button>
        ))}
      </div>

      <div style={styles.actions}>
        <button style={styles.skipButton} onClick={handleConfirm}>
          Ohne Nummer
        </button>
        <button
          style={styles.confirmButton}
          onClick={handleConfirm}
          disabled={!playerInNumber.trim()}
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
        aria-labelledby="substitution-dialog-title"
      >
        {step === 1 && renderStep1Team()}
        {step === 2 && renderStep2PlayerOut()}
        {step === 3 && renderStep3PlayerIn()}
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
  iconHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  swapIcon: {
    fontSize: '32px',
  },
  swapIconSmall: {
    fontSize: '24px',
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
    fontSize: fontSizes.xl,
    color: colors.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
    textAlign: 'center',
  },
  titleSmall: {
    fontSize: fontSizes.lg,
    fontWeight: 600,
    color: colors.textPrimary,
    margin: 0,
  },
  teamSubtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    margin: 0,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    margin: 0,
    textAlign: 'center',
  },
  outLabel: {
    color: colors.error,
    fontWeight: 600,
  },
  inLabel: {
    color: colors.success,
    fontWeight: 600,
  },
  teamGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  teamButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    border: `2px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: 56,
    transition: 'all 0.15s ease',
  },
  teamLabel: {
    fontSize: fontSizes.lg,
    fontWeight: 600,
    color: colors.textPrimary,
  },
  inputContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
  numberInput: {
    width: 100,
    height: 64,
    fontSize: fontSizes.xxl,
    fontWeight: 700,
    textAlign: 'center',
    backgroundColor: colors.surface,
    border: `2px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.lg,
    color: colors.textPrimary,
    outline: 'none',
  },
  quickNumbers: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: spacing.sm,
  },
  quickNumberButton: {
    height: 44,
    fontSize: fontSizes.md,
    fontWeight: 600,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    border: '2px solid transparent',
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actions: {
    display: 'flex',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  cancelButton: {
    width: '100%',
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
  skipButton: {
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
  nextButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: 600,
    backgroundColor: colors.secondary,
    color: colors.onSecondary,
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
  confirmButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: 600,
    backgroundColor: colors.success,
    color: colors.onSuccess,
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
};

export default SubstitutionDialog;
