/**
 * CardDialog - Card Assignment Dialog
 *
 * Allows tournament directors to assign yellow or red cards to players.
 *
 * BUG-007 FIX: When preselectedCardType and preselectedTeamSide are provided,
 * the dialog skips directly to player number input with 10s auto-close.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §5.2
 *
 * Card colors:
 * - Yellow: cssVars.colors.accent (#FFD700)
 * - Red: cssVars.colors.error
 */

import { useState, useEffect, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens'
import { useDialogTimer } from '../../../../hooks';
import type { CardType } from '../../../../types/tournament';
import moduleStyles from '../../LiveCockpit.module.css';

interface Team {
  id: string;
  name: string;
}

interface CardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback when card is confirmed
   * @param cardType - Yellow or Red card
   * @param teamId - Team that received the card
   * @param playerNumber - Player number (optional)
   * @param incomplete - True if saved with "Ohne Details" button
   */
  onConfirm: (cardType: CardType, teamId: string, playerNumber?: number, incomplete?: boolean) => void;
  homeTeam: Team;
  awayTeam: Team;
  /** Pre-select card type (optional) */
  initialCardType?: CardType;
  /** BUG-007: Pre-selected team side (skips step 2) */
  preselectedTeamSide?: 'home' | 'away';
  /** Auto-Dismiss nach X Sekunden (default: 10, 0 = deaktiviert) */
  autoDismissSeconds?: number;
}

// Card type colors
const cardColors = {
  YELLOW: cssVars.colors.accent, // #FFD700
  RED: cssVars.colors.error,
} as const;

export function CardDialog({
  isOpen,
  onClose,
  onConfirm,
  homeTeam,
  awayTeam,
  initialCardType,
  preselectedTeamSide,
  autoDismissSeconds = 10,
}: CardDialogProps) {
  const [cardType, setCardType] = useState<CardType | null>(initialCardType ?? null);
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

  // BUG-007: Determine if we're in quick mode (both card type and team preselected)
  const isQuickMode = initialCardType !== undefined && preselectedTeamSide !== undefined;

  // BUG-007: Auto-save without player number (for auto-dismiss)
  const handleAutoSkip = useCallback(() => {
    if (!cardType || !selectedTeam) {
      return;
    }
    onConfirm(cardType, selectedTeam.id, undefined, true); // incomplete = true
    onClose();
  }, [cardType, selectedTeam, onConfirm, onClose]);

  // BUG-007: Timer hook for auto-dismiss (only in quick mode at step 3)
  const { remainingSeconds, reset: resetTimer, progressPercent, isActive } = useDialogTimer({
    durationSeconds: isQuickMode ? autoDismissSeconds : 0,
    onExpire: handleAutoSkip,
    autoStart: isOpen && isQuickMode && autoDismissSeconds > 0,
    paused: !isOpen || step !== 3,
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // BUG-007: If both card type and team side preselected, skip to step 3 directly
      if (initialCardType !== undefined && preselectedTeamSide !== undefined) {
        setCardType(initialCardType);
        setSelectedTeam(preselectedTeamSide === 'home' ? homeTeam : awayTeam);
        setStep(3);
      } else if (initialCardType !== undefined) {
        setCardType(initialCardType);
        setSelectedTeam(null);
        setStep(2);
      } else {
        setCardType(null);
        setSelectedTeam(null);
        setStep(1);
      }
      setPlayerNumber('');
      resetTimer();
    }
  }, [isOpen, initialCardType, preselectedTeamSide, homeTeam, awayTeam, resetTimer]);

  const handleCardTypeSelect = useCallback((type: CardType) => {
    setCardType(type);
    setStep(2);
  }, []);

  const handleTeamSelect = useCallback((team: Team) => {
    setSelectedTeam(team);
    setStep(3);
  }, []);

  // "Speichern" - saves with complete details
  const handleConfirm = useCallback(() => {
    if (!cardType || !selectedTeam) {
      return;
    }
    const num = playerNumber.trim() ? parseInt(playerNumber, 10) : undefined;
    onConfirm(cardType, selectedTeam.id, num, false); // incomplete = false
    onClose();
  }, [cardType, selectedTeam, playerNumber, onConfirm, onClose]);

  const handleBack = useCallback(() => {
    // BUG-007: In quick mode, close dialog instead of going back
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
    if (!cardType || !selectedTeam) {
      return;
    }
    onConfirm(cardType, selectedTeam.id, undefined, true); // incomplete = true
    onClose();
  }, [cardType, selectedTeam, onConfirm, onClose]);

  if (!isOpen) {
    return null;
  }

  const renderStep1CardType = () => (
    <>
      <h2 id="card-dialog-title" style={styles.title}>Karte vergeben</h2>
      <p style={styles.subtitle}>Welche Karte?</p>

      <div style={styles.cardTypeGrid}>
        <button
          style={{
            ...styles.cardTypeButton,
            backgroundColor: `${cardColors.YELLOW}15`,
            borderColor: cardColors.YELLOW,
          }}
          onClick={() => handleCardTypeSelect('YELLOW')}
        >
          <div
            style={{
              ...styles.cardIcon,
              backgroundColor: cardColors.YELLOW,
            }}
          />
          <span style={{ ...styles.cardTypeLabel, color: cardColors.YELLOW }}>
            Gelb
          </span>
        </button>

        <button
          style={{
            ...styles.cardTypeButton,
            backgroundColor: `${cardColors.RED}15`,
            borderColor: cardColors.RED,
          }}
          onClick={() => handleCardTypeSelect('RED')}
        >
          <div
            style={{
              ...styles.cardIcon,
              backgroundColor: cardColors.RED,
            }}
          />
          <span style={{ ...styles.cardTypeLabel, color: cardColors.RED }}>
            Rot
          </span>
        </button>
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
          <div
            style={{
              ...styles.cardBadge,
              backgroundColor: cardType === 'YELLOW' ? cardColors.YELLOW : cardColors.RED,
            }}
          />
          <h2 style={styles.title}>
            {cardType === 'YELLOW' ? 'Gelbe' : 'Rote'} Karte
          </h2>
        </div>
        <div style={{ width: 44 }} /> {/* Spacer for centering */}
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
          <div
            style={{
              ...styles.cardBadge,
              backgroundColor: cardType === 'YELLOW' ? cardColors.YELLOW : cardColors.RED,
            }}
          />
          <div>
            <h2 style={styles.titleSmall}>
              {cardType === 'YELLOW' ? 'Gelbe' : 'Rote'} Karte
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
          onChange={(e) => setPlayerNumber(e.target.value)}
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
              // BUG-007: Reset timer on selection
              if (isQuickMode) {
                resetTimer();
              }
            }}
          >
            {num}
          </button>
        ))}
      </div>

      <div style={styles.actions}>
        <button style={styles.skipButton} onClick={handleSkipPlayer}>
          Ohne Details
        </button>
        <button
          style={{
            ...styles.confirmButton,
            backgroundColor:
              cardType === 'YELLOW' ? cardColors.YELLOW : cardColors.RED,
            color: cardType === 'YELLOW' ? cssVars.colors.onWarning : cssVars.colors.onError,
          }}
          onClick={handleConfirm}
          disabled={!playerNumber.trim()}
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
        aria-labelledby="card-dialog-title"
      >
        {/* BUG-007: Timer progress bar (only visible in quick mode at step 3) */}
        {isQuickMode && isActive && step === 3 && (
          <div style={styles.timerContainer}>
            <div
              style={{
                ...styles.timerProgress,
                width: `${progressPercent}%`,
                backgroundColor: remainingSeconds <= 3 ? cssVars.colors.error : cssVars.colors.primary,
              }}
            />
          </div>
        )}
        {step === 1 && renderStep1CardType()}
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
    position: 'relative', // BUG-007: Needed for timer progress bar
    backgroundColor: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.xl,
    padding: cssVars.spacing.xl,
    maxWidth: '400px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
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
  cardBadge: {
    width: 24,
    height: 32,
    borderRadius: 4,
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
  cardTypeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: cssVars.spacing.md,
  },
  cardTypeButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.xl,
    border: '2px solid',
    borderRadius: cssVars.borderRadius.xl,
    cursor: 'pointer',
    minHeight: 120,
    transition: 'transform 0.15s ease',
  },
  cardIcon: {
    width: 48,
    height: 64,
    borderRadius: 6,
    boxShadow: `0 4px 12px ${cssVars.colors.shadowMedium}`,
  },
  cardTypeLabel: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 600,
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
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
  // BUG-007: Timer styles
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
    transition: 'width 0.3s linear, background-color 0.3s ease',
  },
};

export default CardDialog;
