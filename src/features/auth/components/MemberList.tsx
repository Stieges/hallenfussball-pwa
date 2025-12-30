/**
 * MemberList - Liste aller Turnier-Mitglieder
 *
 * Zeigt Mitglieder mit Rollen und Verwaltungsoptionen.
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
import { useTournamentMembers } from '../hooks/useTournamentMembers';
import type { TournamentRole } from '../types/auth.types';
import { ROLE_LABELS } from '../types/auth.types';

interface MemberListProps {
  /** Turnier-ID */
  tournamentId: string;
  /** Callback zum Öffnen des Einladungs-Dialogs */
  onInvite?: () => void;
  /** Teams für Trainer-Zuordnung */
  availableTeams?: Array<{ id: string; name: string }>;
}

// Rollen die vergeben werden können (ohne Owner)
const ASSIGNABLE_ROLES: TournamentRole[] = ['co-admin', 'trainer', 'collaborator', 'viewer'];

export const MemberList: React.FC<MemberListProps> = ({
  tournamentId,
  onInvite,
  availableTeams = [],
}) => {
  const {
    members,
    myMembership,
    isLoading,
    error,
    setRole,
    remove,
    canEditMember,
    canSetRole,
    canTransfer,
    clearError,
  } = useTournamentMembers(tournamentId);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleRoleChange = (membershipId: string, newRole: TournamentRole) => {
    clearError();
    if (setRole(membershipId, newRole)) {
      setEditingMemberId(null);
    }
  };

  const handleRemove = (membershipId: string) => {
    clearError();
    if (remove(membershipId)) {
      setConfirmRemoveId(null);
    }
  };

  const canManageMembers = myMembership?.role === 'owner' || myMembership?.role === 'co-admin';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Mitglieder ({members.length})</h3>
        {canManageMembers && onInvite && (
          <Button variant="primary" size="sm" onClick={onInvite}>
            + Einladen
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={styles.error}>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.dismissButton} onClick={clearError}>
            &times;
          </button>
        </div>
      )}

      {/* Member List */}
      <div style={styles.list}>
        {members.map(({ membership, user }) => {
          const isEditing = editingMemberId === membership.id;
          const isConfirmingRemove = confirmRemoveId === membership.id;
          const canEdit = canEditMember(membership);
          const isMe = membership.id === myMembership?.id;

          return (
            <div key={membership.id} style={styles.memberCard}>
              {/* Member Info */}
              <div style={styles.memberInfo}>
                <div style={styles.avatar}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div style={styles.memberDetails}>
                  <p style={styles.memberName}>
                    {user?.name ?? 'Unbekannt'}
                    {isMe && <span style={styles.meBadge}>(Du)</span>}
                  </p>
                  <p style={styles.memberEmail}>{user?.email ?? 'Keine E-Mail'}</p>
                </div>
                <RoleBadge role={membership.role} size="sm" />
              </div>

              {/* Team Assignments (for Trainers) */}
              {membership.role === 'trainer' && membership.teamIds.length > 0 && (
                <div style={styles.teamAssignments}>
                  <span style={styles.teamLabel}>Teams:</span>
                  {membership.teamIds.map((teamId) => {
                    const team = availableTeams.find((t) => t.id === teamId);
                    return (
                      <span key={teamId} style={styles.teamBadge}>
                        {team?.name ?? teamId}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              {canEdit && !isMe && (
                <div style={styles.actions}>
                  {isEditing ? (
                    <div style={styles.roleSelector}>
                      {ASSIGNABLE_ROLES.map((role) => {
                        const canAssign = canSetRole(membership, role);
                        return (
                          <button
                            key={role}
                            style={{
                              ...styles.roleOption,
                              ...(membership.role === role ? styles.roleOptionActive : {}),
                              ...(canAssign ? {} : styles.roleOptionDisabled),
                            }}
                            onClick={() => canAssign && handleRoleChange(membership.id, role)}
                            disabled={!canAssign || isLoading}
                          >
                            {ROLE_LABELS[role].label}
                          </button>
                        );
                      })}
                      <button
                        style={styles.cancelButton}
                        onClick={() => setEditingMemberId(null)}
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : isConfirmingRemove ? (
                    <div style={styles.confirmRemove}>
                      <p style={styles.confirmText}>Wirklich entfernen?</p>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemove(membership.id)}
                        loading={isLoading}
                      >
                        Ja, entfernen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemoveId(null)}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingMemberId(membership.id)}
                      >
                        Rolle ändern
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemoveId(membership.id)}
                        style={styles.removeButton}
                      >
                        Entfernen
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {members.length === 0 && (
          <p style={styles.emptyText}>Noch keine Mitglieder</p>
        )}
      </div>

      {/* Ownership Transfer Hint */}
      {canTransfer() && (
        <p style={styles.transferHint}>
          Als Owner kannst du die Ownership an einen Co-Admin übertragen.
        </p>
      )}
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  container: {
    padding: spacing.md,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    margin: 0,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  error: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.md,
    background: `${colors.error}15`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.error}`,
  },
  errorText: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.error,
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: fontSizes.lg,
    color: colors.error,
    cursor: 'pointer',
    padding: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  memberCard: {
    padding: spacing.md,
    background: colors.surface,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border}`,
  },
  memberInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
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
  memberDetails: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    margin: 0,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meBadge: {
    marginLeft: spacing.xs,
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
    fontWeight: fontWeights.normal,
  },
  memberEmail: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  teamAssignments: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTop: `1px solid ${colors.border}`,
  },
  teamLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  teamBadge: {
    padding: `2px ${spacing.sm}`,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    background: colors.surfaceLight,
    borderRadius: borderRadius.sm,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTop: `1px solid ${colors.border}`,
  },
  roleSelector: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
    width: '100%',
  },
  roleOption: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    background: colors.surfaceLight,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.sm,
    cursor: 'pointer',
  },
  roleOptionActive: {
    color: colors.onPrimary,
    background: colors.primary,
    borderColor: colors.primary,
  },
  roleOptionDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  cancelButton: {
    padding: `${spacing.xs} ${spacing.sm}`,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  confirmRemove: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  confirmText: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.error,
    flex: 1,
  },
  removeButton: {
    color: colors.error,
  },
  emptyText: {
    margin: 0,
    padding: spacing.lg,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  transferHint: {
    margin: 0,
    marginTop: spacing.md,
    padding: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
    background: colors.surfaceLight,
    borderRadius: borderRadius.md,
    textAlign: 'center',
  },
};

export default MemberList;
