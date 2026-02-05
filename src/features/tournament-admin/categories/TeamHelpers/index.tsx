/**
 * TeamHelpersCategory - Team & Helper Management
 *
 * Invite helpers, manage roles, and oversee team activity.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.4
 * @see docs/concepts/MULTI-USER-KONZEPT.md
 */

import { useState, useEffect, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import { Button } from '../../../../components/ui/Button';
import { MemberList } from '../../../auth/components/MemberList';
import { InviteDialog } from '../../../auth/components/InviteDialog';
import { useTournamentMembers } from '../../../auth/hooks/useTournamentMembers';
import { useInvitation } from '../../../auth/hooks/useInvitation';
import type { Invitation } from '../../../auth/types/auth.types';
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
  const { t } = useTranslation('admin');
  const { user, isAuthenticated } = useAuth();
  const { myMembership } = useTournamentMembers(tournamentId);
  const { getActiveInvitations } = useInvitation();

  // Dialog states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeInvitations, setActiveInvitations] = useState<Invitation[]>([]);

  // Permission check: Can manage members?
  const canManageMembers = myMembership?.role === 'owner' || myMembership?.role === 'co-admin';

  // Load active invitations
  useEffect(() => {
    if (canManageMembers) {
      void getActiveInvitations(tournamentId).then(setActiveInvitations);
    }
  }, [tournamentId, canManageMembers, getActiveInvitations]);

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
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Fallback for browsers without Clipboard API
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
        title={t('teamHelpers.title')}
        description={t('teamHelpers.description')}
      >
        <div style={styles.authPrompt}>
          <div style={styles.authIcon}>🔐</div>
          <h3 style={styles.authTitle}>{t('teamHelpers.authRequired')}</h3>
          <p style={styles.authText}>
            {t('teamHelpers.authRequiredDesc')}
          </p>
          <span style={styles.badge}>{t('teamHelpers.goToSettings')}</span>
        </div>
      </CategoryPage>
    );
  }

  return (
    <CategoryPage
      icon="👥"
      title={t('teamHelpers.title')}
      description={t('teamHelpers.description')}
    >
      {/* Invite Section - Only for Owner/Co-Admin */}
      {canManageMembers && (
        <CollapsibleSection icon="➕" title={t('teamHelpers.inviteHelpers')} defaultOpen>
          <div style={styles.inviteSection}>
            <p style={styles.inviteDescription}>
              {t('teamHelpers.inviteDescription')}
            </p>

            <Button
              variant="primary"
              onClick={() => setShowInviteDialog(true)}
              style={styles.inviteButton}
            >
              {t('teamHelpers.createInvite')}
            </Button>

            {/* Show created invite link */}
            {createdInviteLink && (
              <div style={styles.linkContainer}>
                <p style={styles.linkLabel}>{t('teamHelpers.inviteLinkCreated')}</p>
                <div style={styles.linkBox}>
                  <code style={styles.linkCode}>{createdInviteLink}</code>
                  <Button
                    variant={copySuccess ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => { void handleCopyLink(); }}
                  >
                    {copySuccess ? t('teamHelpers.copied') : t('teamHelpers.copy')}
                  </Button>
                </div>
                <p style={styles.linkHint}>
                  {t('teamHelpers.shareLinkHint')}
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Member List */}
      <CollapsibleSection icon="👤" title={t('teamHelpers.currentMembers')} defaultOpen={!canManageMembers}>
        <MemberList
          tournamentId={tournamentId}
          availableTeams={availableTeams}
          onInvite={canManageMembers ? () => setShowInviteDialog(true) : undefined}
        />
      </CollapsibleSection>

      {/* Active Invitations - Only for Owner/Co-Admin */}
      {canManageMembers && activeInvitations.length > 0 && (
        <CollapsibleSection icon="🔗" title={t('teamHelpers.activeInvitations', { count: activeInvitations.length })}>
          <div style={styles.invitationList}>
            {activeInvitations.map(invitation => (
              <div key={invitation.id} style={styles.invitationCard}>
                <div style={styles.invitationInfo}>
                  <span style={styles.invitationRole}>
                    {invitation.role === 'co-admin' && t('teamHelpers.roleDeputy')}
                    {invitation.role === 'collaborator' && t('teamHelpers.roleHelper')}
                    {invitation.role === 'trainer' && t('teamHelpers.roleTrainer')}
                    {invitation.role === 'viewer' && t('teamHelpers.roleViewer')}
                  </span>
                  <span style={styles.invitationMeta}>
                    {t('teamHelpers.usedCount', { used: invitation.useCount, max: invitation.maxUses === 0 ? '∞' : invitation.maxUses })}
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
      <CollapsibleSection icon="👔" title={t('teamHelpers.refereeAssignment')}>
        <div style={styles.comingSoon}>
          <p>
            {tournament.refereeConfig?.mode === 'none'
              ? t('teamHelpers.refereeModeDisabled')
              : t('teamHelpers.refereeComingSoon')}
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
