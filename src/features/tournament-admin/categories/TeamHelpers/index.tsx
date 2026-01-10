/**
 * TeamHelpersCategory - Team & Helper Management
 *
 * Invite helpers, manage roles, and oversee team activity.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.4
 * @see docs/concepts/MULTI-USER-KONZEPT.md
 */

import { useState, CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import { Button } from '../../../../components/ui/Button';
import { MemberList } from '../../../auth/components/MemberList';
import { InviteDialog } from '../../../auth/components/InviteDialog';
import { useTournamentMembers } from '../../../auth/hooks/useTournamentMembers';
import { useInvitation } from '../../../auth/hooks/useInvitation';
import { useAuth } from '../../../auth/hooks/useAuth';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface TeamHelpersCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TeamHelpersCategory({
  tournamentId,
  tournament,
}: TeamHelpersCategoryProps) {
  const { user, isAuthenticated } = useAuth();
  const { myMembership } = useTournamentMembers(tournamentId);
  const { getActiveInvitations } = useInvitation();

  // Dialog states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Permission check: Can manage members?
  const canManageMembers = myMembership?.role === 'owner' || myMembership?.role === 'co-admin';

  // Get active invitations
  const activeInvitations = getActiveInvitations(tournamentId);

  // Teams for trainer assignment
  const availableTeams = tournament.teams.map(team => ({
    id: team.id,
    name: team.name,
  }));

  // Handle invite creation
  const handleInviteCreated = (token: string, link: string) => {
    setShowInviteDialog(false);
    setCreatedInviteLink(link || `${window.location.origin}/invite/${token}`);
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    if (!createdInviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdInviteLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = createdInviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Not authenticated - show login prompt
  if (!isAuthenticated || !user) {
    return (
      <CategoryPage
        icon="👥"
        title="Team & Helfer"
        description="Helfer einladen und Berechtigungen verwalten"
      >
        <div style={styles.authPrompt}>
          <div style={styles.authIcon}>🔐</div>
          <h3 style={styles.authTitle}>Anmeldung erforderlich</h3>
          <p style={styles.authText}>
            Um Helfer einzuladen und zu verwalten, musst du angemeldet sein.
          </p>
          <span style={styles.badge}>Gehe zu Einstellungen → Konto</span>
        </div>
      </CategoryPage>
    );
  }

  return (
    <CategoryPage
      icon="👥"
      title="Team & Helfer"
      description="Helfer einladen und Berechtigungen verwalten"
    >
      {/* Invite Section - Only for Owner/Co-Admin */}
      {canManageMembers && (
        <CollapsibleSection icon="➕" title="Helfer einladen" defaultOpen>
          <div style={styles.inviteSection}>
            <p style={styles.inviteDescription}>
              Erstelle einen Einladungs-Link, um Helfer zu deinem Turnier hinzuzufügen.
            </p>

            <Button
              variant="primary"
              onClick={() => setShowInviteDialog(true)}
              style={styles.inviteButton}
            >
              + Einladung erstellen
            </Button>

            {/* Show created invite link */}
            {createdInviteLink && (
              <div style={styles.linkContainer}>
                <p style={styles.linkLabel}>Einladungs-Link erstellt:</p>
                <div style={styles.linkBox}>
                  <code style={styles.linkCode}>{createdInviteLink}</code>
                  <Button
                    variant={copySuccess ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => { void handleCopyLink(); }}
                  >
                    {copySuccess ? '✓ Kopiert' : 'Kopieren'}
                  </Button>
                </div>
                <p style={styles.linkHint}>
                  Teile diesen Link mit der Person, die du einladen möchtest.
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Member List */}
      <CollapsibleSection icon="👤" title="Aktuelle Mitglieder" defaultOpen={!canManageMembers}>
        <MemberList
          tournamentId={tournamentId}
          availableTeams={availableTeams}
          onInvite={canManageMembers ? () => setShowInviteDialog(true) : undefined}
        />
      </CollapsibleSection>

      {/* Active Invitations - Only for Owner/Co-Admin */}
      {canManageMembers && activeInvitations.length > 0 && (
        <CollapsibleSection icon="🔗" title={`Aktive Einladungen (${activeInvitations.length})`}>
          <div style={styles.invitationList}>
            {activeInvitations.map(invitation => (
              <div key={invitation.id} style={styles.invitationCard}>
                <div style={styles.invitationInfo}>
                  <span style={styles.invitationRole}>
                    {invitation.role === 'co-admin' && 'Stellvertreter'}
                    {invitation.role === 'collaborator' && 'Helfer'}
                    {invitation.role === 'trainer' && 'Trainer'}
                    {invitation.role === 'viewer' && 'Zuschauer'}
                  </span>
                  <span style={styles.invitationMeta}>
                    {invitation.useCount}/{invitation.maxUses === 0 ? '∞' : invitation.maxUses} verwendet
                  </span>
                </div>
                <code style={styles.invitationToken}>
                  {invitation.token.substring(0, 8)}...
                </code>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Referee Assignment - Coming Soon */}
      <CollapsibleSection icon="👔" title="Schiedsrichter-Zuweisung">
        <div style={styles.comingSoon}>
          <p>
            {tournament.refereeConfig?.mode === 'none'
              ? 'Schiedsrichter-Modus ist deaktiviert.'
              : 'Schiedsrichter-Übersicht wird in einer späteren Version verfügbar sein.'}
          </p>
        </div>
      </CollapsibleSection>

      {/* Invite Dialog */}
      {showInviteDialog && (
        <InviteDialog
          tournamentId={tournamentId}
          availableTeams={availableTeams}
          onClose={() => setShowInviteDialog(false)}
          onInviteCreated={handleInviteCreated}
        />
      )}
    </CategoryPage>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  // Auth Prompt
  authPrompt: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
  } as CSSProperties,

  authIcon: {
    fontSize: 48,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  authTitle: {
    margin: 0,
    marginBottom: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  authText: {
    margin: 0,
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  badge: {
    display: 'inline-block',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.medium,
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  // Invite Section
  inviteSection: {
    padding: cssVars.spacing.md,
  } as CSSProperties,

  inviteDescription: {
    margin: 0,
    marginBottom: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  inviteButton: {
    width: '100%',
  } as CSSProperties,

  // Link Container
  linkContainer: {
    marginTop: cssVars.spacing.lg,
    padding: cssVars.spacing.md,
    background: cssVars.colors.successLight,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.success}`,
  } as CSSProperties,

  linkLabel: {
    margin: 0,
    marginBottom: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.success,
  } as CSSProperties,

  linkBox: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.sm,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.sm,
  } as CSSProperties,

  linkCode: {
    flex: 1,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    wordBreak: 'break-all',
  } as CSSProperties,

  linkHint: {
    margin: 0,
    marginTop: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textTertiary,
  } as CSSProperties,

  // Invitation List
  invitationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
  } as CSSProperties,

  invitationCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
  } as CSSProperties,

  invitationInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  } as CSSProperties,

  invitationRole: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  invitationMeta: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  invitationToken: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.sm,
  } as CSSProperties,

  // Coming Soon
  comingSoon: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textMuted,
  } as CSSProperties,
} as const;

export default TeamHelpersCategory;
