/**
 * DangerZoneCategory - Critical Actions
 *
 * Destructive operations requiring confirmation.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.11
 */

import { CSSProperties, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage } from '../shared';
import { DANGER_ACTIONS } from '../../constants/admin.constants';
import { Dialog } from '../../../../components/dialogs/Dialog';
import type { Tournament } from '../../../../types/tournament';
import type { DangerAction, DangerActionConfig } from '../../types/admin.types';

// =============================================================================
// PROPS
// =============================================================================

interface DangerZoneCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.lg,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.warning,
  } as CSSProperties,

  actionCard: {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  actionCardDanger: {
    borderColor: cssVars.colors.errorBorder,
    background: cssVars.colors.dangerSubtle,
  } as CSSProperties,

  actionCardWarning: {
    borderColor: cssVars.colors.warningBorder,
    background: cssVars.colors.warningSubtle,
  } as CSSProperties,

  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  actionIcon: {
    fontSize: 24,
  } as CSSProperties,

  actionTitle: {
    fontSize: cssVars.fontSizes.titleSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  actionTitleDanger: {
    color: cssVars.colors.error,
  } as CSSProperties,

  actionTitleWarning: {
    color: cssVars.colors.warning,
  } as CSSProperties,

  actionDescription: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  consequencesList: {
    listStyle: 'none',
    padding: 0,
    margin: `0 0 ${cssVars.spacing.md} 0`,
  } as CSSProperties,

  consequenceItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  consequenceIcon: {
    color: cssVars.colors.error,
    flexShrink: 0,
  } as CSSProperties,

  button: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  buttonDanger: {
    background: cssVars.colors.error,
    color: cssVars.colors.onError,
  } as CSSProperties,

  buttonWarning: {
    background: cssVars.colors.warning,
    color: cssVars.colors.onWarning,
  } as CSSProperties,

  // Dialog styles
  dialogDescription: {
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
    lineHeight: 1.5,
  } as CSSProperties,

  dialogConsequences: {
    background: cssVars.colors.dangerSubtle,
    border: `1px solid ${cssVars.colors.errorBorder}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.lg,
  } as CSSProperties,

  dialogConsequencesList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  } as CSSProperties,

  dialogConsequenceItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.error,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  confirmLabel: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  confirmInput: {
    width: '100%',
    padding: cssVars.spacing.sm,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.surface,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    marginBottom: cssVars.spacing.lg,
    boxSizing: 'border-box',
  } as CSSProperties,

  dialogActions: {
    display: 'flex',
    gap: cssVars.spacing.sm,
    justifyContent: 'flex-end',
  } as CSSProperties,

  cancelButton: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    background: 'transparent',
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
  } as CSSProperties,

  confirmButton: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
  } as CSSProperties,

  confirmButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function DangerZoneCategory({
  tournament,
  onTournamentUpdate,
}: DangerZoneCategoryProps) {
  const { t } = useTranslation('admin');
  const [pendingAction, setPendingAction] = useState<DangerActionConfig | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const handleOpenDialog = useCallback((action: DangerAction) => {
    const config = DANGER_ACTIONS[action];
    setPendingAction(config);
    setConfirmationInput('');
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (!isExecuting) {
      setPendingAction(null);
      setConfirmationInput('');
    }
  }, [isExecuting]);

  const handleConfirm = useCallback(async () => {
    if (confirmationInput !== pendingAction?.confirmText) {
      return;
    }

    setIsExecuting(true);

    try {
      const now = new Date().toISOString();

      switch (pendingAction.action) {
        case 'regenerate_schedule': {
          // Keep finished matches, reset scheduled/running matches to allow re-generation
          // Note: Full regeneration requires using the schedule editor
          const resetMatches = tournament.matches.map(match => {
            if (match.matchStatus === 'finished') {
              return match; // Keep finished matches
            }
            return {
              ...match,
              matchStatus: 'scheduled' as const,
              scoreA: undefined,
              scoreB: undefined,
              timerStartTime: undefined,
              timerPausedAt: undefined,
              timerElapsedSeconds: undefined,
              finishedAt: undefined,
            };
          });

          onTournamentUpdate({
            ...tournament,
            matches: resetMatches,
            updatedAt: now,
          });
          break;
        }

        case 'reset_schedule': {
          // Reset ALL matches to initial scheduled state
          const resetMatches = tournament.matches.map(match => ({
            ...match,
            matchStatus: 'scheduled' as const,
            scoreA: undefined,
            scoreB: undefined,
            timerStartTime: undefined,
            timerPausedAt: undefined,
            timerElapsedSeconds: undefined,
            finishedAt: undefined,
            correctionHistory: undefined,
          }));

          onTournamentUpdate({
            ...tournament,
            matches: resetMatches,
            updatedAt: now,
          });
          break;
        }

        case 'end_tournament':
          onTournamentUpdate({
            ...tournament,
            dashboardStatus: 'finished',
            updatedAt: now,
          });
          break;

        case 'archive_tournament':
          // Archive by setting dashboardStatus to finished
          // TODO: Add dedicated archivedAt field when backend supports it
          onTournamentUpdate({
            ...tournament,
            dashboardStatus: 'finished',
            updatedAt: now,
          });
          break;

        case 'delete_tournament':
          onTournamentUpdate({
            ...tournament,
            deletedAt: now,
            updatedAt: now,
          });
          break;
      }

      setPendingAction(null);
      setConfirmationInput('');
    } catch (error) {
      console.error('Error executing action:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [pendingAction, confirmationInput, tournament, onTournamentUpdate]);

  const isConfirmEnabled = confirmationInput === pendingAction?.confirmText;

  const renderActionCard = (action: DangerAction) => {
    const config = DANGER_ACTIONS[action];
    const isDanger = config.severity === 'danger';

    return (
      <div
        key={action}
        style={{
          ...styles.actionCard,
          ...(isDanger ? styles.actionCardDanger : styles.actionCardWarning),
        }}
      >
        <div style={styles.actionHeader}>
          <span style={styles.actionIcon}>
            {action === 'regenerate_schedule' && '🔄'}
            {action === 'reset_schedule' && '🗑️'}
            {action === 'end_tournament' && '🛑'}
            {action === 'archive_tournament' && '📦'}
            {action === 'delete_tournament' && '🗑️'}
          </span>
          <h3
            style={{
              ...styles.actionTitle,
              ...(isDanger ? styles.actionTitleDanger : styles.actionTitleWarning),
            }}
          >
            {config.title}
          </h3>
        </div>

        <p style={styles.actionDescription}>{config.description}</p>

        <ul style={styles.consequencesList}>
          {config.consequences.map((consequence, i) => (
            <li key={i} style={styles.consequenceItem}>
              <span style={styles.consequenceIcon}>•</span>
              <span>{consequence}</span>
            </li>
          ))}
        </ul>

        <button
          style={{
            ...styles.button,
            ...(isDanger ? styles.buttonDanger : styles.buttonWarning),
          }}
          onClick={() => handleOpenDialog(action)}
        >
          {config.buttonLabel}
        </button>
      </div>
    );
  };

  return (
    <CategoryPage
      icon="⚠️"
      title={t('dangerZone.title')}
      description={t('dangerZone.description')}
    >
      {/* Warning */}
      <div style={styles.warning}>
        <span>⚠️</span>
        <div>
          <strong>{t('dangerZone.warningTitle')}</strong> {t('dangerZone.warningText')}
        </div>
      </div>

      {/* Regenerate Schedule (Warning) */}
      {renderActionCard('regenerate_schedule')}

      {/* Reset Schedule (Danger) */}
      {renderActionCard('reset_schedule')}

      {/* End Tournament (Warning) */}
      {renderActionCard('end_tournament')}

      {/* Archive Tournament (Warning) */}
      {renderActionCard('archive_tournament')}

      {/* Delete Tournament (Danger) */}
      {renderActionCard('delete_tournament')}

      {/* Confirmation Dialog */}
      <Dialog
        isOpen={pendingAction !== null}
        onClose={handleCloseDialog}
        title={pendingAction?.title ?? t('dangerZone.confirmation')}
        maxWidth="480px"
        closeOnBackdropClick={!isExecuting}
      >
        {pendingAction && (
          <>
            <p style={styles.dialogDescription}>{pendingAction.description}</p>

            <div style={styles.dialogConsequences}>
              <ul style={styles.dialogConsequencesList}>
                {pendingAction.consequences.map((consequence, i) => (
                  <li key={i} style={styles.dialogConsequenceItem}>
                    <span>•</span>
                    <span>{consequence}</span>
                  </li>
                ))}
              </ul>
            </div>

            <label style={styles.confirmLabel}>
              {t('dangerZone.typeToConfirm', { text: pendingAction.confirmText })}
            </label>
            <input
              type="text"
              style={styles.confirmInput}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={pendingAction.confirmText}
              disabled={isExecuting}
              autoFocus
            />

            <div style={styles.dialogActions}>
              <button
                style={styles.cancelButton}
                onClick={handleCloseDialog}
                disabled={isExecuting}
              >
                {t('dangerZone.cancel')}
              </button>
              <button
                style={{
                  ...styles.confirmButton,
                  ...(pendingAction.severity === 'danger'
                    ? styles.buttonDanger
                    : styles.buttonWarning),
                  ...(!isConfirmEnabled ? styles.confirmButtonDisabled : {}),
                }}
                onClick={() => void handleConfirm()}
                disabled={!isConfirmEnabled || isExecuting}
              >
                {isExecuting ? t('dangerZone.executing') : pendingAction.buttonLabel}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </CategoryPage>
  );
}

export default DangerZoneCategory;
