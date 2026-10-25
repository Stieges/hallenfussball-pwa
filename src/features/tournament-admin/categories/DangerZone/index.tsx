/**
 * DangerZoneCategory - Critical Actions
 *
 * Destructive operations requiring confirmation.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.11
 */

import { CSSProperties, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage } from '../shared';
import { DANGER_ACTIONS } from '../../constants/admin.constants';
import { Dialog } from '../../../../components/dialogs/Dialog';
import { useTournamentStartState } from '../../../../hooks/useTournamentStartState';
import { useCan } from '../../../auth/hooks/useCan';
import type { Tournament } from '../../../../types/tournament';
import { useResultsReset } from '../../hooks/useResultsReset';
import type { DangerAction, DangerActionConfig } from '../../types/admin.types';

// =============================================================================
// PROPS
// =============================================================================

interface DangerZoneCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void | Promise<void>;
  /** A-10: Zurücksetzen erst am Server (Konto), dann lokal; mit Einträgen gesperrt (@FU-090). */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
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
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.lg,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.warning,
  } as CSSProperties,

  actionCard: {
    background: cssVars.colors.surface,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
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
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.errorBorder}`,
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
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
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
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
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
  tournamentId,
  tournament,
  onTournamentUpdate,
  onLocalTournamentUpdate,
}: DangerZoneCategoryProps) {
  const { t } = useTranslation('admin');
  const [pendingAction, setPendingAction] = useState<DangerActionConfig | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const resultsReset = useResultsReset(); // A-10 (@FU-090, L1, L8)

  // R7: Löschen nur der Eigentümer (DB: protect_deleted_at -> deleteTournament), für alle anderen ausgeblendet.
  // Abschließen/Archivieren gibt es hier nicht mehr (R3-1, C-FINISH-PROMISE): der neue Weg kommt mit R3-4 (@LZ-022).
  const canDelete = useCan('deleteTournament', tournamentId);

  // @LZ-003: „Turnier löschen" nur vor dem ersten Anpfiff — und nur, wenn der
  // Anpfiff-Zustand überhaupt feststellbar ist (fail-closed, siehe
  // useTournamentStartState/getMatchStartState).
  const { state: matchStartState } = useTournamentStartState(tournament);
  const canOfferDelete = canDelete && matchStartState === 'not-started';

  // @OB-014: Fokus der Rückfrage liegt zuerst auf „Abbrechen".
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpenDialog = useCallback(async (action: DangerAction) => {
    // A-08f3e4 (@FU-090): mit Einträgen gar nicht erst das Bestätigungswort anbieten -- Hinweis sofort
    if (action === 'reset_schedule' && await resultsReset.blocks(tournament)) { return; }
    setPendingAction(DANGER_ACTIONS[action]);
    setConfirmationInput('');
  }, [resultsReset, tournament]);

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
        case 'reset_schedule': {
          // A-10: Konto-Turnier erst am Server (reset_match_results), dann lokal; mit Einträgen nicht ausführen (@FU-090)
          const resetMatches = await resultsReset.reset(tournament);
          if (resetMatches) { onLocalTournamentUpdate({ ...tournament, matches: resetMatches, updatedAt: now }); }
          break;
        }

        case 'delete_tournament':
          await onTournamentUpdate({
            ...tournament,
            deletedAt: now,
            updatedAt: now,
          });
          break;
      }

      setPendingAction(null);
      setConfirmationInput('');
    } finally {
      setIsExecuting(false);
    }
  }, [pendingAction, confirmationInput, tournament, onTournamentUpdate, onLocalTournamentUpdate, resultsReset]);

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
            {action === 'reset_schedule' && '🗑️'}
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
          data-testid={action === 'delete_tournament' ? 'danger-zone-delete' : undefined}
          style={{
            ...styles.button,
            ...(isDanger ? styles.buttonDanger : styles.buttonWarning),
          }}
          onClick={() => { void handleOpenDialog(action); }}
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

      {/* Reset Schedule (Danger) */}
      {renderActionCard('reset_schedule')}

      {/* Delete Tournament (Danger) — R7: nur für den Eigentümer, @LZ-003: nur vor dem ersten Anpfiff */}
      {canOfferDelete && renderActionCard('delete_tournament')}

      {/* Confirmation Dialog */}
      <Dialog
        isOpen={pendingAction !== null}
        onClose={handleCloseDialog}
        title={pendingAction?.title ?? t('dangerZone.confirmation')}
        maxWidth="480px"
        closeOnBackdropClick={!isExecuting}
        initialFocusRef={cancelButtonRef}
        suppressEnter
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
            />

            <div style={styles.dialogActions}>
              <button
                ref={cancelButtonRef}
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
