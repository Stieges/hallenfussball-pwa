/**
 * InviteAcceptScreen - Screen zum Annehmen einer Einladung
 *
 * Zeigt Einladungs-Details und ermöglicht Annahme.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.3
 */

import React, { useState, useEffect, CSSProperties } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
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
    minHeight: '100vh',
    padding: spacing.lg,
    background: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: spacing.xl,
    background: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border}`,
    textAlign: 'center',
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    margin: '0 auto',
    marginBottom: spacing.md,
    border: `4px solid ${colors.border}`,
    borderTopColor: colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    margin: 0,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  successIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto',
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.xxl,
    color: colors.onPrimary,
    background: colors.success,
    borderRadius: borderRadius.full,
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto',
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.onPrimary,
    background: colors.error,
    borderRadius: borderRadius.full,
  },
  title: {
    margin: 0,
    marginBottom: spacing.md,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  description: {
    margin: 0,
    marginBottom: spacing.lg,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  redirectText: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
  },
  tournamentBox: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    background: colors.surfaceLight,
    borderRadius: borderRadius.md,
  },
  tournamentName: {
    margin: 0,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
  },
  details: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    background: colors.surfaceLight,
    borderRadius: borderRadius.md,
    textAlign: 'left',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  roleDescription: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
  },
  loginHint: {
    padding: spacing.md,
    marginBottom: spacing.md,
    background: `${colors.warning}15`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.warning}`,
  },
  hintText: {
    margin: 0,
    fontSize: fontSizes.sm,
    color: colors.warning,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  acceptButton: {
    minHeight: '56px',
  },
};

export default InviteAcceptScreen;
