/**
 * InviteAcceptScreen - Screen zum Annehmen einer Einladung
 *
 * Zeigt Einladungs-Details und ermöglicht Annahme.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.3
 */

import React, { useState, useEffect, CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useInvitation } from '../hooks/useInvitation';
import type { Invitation } from '../types/auth.types';
import { ROLE_LABELS } from '../types/auth.types';
import type { InvitationValidationResult } from '../services/invitationService';

interface InviteAcceptScreenProps {
  /** Token aus der URL */
  token: string;
  /** Callback wenn Einladung angenommen wurde */
  onAccepted?: (tournamentId: string) => void;
  /** Callback wenn User sich erst anmelden muss */
  onNeedLogin?: () => void;
  /** Callback bei Fehler oder Abbruch */
  onCancel?: () => void;
}

type ScreenState = 'loading' | 'valid' | 'invalid' | 'accepting' | 'success' | 'error';

export const InviteAcceptScreen: React.FC<InviteAcceptScreenProps> = ({
  token,
  onAccepted,
  onNeedLogin,
  onCancel,
}) => {
  const { isAuthenticated, isGuest } = useAuth();
  const { validateToken, acceptToken, error: inviteError, clearError } = useInvitation();

  const [state, setState] = useState<ScreenState>('loading');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [tournamentName, setTournamentName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Validate token on mount
  useEffect(() => {
    const result: InvitationValidationResult = validateToken(token);

    if (result.valid && result.invitation) {
      setInvitation(result.invitation);
      setTournamentName(result.tournament?.name ?? 'Unbekanntes Turnier');
      setState('valid');
    } else {
      setErrorMessage(result.error ?? 'Ungültige Einladung');
      setState('invalid');
    }
  }, [token, validateToken]);

  const handleAccept = () => {
    // Guest users need to login first
    if (!isAuthenticated || isGuest) {
      onNeedLogin?.();
      return;
    }

    setState('accepting');
    clearError();

    const result = acceptToken(token);

    if (result.success && result.membership) {
      const tournamentId = result.membership.tournamentId;
      setState('success');
      setTimeout(() => {
        onAccepted?.(tournamentId);
      }, 1500);
    } else {
      setErrorMessage(result.error ?? 'Fehler beim Annehmen der Einladung');
      setState('error');
    }
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Einladung wird geprüft...</p>
        </div>
      </div>
    );
  }

  // Invalid invitation
  if (state === 'invalid') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.title}>Einladung ungültig</h2>
          <p style={styles.description}>{errorMessage}</p>
          <Button variant="primary" fullWidth onClick={onCancel}>
            Zurück
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (state === 'success') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h2 style={styles.title}>Willkommen!</h2>
          <p style={styles.description}>
            Du bist jetzt Mitglied von &quot;{tournamentName}&quot;.
          </p>
          <p style={styles.redirectText}>Du wirst weitergeleitet...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.title}>Fehler</h2>
          <p style={styles.description}>{errorMessage || inviteError}</p>
          <Button variant="primary" fullWidth onClick={onCancel}>
            Zurück
          </Button>
        </div>
      </div>
    );
  }

  // Valid invitation - show details
  const roleInfo = invitation ? ROLE_LABELS[invitation.role] : null;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Einladung zum Turnier</h2>

        <div style={styles.tournamentBox}>
          <p style={styles.tournamentName}>{tournamentName}</p>
        </div>

        <div style={styles.details}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Deine Rolle:</span>
            <span style={styles.detailValue}>{roleInfo?.label}</span>
          </div>
          <p style={styles.roleDescription}>{roleInfo?.description}</p>
        </div>

        {(!isAuthenticated || isGuest) && (
          <div style={styles.loginHint}>
            <p style={styles.hintText}>
              Du musst angemeldet sein, um die Einladung anzunehmen.
            </p>
          </div>
        )}

        <div style={styles.actions}>
          <Button
            variant="primary"
            fullWidth
            onClick={handleAccept}
            loading={state === 'accepting'}
            style={styles.acceptButton}
          >
            {!isAuthenticated || isGuest ? 'Anmelden & Annehmen' : 'Einladung annehmen'}
          </Button>
          <Button variant="ghost" fullWidth onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 'var(--min-h-screen)',
    padding: cssVars.spacing.lg,
    background: cssVars.colors.background,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: cssVars.spacing.xl,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px solid ${cssVars.colors.border}`,
    textAlign: 'center',
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    margin: '0 auto',
    marginBottom: cssVars.spacing.md,
    border: `4px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    margin: 0,
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
  },
  successIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto',
    marginBottom: cssVars.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.xxl,
    color: cssVars.colors.onPrimary,
    background: cssVars.colors.success,
    borderRadius: cssVars.borderRadius.full,
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto',
    marginBottom: cssVars.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.onPrimary,
    background: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.full,
  },
  title: {
    margin: 0,
    marginBottom: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  },
  description: {
    margin: 0,
    marginBottom: cssVars.spacing.lg,
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
  },
  redirectText: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textTertiary,
  },
  tournamentBox: {
    padding: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.lg,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
  },
  tournamentName: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  },
  details: {
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.lg,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
    textAlign: 'left',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.xs,
  },
  detailLabel: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  detailValue: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.primary,
  },
  roleDescription: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textTertiary,
  },
  loginHint: {
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.md,
    background: `${cssVars.colors.warning}15`,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.warning}`,
  },
  hintText: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.warning,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  },
  acceptButton: {
    minHeight: '56px',
  },
};

export default InviteAcceptScreen;
