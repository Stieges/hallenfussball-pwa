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
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens'
import { useFocusTrap } from '../../../../hooks';
import { cardKindOf } from '../../../../utils/cardKind';
import type { EditableMatchEvent } from '../../../../types/tournament';
import type { EventFieldChanges } from '../../../../hooks/engineEventEditingSupport';
import { EventNumberField } from './EventNumberField';
import moduleStyles from '../../LiveCockpit.module.css';
import sportGlossary from '../../../../i18n/glossary.json';

interface Team {
  id: string;
  name: string;
}

interface EventEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: EditableMatchEvent | null;
  homeTeam: Team;
  awayTeam: Team;
  /**
   * Callback when event is updated
   * @param eventId - The event ID being updated
   * @param changes - Nur die GEAENDERTE Angabe (C3b-1, G10): neue Nummer ODER Nummer leeren; nie `incomplete`
   */
  onUpdate: (eventId: string, changes: EventFieldChanges) => void;
  /**
   * Callback when event is deleted
   * @param eventId - The event ID to delete
   */
  onDelete: (eventId: string) => void;
  /** C3b-1 (G3): Gesetzt = Löschen gesperrt; der Text nennt den Grund. */
  deleteBlocked?: string;
  /** C3b-1 (G5): Gesetzt = Nummer gesperrt (Helfer nach Abpfiff); der Text nennt den Grund. */
  amendLocked?: string;
}

export function EventEditDialog({
  isOpen,
  onClose,
  event,
  homeTeam,
  awayTeam,
  onUpdate,
  onDelete,
  deleteBlocked,
  amendLocked,
}: EventEditDialogProps) {
  const { t } = useTranslation('cockpit');
  const [playerNumber, setPlayerNumber] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // WCAG 4.1.3: Focus trap for accessibility
  const focusTrap = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
  });

  // Reset state when dialog opens or event changes
  useEffect(() => {
    if (isOpen && event) {
      // Support both direct and payload property formats
      const existingNumber = event.playerNumber ?? event.payload?.playerNumber;
      setPlayerNumber(existingNumber?.toString() ?? '');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, event]);

  // Helper to get teamId from either format
  const getEventTeamId = (e: EditableMatchEvent): string | undefined => {
    return e.teamId ?? e.payload?.teamId;
  };

  // Helper to get time in seconds from either format
  const getEventTimeSeconds = (e: EditableMatchEvent): number | undefined => {
    if (e.timestampSeconds !== undefined) {return e.timestampSeconds;}
    if (e.matchMinute !== undefined) {return e.matchMinute * 60;}
    return undefined;
  };

  const getTeamName = useCallback((teamId?: string) => {
    if (teamId === homeTeam.id) {return homeTeam.name;}
    if (teamId === awayTeam.id) {return awayTeam.name;}
    return 'Team';
  }, [homeTeam, awayTeam]);

  // F3b2 (Ruling PC30, Fixrunde Aufgabe 9): Gelb-Rot (RED_CARD + payload.cardType) NUR ueber cardKindOf.
  const getEventIcon = (e: EditableMatchEvent): string => {
    switch (e.type) {
      case 'GOAL': return '⚽';
      case 'YELLOW_CARD': return '🟨';
      case 'RED_CARD': return cardKindOf(e) === 'YELLOW_RED' ? '🟨🟥' : '🟥';
      case 'TIME_PENALTY': return '⏱️';
      case 'SUBSTITUTION': return '🔄';
      case 'FOUL': return '⚠️';
      default: return '📝';
    }
  };

  const getEventTypeLabel = (e: EditableMatchEvent): string => {
    switch (e.type) {
      case 'GOAL': return 'Tor';
      case 'YELLOW_CARD': return t('cardDialog.yellowCard');
      case 'RED_CARD':
        return cardKindOf(e) === 'YELLOW_RED' ? t('cardDialog.yellowRedCard') : t('cardDialog.redCard');
      case 'TIME_PENALTY': return sportGlossary.terms.timePenalty.de;
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

    // G10: nur senden, was sich geaendert hat; keine Aenderung -> nichts senden.
    const original = event.playerNumber ?? event.payload?.playerNumber;
    const next = playerNumber.trim() ? parseInt(playerNumber, 10) : undefined;
    if (next !== original && !(next !== undefined && Number.isNaN(next))) {
      onUpdate(event.id, next === undefined ? { clearPlayerNumber: true } : { playerNumber: next });
    }
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
        ref={focusTrap.containerRef}
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-edit-dialog-title"
      >
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.eventIcon}>{getEventIcon(event)}</span>
          <div>
            <h2 id="event-edit-dialog-title" style={styles.title}>
              {t('eventEditDialog.title', { label: getEventTypeLabel(event) })}
            </h2>
            <p style={styles.subtitle}>
              {getTeamName(getEventTeamId(event))} · {formatTime(getEventTimeSeconds(event))}
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

        {/* Player Number Input (G5: gesperrt mit Grund, wenn amendLocked) */}
        <EventNumberField value={playerNumber} onChange={setPlayerNumber} lockedReason={amendLocked} />

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
            <button
              style={{ ...styles.deleteButton, ...(deleteBlocked ? styles.blocked : {}) }}
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteBlocked !== undefined}
              data-testid="event-edit-delete"
            >
              Löschen
            </button>
            <button
              style={{ ...styles.saveButton, ...(amendLocked ? styles.blocked : {}) }}
              onClick={handleSave}
              disabled={amendLocked !== undefined}
              data-testid="event-edit-save"
            >
              Speichern
            </button>
          </div>
        )}
        {deleteBlocked && !showDeleteConfirm && (
          <p style={styles.blockedHint} data-testid="event-edit-delete-hint" role="status">{deleteBlocked}</p>
        )}
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
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
  },
  eventIcon: {
    fontSize: '32px',
  },
  title: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 600,
    color: cssVars.colors.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    margin: 0,
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.warningBannerBg,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 500,
  },
  warningIcon: {
    fontSize: cssVars.fontSizes.md,
  },
  actions: {
    display: 'flex',
    gap: cssVars.spacing.md,
    marginTop: cssVars.spacing.sm,
  },
  deleteButton: {
    flex: 1,
    padding: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: cssVars.colors.error,
    border: `1px solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
  saveButton: {
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
  deleteConfirmSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.dangerActionBg,
    borderRadius: cssVars.borderRadius.lg,
  },
  deleteConfirmText: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.error,
    margin: 0,
    textAlign: 'center',
    fontWeight: 500,
  },
  blocked: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  blockedHint: {
    margin: 0,
    textAlign: 'center',
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
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
  deleteConfirmButton: {
    flex: 1,
    padding: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: 600,
    backgroundColor: cssVars.colors.error,
    color: cssVars.colors.onError,
    border: 'none',
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    minHeight: 48,
  },
};

export default EventEditDialog;
