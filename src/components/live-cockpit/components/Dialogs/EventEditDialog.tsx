/**
 * EventEditDialog - Edit or Complete an Event
 *
 * Allows tournament directors to add missing details to events
 * that were created with "Ohne Details" (incomplete).
 *
 * Features:
 * - Shows event type icon and description
 * - Allows editing player number
 * - "Löschen" button to delete the event (Undo)
 * - "Speichern" button to save changes
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §4.3
 */

import { useState, useEffect, useCallback } from 'react';
import { colors, spacing, fontSizes, borderRadius } from '../../../../design-tokens';
import type { MatchEvent } from '../../../../types/tournament';
import moduleStyles from '../../LiveCockpit.module.css';

interface Team {
  id: string;
  name: string;
}

interface EventEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: MatchEvent | null;
  homeTeam: Team;
  awayTeam: Team;
  /**
   * Callback when event is updated
   * @param eventId - The event ID being updated
   * @param updates - The updated fields (playerNumber, incomplete)
   */
  onUpdate: (eventId: string, updates: Partial<Pick<MatchEvent, 'playerNumber' | 'incomplete'>>) => void;
  /**
   * Callback when event is deleted
   * @param eventId - The event ID to delete
   */
  onDelete: (eventId: string) => void;
}

export function EventEditDialog({
  isOpen,
  onClose,
  event,
  homeTeam,
  awayTeam,
  onUpdate,
  onDelete,
}: EventEditDialogProps) {
  const [playerNumber, setPlayerNumber] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset state when dialog opens or event changes
  useEffect(() => {
    if (isOpen && event) {
      setPlayerNumber(event.playerNumber?.toString() ?? '');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, event]);

  const getTeamName = useCallback((teamId?: string) => {
    if (teamId === homeTeam.id) {return homeTeam.name;}
    if (teamId === awayTeam.id) {return awayTeam.name;}
    return 'Team';
  }, [homeTeam, awayTeam]);

  const getEventIcon = (type?: string): string => {
    switch (type) {
      case 'GOAL': return '⚽';
      case 'YELLOW_CARD': return '🟨';
      case 'RED_CARD': return '🟥';
      case 'TIME_PENALTY': return '⏱️';
      case 'SUBSTITUTION': return '🔄';
      case 'FOUL': return '⚠️';
      default: return '📝';
    }
  };

  const getEventTypeLabel = (type?: string): string => {
    switch (type) {
      case 'GOAL': return 'Tor';
      case 'YELLOW_CARD': return 'Gelbe Karte';
      case 'RED_CARD': return 'Rote Karte';
      case 'TIME_PENALTY': return 'Zeitstrafe';
      case 'SUBSTITUTION': return 'Auswechslung';
      case 'FOUL': return 'Foul';
      default: return 'Ereignis';
    }
  };

  const formatTime = (seconds?: number) => {
    if (seconds === undefined) {return '--:--';}
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = useCallback(() => {
    if (!event) {return;}

    const num = playerNumber.trim() ? parseInt(playerNumber, 10) : undefined;
    onUpdate(event.id, {
      playerNumber: num,
      incomplete: !playerNumber.trim(), // Only mark complete if player number is provided
    });
    onClose();
  }, [event, playerNumber, onUpdate, onClose]);

  const handleDelete = useCallback(() => {
    if (!event) {return;}
    onDelete(event.id);
    onClose();
  }, [event, onDelete, onClose]);

  if (!isOpen || !event) {
    return null;
  }

  return (
    <div style={styles.overlay} className={moduleStyles.dialogOverlay} onClick={onClose}>
      <div
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-edit-dialog-title"
      >
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.eventIcon}>{getEventIcon(event.type)}</span>
          <div>
            <h2 id="event-edit-dialog-title" style={styles.title}>
              {getEventTypeLabel(event.type)} bearbeiten
            </h2>
            <p style={styles.subtitle}>
              {getTeamName(event.teamId)} · {formatTime(event.matchMinute * 60)}
            </p>
          </div>
        </div>

        {/* Incomplete Warning */}
        {event.incomplete && (
          <div style={styles.warningBanner}>
            <span style={styles.warningIcon}>⚠️</span>
            <span>Spielernummer fehlt noch</span>
          </div>
        )}

        {/* Player Number Input */}
        <div style={styles.inputSection}>
          <label style={styles.inputLabel}>Rückennummer</label>
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
                      ? colors.primaryLight
                      : colors.surface,
                  borderColor:
                    playerNumber === String(num) ? colors.primary : 'transparent',
                }}
                onClick={() => setPlayerNumber(String(num))}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        {showDeleteConfirm ? (
          <div style={styles.deleteConfirmSection}>
            <p style={styles.deleteConfirmText}>Ereignis wirklich löschen?</p>
            <div style={styles.actions}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Abbrechen
              </button>
              <button
                style={styles.deleteConfirmButton}
                onClick={handleDelete}
              >
                Ja, löschen
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.actions}>
            <button style={styles.deleteButton} onClick={() => setShowDeleteConfirm(true)}>
              Löschen
            </button>
            <button style={styles.saveButton} onClick={handleSave}>
              Speichern
            </button>
          </div>
        )}
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
  eventIcon: {
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
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningBannerBg,
    borderRadius: borderRadius.md,
    color: colors.warning,
    fontSize: fontSizes.sm,
    fontWeight: 500,
  },
  warningIcon: {
    fontSize: fontSizes.md,
  },
  inputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  inputLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: 500,
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
  deleteButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: colors.error,
    border: `1px solid ${colors.error}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
  saveButton: {
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
  deleteConfirmSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.dangerActionBg,
    borderRadius: borderRadius.lg,
  },
  deleteConfirmText: {
    fontSize: fontSizes.md,
    color: colors.error,
    margin: 0,
    textAlign: 'center',
    fontWeight: 500,
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
  deleteConfirmButton: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSizes.md,
    fontWeight: 600,
    backgroundColor: colors.error,
    color: colors.onError,
    border: 'none',
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
};

export default EventEditDialog;
