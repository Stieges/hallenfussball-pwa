/**
 * GoalScorerDialog - Optional Goal Scorer Selection
 *
 * Allows tournament directors to optionally record who scored.
 * Can be skipped for quick input mode.
 *
 * Features:
 * - 10s Auto-Dismiss Timer (Konzept §5.1)
 * - Timer resets on user interaction
 * - Visual countdown progress bar
 */

import { useState, useEffect, useCallback } from 'react';
import { colors, spacing, fontSizes, borderRadius } from '../../../../design-tokens';
import { useDialogTimer } from '../../../../hooks';

export interface Player {
  id: string;
  name: string;
  number?: number;
}

interface GoalScorerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (playerId: string | null) => void;
  teamName: string;
  teamColor?: string;
  players?: Player[];
  /** Auto-Dismiss nach X Sekunden (default: 10, 0 = deaktiviert) */
  autoDismissSeconds?: number;
}

export function GoalScorerDialog({
  isOpen,
  onClose,
  onConfirm,
  teamName,
  teamColor = colors.primary,
  players = [],
  autoDismissSeconds = 10,
}: GoalScorerDialogProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Auto-dismiss callback (stable reference)
  const handleAutoSkip = useCallback(() => {
    onConfirm(null);
    setSelectedPlayer(null);
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
      setSelectedPlayer(null);
      resetTimer();
    }
  }, [isOpen, resetTimer]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm(selectedPlayer);
    setSelectedPlayer(null);
    onClose();
  };

  const handleSkip = () => {
    onConfirm(null);
    setSelectedPlayer(null);
    onClose();
  };

  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayer(playerId);
    // Reset timer on user interaction
    resetTimer();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
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
            <div style={styles.headerTitle}>Tor für</div>
            <div style={{ ...styles.teamName, color: teamColor }}>{teamName}</div>
          </div>
        </div>

        {/* Player List */}
        {players.length > 0 ? (
          <div style={styles.playerList}>
            {players.map((player) => (
              <button
                key={player.id}
                style={{
                  ...styles.playerButton,
                  ...(selectedPlayer === player.id ? styles.playerButtonSelected : {}),
                }}
                onClick={() => handlePlayerSelect(player.id)}
              >
                {player.number && (
                  <span style={styles.playerNumber}>#{player.number}</span>
                )}
                <span style={styles.playerName}>{player.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={styles.noPlayers}>
            <p style={styles.noPlayersText}>
              Keine Spieler hinterlegt.
            </p>
            <p style={styles.noPlayersHint}>
              Tor wird ohne Torschütze erfasst.
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.skipButton} onClick={handleSkip}>
            Überspringen{isActive && remainingSeconds > 0 ? ` (${remainingSeconds}s)` : ''}
          </button>
          {players.length > 0 && (
            <button
              style={{
                ...styles.confirmButton,
                backgroundColor: teamColor,
                opacity: selectedPlayer ? 1 : 0.5,
              }}
              onClick={handleConfirm}
              disabled={!selectedPlayer}
            >
              Bestätigen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.xl,
    maxWidth: '400px',
    width: '100%',
    maxHeight: '80vh',
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
    fontWeight: 600,
  },
  playerList: {
    flex: 1,
    overflowY: 'auto',
    padding: spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  playerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    border: `2px solid transparent`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  playerButtonSelected: {
    backgroundColor: `${colors.primary}20`,
    borderColor: colors.primary,
  },
  playerNumber: {
    fontSize: fontSizes.sm,
    fontWeight: 600,
    color: colors.textSecondary,
    minWidth: '36px',
  },
  playerName: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  noPlayers: {
    padding: spacing.xl,
    textAlign: 'center',
  },
  noPlayersText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    margin: 0,
    marginBottom: spacing.sm,
  },
  noPlayersHint: {
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
    margin: 0,
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
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: 600,
    color: colors.onPrimary,
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: '48px',
  },
};

export default GoalScorerDialog;
