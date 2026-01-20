/**
 * PostMatchModal
 *
 * Modal displayed after a match ends. Shows final score, plays sound,
 * and provides auto-advance countdown to next match.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.6
 */

import { CSSProperties, useCallback, useEffect, useState, useRef } from 'react';
import { cssVars } from '../../design-tokens';
import { useFocusTrap } from '../../hooks/useFocusTrap';

// =============================================================================
// Types
// =============================================================================

export interface PostMatchModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Home team name */
  homeTeamName: string;
  /** Away team name */
  awayTeamName: string;
  /** Final home score */
  homeScore: number;
  /** Final away score */
  awayScore: number;
  /** Match label (e.g., "Spiel 12 – Gruppe A") */
  matchLabel: string;
  /** Whether this is a final match */
  isFinalMatch?: boolean;
  /** How the match was decided (for finals) */
  decidedBy?: 'regular' | 'overtime' | 'goldenGoal' | 'penalty';
  /** Whether auto-advance is enabled */
  autoAdvanceEnabled: boolean;
  /** Seconds until auto-advance */
  autoAdvanceSeconds: number;
  /** Callback when user wants to load next match */
  onLoadNextMatch: () => void;
  /** Callback when user wants to stay on current match */
  onStay: () => void;
  /** Callback when user wants to edit the score */
  onEditScore: () => void;
  /** Callback when user wants to reopen the match */
  onReopenMatch: () => void;
  /** Whether there is a next match available */
  hasNextMatch: boolean;
  /** Label for the next match (optional) */
  nextMatchLabel?: string;
}

// =============================================================================
// Component
// =============================================================================

export function PostMatchModal({
  isOpen,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  matchLabel,
  isFinalMatch = false,
  decidedBy,
  autoAdvanceEnabled,
  autoAdvanceSeconds,
  onLoadNextMatch,
  onStay,
  onEditScore,
  onReopenMatch,
  hasNextMatch,
  nextMatchLabel,
}: PostMatchModalProps): React.ReactNode {
  const [countdown, setCountdown] = useState(autoAdvanceSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Determine winner
  const isDraw = homeScore === awayScore;
  const homeWins = homeScore > awayScore;

  // Get decided by label
  const getDecidedByLabel = () => {
    switch (decidedBy) {
      case 'overtime':
        return 'nach Verlängerung';
      case 'goldenGoal':
        return 'durch Golden Goal';
      case 'penalty':
        return 'im Elfmeterschießen';
      default:
        return null;
    }
  };

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(autoAdvanceSeconds);
      setIsPaused(false);
    }
  }, [isOpen, autoAdvanceSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !autoAdvanceEnabled || !hasNextMatch || isPaused) {
      return;
    }

    if (countdown <= 0) {
      onLoadNextMatch();
      return;
    }

    countdownRef.current = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [isOpen, autoAdvanceEnabled, hasNextMatch, isPaused, countdown, onLoadNextMatch]);

  // Handle pause/resume
  const handlePauseToggle = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Handle cancel auto-advance
  const handleCancel = useCallback(() => {
    setIsPaused(true);
    onStay();
  }, [onStay]);

  // Focus trap for accessibility (WCAG 4.1.3)
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: handleCancel,
  });

  if (!isOpen) {
    return null;
  }

  const decidedByLabel = getDecidedByLabel();
  const progressPercent = autoAdvanceEnabled
    ? ((autoAdvanceSeconds - countdown) / autoAdvanceSeconds) * 100
    : 0;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="post-match-title">
      <div ref={focusTrap.containerRef} style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.matchLabel}>{matchLabel}</div>
          {isFinalMatch && <div style={styles.finalBadge}>Finalspiel</div>}
        </div>

        {/* Score Display */}
        <div style={styles.scoreContainer}>
          <div style={{ ...styles.teamBlock, opacity: !isDraw && !homeWins ? 0.6 : 1 }}>
            <div style={styles.teamName}>{homeTeamName}</div>
            <div style={{ ...styles.score, ...(homeWins && !isDraw ? styles.winnerScore : {}) }}>
              {homeScore}
            </div>
          </div>

          <div style={styles.separator}>:</div>

          <div style={{ ...styles.teamBlock, opacity: !isDraw && homeWins ? 0.6 : 1 }}>
            <div style={styles.teamName}>{awayTeamName}</div>
            <div style={{ ...styles.score, ...(!homeWins && !isDraw ? styles.winnerScore : {}) }}>
              {awayScore}
            </div>
          </div>
        </div>

        {/* Decided By Label */}
        {decidedByLabel && (
          <div style={styles.decidedBy}>{decidedByLabel}</div>
        )}

        {/* Result Text */}
        <div style={styles.resultText}>
          {isDraw
            ? 'Unentschieden'
            : `${homeWins ? homeTeamName : awayTeamName} gewinnt!`}
        </div>

        {/* Auto-Advance Countdown */}
        {autoAdvanceEnabled && hasNextMatch && (
          <div style={styles.countdownContainer}>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progressPercent}%`,
                }}
              />
            </div>
            <div style={styles.countdownText}>
              {isPaused ? (
                <span style={styles.pausedText}>Automatisches Laden pausiert</span>
              ) : (
                <>
                  Nächstes Spiel in <strong>{countdown}</strong> Sekunden
                  {nextMatchLabel && (
                    <span style={styles.nextMatchLabel}> ({nextMatchLabel})</span>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handlePauseToggle}
              style={styles.pauseButton}
            >
              {isPaused ? '▶ Fortsetzen' : '⏸ Pausieren'}
            </button>
          </div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          {hasNextMatch && (
            <button
              type="button"
              onClick={onLoadNextMatch}
              style={styles.primaryButton}
            >
              Nächstes Spiel laden →
            </button>
          )}

          <div style={styles.secondaryActions}>
            <button
              type="button"
              onClick={onEditScore}
              style={styles.secondaryButton}
            >
              Ergebnis korrigieren
            </button>
            <button
              type="button"
              onClick={onReopenMatch}
              style={styles.secondaryButton}
            >
              Spiel wieder aufnehmen
            </button>
          </div>

          {!hasNextMatch && (
            <div style={styles.noMoreMatches}>
              Keine weiteren Spiele auf diesem Feld.
              <button
                type="button"
                onClick={handleCancel}
                style={styles.closeButton}
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: cssVars.spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: '480px',
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.xl,
    padding: cssVars.spacing.xl,
    textAlign: 'center',
    animation: 'modalSlideIn 0.3s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.lg,
  },
  matchLabel: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  finalBadge: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.accent,
    background: cssVars.colors.accentLight,
    borderRadius: cssVars.borderRadius.md,
    textTransform: 'uppercase',
  },
  scoreContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.md,
  },
  teamBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    flex: 1,
    transition: 'opacity 0.3s ease',
  },
  teamName: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  score: {
    fontSize: '64px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  winnerScore: {
    color: cssVars.colors.success,
  },
  separator: {
    fontSize: '48px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textSecondary,
  },
  decidedBy: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: cssVars.spacing.sm,
  },
  resultText: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.xl,
  },
  countdownContainer: {
    marginBottom: cssVars.spacing.xl,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.lg,
  },
  progressBar: {
    height: '4px',
    background: cssVars.colors.border,
    borderRadius: cssVars.borderRadius.full,
    overflow: 'hidden',
    marginBottom: cssVars.spacing.sm,
  },
  progressFill: {
    height: '100%',
    background: cssVars.colors.primary,
    transition: 'width 1s linear',
  },
  countdownText: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.sm,
  },
  pausedText: {
    color: cssVars.colors.warning,
  },
  nextMatchLabel: {
    opacity: 0.7,
  },
  pauseButton: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },
  primaryButton: {
    width: '100%',
    padding: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.onPrimary,
    background: cssVars.colors.primary,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: '52px',
  },
  secondaryActions: {
    display: 'flex',
    gap: cssVars.spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    padding: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
    background: cssVars.colors.surfaceLight,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
  noMoreMatches: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    alignItems: 'center',
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
  },
  closeButton: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.surfaceLight,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
  },
};

export default PostMatchModal;
