/**
 * TransferOwnershipDialog - Dialog zur Ownership-Übertragung
 *
 * Ermöglicht Owner, Ownership an Co-Admin zu übertragen.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.5
 */

import React, { useState, CSSProperties } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { RoleBadge } from './RoleBadge';
import type { TournamentMembership, User } from '../types/auth.types';

interface CoAdminCandidate {
  membership: TournamentMembership;
  user: User | null;
}

interface TransferOwnershipDialogProps {
  /** Turnier-Name (für Anzeige) */
  tournamentName: string;
  /** Liste der Co-Admins */
  coAdmins: CoAdminCandidate[];
  /** Loading-Zustand */
  isLoading?: boolean;
  /** Callback wenn Dialog geschlossen wird */
  onClose: () => void;
  /** Callback wenn Ownership übertragen wird */
  onTransfer: (newOwnerId: string) => void;
}

export const TransferOwnershipDialog: React.FC<TransferOwnershipDialogProps> = ({
  tournamentName,
  coAdmins,
  isLoading = false,
  onClose,
  onTransfer,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmationStep, setConfirmationStep] = useState(false);

  const selectedCoAdmin = coAdmins.find((c) => c.membership.userId === selectedUserId);

  const handleTransfer = () => {
    if (selectedUserId) {
      onTransfer(selectedUserId);
    }
  };

  // No co-admins available
  if (coAdmins.length === 0) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
          <div style={styles.header}>
            <h2 style={styles.title}>Ownership übertragen</h2>
            <button style={styles.closeButton} onClick={onClose}>
              &times;
            </button>
          </div>

          <div style={styles.content}>
            <div style={styles.warningBox}>
              <p style={styles.warningText}>
                Keine Co-Admins vorhanden. Du kannst Ownership nur an Co-Admins
                übertragen.
              </p>
              <p style={styles.hintText}>
                Ernenne zuerst ein Mitglied zum Co-Admin, bevor du Ownership
                überträgst.
              </p>
            </div>
          </div>

          <div style={styles.footer}>
            <Button variant="primary" onClick={onClose}>
              Verstanden
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation step
  if (confirmationStep && selectedCoAdmin) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
          <div style={styles.header}>
            <h2 style={styles.title}>Ownership bestätigen</h2>
            <button style={styles.closeButton} onClick={onClose}>
              &times;
            </button>
          </div>

          <div style={styles.content}>
            <div style={styles.confirmationBox}>
              <p style={styles.confirmationText}>
                Bist du sicher, dass du die Ownership von
              </p>
              <p style={styles.tournamentNameHighlight}>&quot;{tournamentName}&quot;</p>
              <p style={styles.confirmationText}>übertragen möchtest an:</p>
              <div style={styles.selectedUserBox}>
                <div style={styles.avatar}>
                  {selectedCoAdmin.user?.name
                    ? selectedCoAdmin.user.name.charAt(0).toUpperCase()
                    : '?'}
                </div>
                <div style={styles.userDetails}>
                  <p style={styles.userName}>
                    {selectedCoAdmin.user?.name ?? 'Unbekannt'}
                  </p>
                  <p style={styles.userEmail}>
                    {selectedCoAdmin.user?.email ?? 'Keine E-Mail'}
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.warningBox}>
              <p style={styles.warningTitle}>Achtung!</p>
              <p style={styles.warningText}>
                Nach der Übertragung wirst du zum Co-Admin herabgestuft. Nur der
                neue Owner kann dies rückgängig machen.
              </p>
            </div>
          </div>

          <div style={styles.footer}>
            <Button
              variant="ghost"
              onClick={() => setConfirmationStep(false)}
              disabled={isLoading}
            >
              Zurück
            </Button>
            <Button
              variant="danger"
              onClick={handleTransfer}
              loading={isLoading}
            >
              Ownership übertragen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Selection step
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Ownership übertragen</h2>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.content}>
          <p style={styles.description}>
            Wähle einen Co-Admin aus, der die Ownership von &quot;{tournamentName}&quot;
            übernehmen soll.
          </p>

          <div style={styles.coAdminList}>
            {coAdmins.map(({ membership, user }) => {
              const isSelected = membership.userId === selectedUserId;

              return (
                <button
                  key={membership.id}
                  style={{
                    ...styles.coAdminOption,
                    ...(isSelected ? styles.coAdminOptionSelected : {}),
                  }}
                  onClick={() => setSelectedUserId(membership.userId)}
                >
                  <div style={styles.avatar}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div style={styles.userDetails}>
                    <p style={styles.userName}>{user?.name ?? 'Unbekannt'}</p>
                    <p style={styles.userEmail}>
                      {user?.email ?? 'Keine E-Mail'}
                    </p>
                  </div>
                  <RoleBadge role="co-admin" size="sm" />
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={() => setConfirmationStep(true)}
            disabled={!selectedUserId}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: '480px',
    background: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: fontSizes.xxl,
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  content: {
    padding: spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
    overflowY: 'auto',
    flex: 1,
  },
  description: {
    margin: 0,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  coAdminList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  coAdminOption: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    background: colors.surfaceLight,
    border: `2px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  coAdminOptionSelected: {
    background: `${colors.primary}10`,
    borderColor: colors.primary,
  },
  avatar: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.onPrimary,
    background: colors.primary,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    margin: 0,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
  },
  userEmail: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  confirmationBox: {
    textAlign: 'center',
    padding: spacing.md,
  },
  confirmationText: {
    margin: 0,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  tournamentNameHighlight: {
    margin: `${spacing.sm} 0`,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  selectedUserBox: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    background: colors.surfaceLight,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  warningBox: {
    padding: spacing.md,
    background: `${colors.warning}15`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.warning}`,
  },
  warningTitle: {
    margin: 0,
    marginBottom: spacing.xs,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.warning,
  },
  warningText: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.warning,
  },
  hintText: {
    margin: 0,
    marginTop: spacing.sm,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTop: `1px solid ${colors.border}`,
    flexShrink: 0,
  },
};

export default TransferOwnershipDialog;
