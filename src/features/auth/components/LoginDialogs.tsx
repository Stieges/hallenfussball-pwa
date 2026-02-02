/**
 * LoginDialogs - Extracted dialog states from LoginScreen
 *
 * Contains:
 * - LoginResetPasswordDialog: Shown after "Forgot password" email is sent
 * - LoginMagicLinkDialog: Shown after magic link email is sent
 * - LoginSuccessDialog: Shown after successful login
 *
 * Each dialog manages its own focus trap.
 */

import React from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { loginStyles as styles } from './LoginScreen.styles';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

// =============================================================================
// Reset Password Dialog
// =============================================================================

interface LoginResetPasswordDialogProps {
  email: string;
  onClose: () => void;
  onBackdropClick: (e: React.MouseEvent) => void;
}

export const LoginResetPasswordDialog: React.FC<LoginResetPasswordDialogProps> = ({
  email,
  onClose,
  onBackdropClick,
}) => {
  const trap = useFocusTrap({
    isActive: true,
    onEscape: onClose,
  });

  return (
    <div style={styles.backdrop} onClick={onBackdropClick}>
      <div
        ref={trap.containerRef}
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
      >
        <div style={styles.successIcon}>✉</div>
        <h2 id="reset-password-title" style={styles.successTitle}>E-Mail gesendet!</h2>
        <p style={styles.successText}>
          Wir haben einen Link zum Zurücksetzen deines Passworts an <strong>{email}</strong> gesendet.
          Klicke auf den Link in der E-Mail, um ein neues Passwort zu setzen.
        </p>
        <Button
          variant="ghost"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          Zurück zum Login
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// Magic Link Dialog
// =============================================================================

interface LoginMagicLinkDialogProps {
  email: string;
  onClose: () => void;
  onBackdropClick: (e: React.MouseEvent) => void;
}

export const LoginMagicLinkDialog: React.FC<LoginMagicLinkDialogProps> = ({
  email,
  onClose,
  onBackdropClick,
}) => {
  const trap = useFocusTrap({
    isActive: true,
    onEscape: onClose,
  });

  return (
    <div style={styles.backdrop} onClick={onBackdropClick}>
      <div
        ref={trap.containerRef}
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="magic-link-title"
      >
        <div style={styles.successIcon}>✉</div>
        <h2 id="magic-link-title" style={styles.successTitle}>Magic Link gesendet!</h2>
        <p style={styles.successText}>
          Wir haben einen Login-Link an <strong>{email}</strong> gesendet.
          Klicke auf den Link in der E-Mail, um dich anzumelden.
        </p>
        <Button
          variant="ghost"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          Andere E-Mail verwenden
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// Success Dialog
// =============================================================================

interface LoginSuccessDialogProps {
  migratedCount: number;
  onClose: () => void;
}

export const LoginSuccessDialog: React.FC<LoginSuccessDialogProps> = ({
  migratedCount,
  onClose,
}) => {
  const trap = useFocusTrap({
    isActive: true,
    onEscape: onClose,
  });

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div
        ref={trap.containerRef}
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-success-title"
      >
        <button
          type="button"
          onClick={onClose}
          style={styles.successCloseButton}
          aria-label="Schließen"
        >
          ✕
        </button>
        <div style={styles.successIcon}>✓</div>
        <h2 id="login-success-title" style={styles.successTitle}>Angemeldet!</h2>
        <p style={styles.successText}>
          {migratedCount > 0
            ? `${migratedCount} Turnier${migratedCount === 1 ? '' : 'e'} synchronisiert!`
            : 'Du wirst weitergeleitet...'}
        </p>
        <Button
          variant="primary"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          Weiter
        </Button>
      </div>
    </div>
  );
};
