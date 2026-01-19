/**
 * RoleChangeDialog - Dialog zum Ändern einer Mitglieder-Rolle
 *
 * Zeigt verfügbare Rollen basierend auf Berechtigungen.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.5
 */

import React, { useState, CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { useFocusTrap } from '../../../hooks';
import { Button } from '../../../components/ui/Button';
import { RoleBadge } from './RoleBadge';
import type { TournamentMembership, TournamentRole, User } from '../types/auth.types';
import { ROLE_LABELS } from '../types/auth.types';
import { getAssignableRoles } from '../utils/permissions';

interface RoleChangeDialogProps {
  /** Die Membership die geändert wird */
  membership: TournamentMembership;
  /** User-Daten (für Anzeige) */
  user: User | null;
  /** Rolle des aktuellen Users (für Berechtigungs-Check) */
  myRole: TournamentRole;
  /** Teams für Trainer-Zuordnung */
  availableTeams?: Array<{ id: string; name: string }>;
  /** Loading-Zustand */
  isLoading?: boolean;
  /** Callback wenn Dialog geschlossen wird */
  onClose: () => void;
  /** Callback wenn Rolle geändert wird */
  onSave: (newRole: TournamentRole, teamIds?: string[]) => void;
}

export const RoleChangeDialog: React.FC<RoleChangeDialogProps> = ({
  membership,
  user,
  myRole,
  availableTeams = [],
  isLoading = false,
  onClose,
  onSave,
}) => {
  const [selectedRole, setSelectedRole] = useState<TournamentRole>(membership.role);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(membership.teamIds);

  // WCAG 4.1.3: Focus trap for accessibility
  const focusTrap = useFocusTrap({
    isActive: true, // Always active when rendered
    onEscape: onClose,
  });

  const assignableRoles = getAssignableRoles(myRole);

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleSave = () => {
    onSave(
      selectedRole,
      selectedRole === 'trainer' ? selectedTeamIds : undefined
    );
  };

  const hasChanges =
    selectedRole !== membership.role ||
    (selectedRole === 'trainer' &&
      JSON.stringify(selectedTeamIds.sort()) !==
        JSON.stringify(membership.teamIds.sort()));

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={focusTrap.containerRef}
        style={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-change-dialog-title"
      >
        <div style={styles.header}>
          <h2 id="role-change-dialog-title" style={styles.title}>Rolle ändern</h2>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.content}>
          {/* User Info */}
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div style={styles.userDetails}>
              <p style={styles.userName}>{user?.name ?? 'Unbekannt'}</p>
              <p style={styles.userEmail}>{user?.email ?? 'Keine E-Mail'}</p>
            </div>
          </div>

          {/* Current Role */}
          <div style={styles.currentRole}>
            <span style={styles.label}>Aktuelle Rolle:</span>
            <RoleBadge role={membership.role} />
          </div>

          {/* Role Selection */}
          <div style={styles.field}>
            <label style={styles.label}>Neue Rolle</label>
            <div style={styles.roleOptions}>
              {assignableRoles.map((role) => {
                const roleInfo = ROLE_LABELS[role];
                const isSelected = role === selectedRole;

                return (
                  <button
                    key={role}
                    style={{
                      ...styles.roleOption,
                      ...(isSelected ? styles.roleOptionSelected : {}),
                    }}
                    onClick={() => setSelectedRole(role)}
                  >
                    <span style={styles.roleLabel}>{roleInfo.label}</span>
                    <span style={styles.roleDescription}>{roleInfo.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team Assignment for Trainers */}
          {selectedRole === 'trainer' && availableTeams.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>Teams zuordnen</label>
              <div style={styles.teamList}>
                {availableTeams.map((team) => (
                  <label key={team.id} style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={() => handleTeamToggle(team.id)}
                      style={styles.checkbox}
                    />
                    {team.name}
                  </label>
                ))}
              </div>
              {selectedTeamIds.length === 0 && (
                <p style={styles.hint}>
                  Trainer sollten mindestens einem Team zugeordnet werden.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
            disabled={!hasChanges}
          >
            Speichern
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
    background: cssVars.colors.overlay,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: cssVars.spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: '480px',
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    overflow: 'hidden',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: cssVars.spacing.lg,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    background: 'none',
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xxl,
    color: cssVars.colors.textSecondary,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  content: {
    padding: cssVars.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
    overflowY: 'auto',
    flex: 1,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
  },
  avatar: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.onPrimary,
    background: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.full,
    flexShrink: 0,
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    margin: 0,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  userEmail: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  currentRole: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  },
  label: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  },
  roleOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  },
  roleOption: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    border: `2px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    textAlign: 'left',
  },
  roleOptionSelected: {
    background: `${cssVars.colors.primary}10`,
    borderColor: cssVars.colors.primary,
  },
  roleLabel: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  roleDescription: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginTop: '2px',
  },
  teamList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
    maxHeight: '150px',
    overflowY: 'auto',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  hint: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.warning,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.lg,
    borderTop: `1px solid ${cssVars.colors.border}`,
    flexShrink: 0,
  },
};

export default RoleChangeDialog;
