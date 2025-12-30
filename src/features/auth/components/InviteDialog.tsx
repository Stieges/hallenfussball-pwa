/**
 * InviteDialog - Dialog zum Erstellen von Einladungen
 *
 * Ermöglicht Owner/Co-Admins, Einladungs-Links zu generieren.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.3
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
import type { TournamentRole } from '../types/auth.types';
import { ROLE_LABELS } from '../types/auth.types';
import { useInvitation } from '../hooks/useInvitation';

interface InviteDialogProps {
  /** Turnier-ID */
  tournamentId: string;
  /** Teams für Trainer-Rolle */
  availableTeams?: Array<{ id: string; name: string }>;
  /** Callback wenn Dialog geschlossen wird */
  onClose: () => void;
  /** Callback wenn Einladung erstellt wurde */
  onInviteCreated?: (token: string, link: string) => void;
}

// Rollen die per Einladung vergeben werden können
const INVITABLE_ROLES: TournamentRole[] = ['co-admin', 'trainer', 'collaborator', 'viewer'];

export const InviteDialog: React.FC<InviteDialogProps> = ({
  tournamentId,
  availableTeams = [],
  onClose,
  onInviteCreated,
}) => {
  const { createNewInvitation, isLoading, error, clearError } = useInvitation();

  const [selectedRole, setSelectedRole] = useState<TournamentRole>('collaborator');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [expiresInDays, setExpiresInDays] = useState<number>(7);

  const handleCreate = () => {
    clearError();

    const result = createNewInvitation({
      tournamentId,
      role: selectedRole,
      teamIds: selectedRole === 'trainer' ? selectedTeamIds : undefined,
      maxUses: maxUses > 0 ? maxUses : undefined,
      expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
    });

    if (result.success && result.invitation) {
      onInviteCreated?.(result.invitation.token, result.inviteLink ?? '');
    }
  };

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Einladung erstellen</h2>
          <button style={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={styles.content}>
          {/* Rollen-Auswahl */}
          <div style={styles.field}>
            <label style={styles.label}>Rolle</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as TournamentRole)}
              style={styles.select}
            >
              {INVITABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role].label} - {ROLE_LABELS[role].description}
                </option>
              ))}
            </select>
          </div>

          {/* Team-Auswahl für Trainer */}
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
            </div>
          )}

          {/* Max Uses */}
          <div style={styles.field}>
            <label style={styles.label}>Maximale Nutzungen</label>
            <select
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              style={styles.select}
            >
              <option value={1}>Einmalig</option>
              <option value={5}>5 mal</option>
              <option value={10}>10 mal</option>
              <option value={0}>Unbegrenzt</option>
            </select>
          </div>

          {/* Gültigkeit */}
          <div style={styles.field}>
            <label style={styles.label}>Gültig für</label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              style={styles.select}
            >
              <option value={1}>1 Tag</option>
              <option value={7}>7 Tage</option>
              <option value={30}>30 Tage</option>
              <option value={0}>Unbegrenzt</option>
            </select>
          </div>

          {/* Error */}
          {error && <p style={styles.error}>{error}</p>}
        </div>

        <div style={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={isLoading}
            disabled={selectedRole === 'trainer' && selectedTeamIds.length === 0 && availableTeams.length > 0}
          >
            Link erstellen
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
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.border}`,
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
    gap: spacing.md,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  },
  select: {
    height: '48px',
    padding: `0 ${spacing.md}`,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    background: colors.surfaceSolid,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    outline: 'none',
  },
  teamList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    padding: spacing.md,
    background: colors.surfaceLight,
    borderRadius: borderRadius.md,
    maxHeight: '150px',
    overflowY: 'auto',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  error: {
    margin: 0,
    padding: spacing.sm,
    fontSize: fontSizes.sm,
    color: colors.error,
    background: `${colors.error}10`,
    borderRadius: borderRadius.md,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTop: `1px solid ${colors.border}`,
  },
};

export default InviteDialog;
