/**
 * RegisterDialogs - Extracted dialog states from RegisterScreen
 *
 * Contains:
 * - RegisterEmailConfirmationDialog: Shown when email verification is required
 * - RegisterSuccessDialog: Shown after successful registration with immediate session
 *
 * Each dialog manages its own focus trap.
 */

import React from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { registerStyles as styles } from './RegisterScreen.styles';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

// =============================================================================
// Email Confirmation Dialog
// =============================================================================

interface RegisterEmailConfirmationDialogProps {
  email: string;
  migratedCount: number;
  onClose: () => void;
}

export const RegisterEmailConfirmationDialog: React.FC<RegisterEmailConfirmationDialogProps> = ({
  email,
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
        aria-labelledby="email-confirm-title"
      >
        <button
          type="button"
          onClick={onClose}
          style={styles.successCloseButton}
          aria-label="Schließen"
        >
          ✕
        </button>
        <div style={styles.successIcon}>✉</div>
        <h2 id="email-confirm-title" style={styles.successTitle}>Bestätige deine E-Mail</h2>
        <p style={styles.successText}>
          Wir haben eine Bestätigungs-E-Mail an <strong>{email}</strong> gesendet.
          Bitte klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
          {migratedCount > 0 && (
            <><br /><br />{migratedCount} Turnier{migratedCount === 1 ? ' wird' : 'e werden'} nach der Aktivierung synchronisiert.</>
          )}
        </p>
        <Button
          variant="primary"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          Zum Login
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// Success Dialog
// =============================================================================

interface RegisterSuccessDialogProps {
  migratedCount: number;
  onClose: () => void;
}

export const RegisterSuccessDialog: React.FC<RegisterSuccessDialogProps> = ({
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
        aria-labelledby="success-title"
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
        <h2 id="success-title" style={styles.successTitle}>Willkommen!</h2>
        <p style={styles.successText}>
          Dein Konto wurde erstellt.
          {migratedCount > 0 && (
            <><br />{migratedCount} Turnier{migratedCount === 1 ? '' : 'e'} synchronisiert!</>
          )}
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
