/**
 * TournamentLimitModal - Modal für Turnier-Limit bei anonymen Usern
 *
 * Wird angezeigt wenn anonyme User das Limit von 3 Turnieren erreicht haben.
 * Bietet Optionen zur Registrierung oder Login um das Limit zu entfernen.
 *
 * @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md - Section on anonymous user limits
 * @see SQL Migration 005_anonymous_limit.sql - RLS policy enforcement
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/dialogs/Dialog';
import { useTournamentLimit, ANONYMOUS_TOURNAMENT_LIMIT } from '../hooks/useTournamentLimit';

interface TournamentLimitModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user clicks "Register" */
  onRegisterClick?: () => void;
  /** Callback when user clicks "Login" */
  onLoginClick?: () => void;
}

/**
 * Modal that shows when anonymous users reach their tournament limit.
 *
 * @example
 * ```tsx
 * const { canCreate } = useTournamentLimit();
 *
 * <TournamentLimitModal
 *   isOpen={showLimitModal}
 *   onClose={() => setShowLimitModal(false)}
 *   onRegisterClick={() => navigate('/register')}
 *   onLoginClick={() => navigate('/login')}
 * />
 * ```
 */
export const TournamentLimitModal: React.FC<TournamentLimitModalProps> = ({
  isOpen,
  onClose,
  onRegisterClick,
  onLoginClick,
}) => {
  const { used, limit, isLimited } = useTournamentLimit();

  // Don't render if user isn't limited
  if (!isLimited) {
    return null;
  }

  const handleRegister = () => {
    onClose();
    onRegisterClick?.();
  };

  const handleLogin = () => {
    onClose();
    onLoginClick?.();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Turnier-Limit erreicht"
      maxWidth="420px"
      data-testid="tournament-limit-modal"
    >
      <div style={styles.content}>
        {/* Icon */}
        <div style={styles.iconContainer}>
          <span style={styles.icon} role="img" aria-label="Warnung">
            ⚠️
          </span>
        </div>

        {/* Message */}
        <div style={styles.messageContainer}>
          <p style={styles.message}>
            Du hast das Limit von <strong>{ANONYMOUS_TOURNAMENT_LIMIT} Turnieren</strong> für
            Gast-Accounts erreicht ({used}/{limit} verwendet).
          </p>
          <p style={styles.submessage}>
            Erstelle ein kostenloses Konto, um unbegrenzt viele Turniere zu verwalten
            und deine Daten sicher in der Cloud zu speichern.
          </p>
        </div>

        {/* Benefits List */}
        <div style={styles.benefitsList}>
          <div style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            <span>Unbegrenzte Turniere</span>
          </div>
          <div style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            <span>Cloud-Synchronisation</span>
          </div>
          <div style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            <span>Zugriff von allen Geräten</span>
          </div>
          <div style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            <span>Team-Einladungen teilen</span>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <Button
            variant="primary"
            onClick={handleRegister}
            style={styles.primaryButton}
            data-testid="tournament-limit-register-button"
          >
            Kostenlos registrieren
          </Button>

          {onLoginClick && (
            <Button
              variant="ghost"
              onClick={handleLogin}
              style={styles.secondaryButton}
              data-testid="tournament-limit-login-button"
            >
              Ich habe bereits ein Konto
            </Button>
          )}
        </div>

        {/* Hint */}
        <p style={styles.hint}>
          Deine bestehenden Turniere werden automatisch übernommen.
        </p>
      </div>
    </Dialog>
  );
};

const styles: Record<string, CSSProperties> = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: cssVars.spacing.lg,
  },
  iconContainer: {
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: cssVars.colors.warning + '20',
    borderRadius: cssVars.borderRadius.full,
  },
  icon: {
    fontSize: cssVars.fontSizes.xxxl,
  },
  messageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  },
  message: {
    margin: 0,
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    lineHeight: '1.5',
  },
  submessage: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    lineHeight: '1.5',
  },
  benefitsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    width: '100%',
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
    textAlign: 'left',
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
  },
  checkIcon: {
    color: cssVars.colors.success,
    fontWeight: 'bold',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    height: '48px',
  },
  secondaryButton: {
    width: '100%',
  },
  hint: {
    margin: 0,
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textTertiary,
  },
};

export default TournamentLimitModal;
