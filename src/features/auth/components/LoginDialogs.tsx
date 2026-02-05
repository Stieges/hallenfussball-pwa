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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('auth');
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
        <h2 id="reset-password-title" style={styles.successTitle}>{t('loginDialogs.resetPassword.title')}</h2>
        <p style={styles.successText}>
          {t('loginDialogs.resetPassword.message', { email })}
        </p>
        <Button
          variant="ghost"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          {t('loginDialogs.resetPassword.back')}
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
  const { t } = useTranslation('auth');
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
        <h2 id="magic-link-title" style={styles.successTitle}>{t('loginDialogs.magicLink.title')}</h2>
        <p style={styles.successText}>
          {t('loginDialogs.magicLink.message', { email })}
        </p>
        <Button
          variant="ghost"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          {t('loginDialogs.magicLink.otherEmail')}
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
  const { t } = useTranslation('auth');
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
          aria-label={t('login.close')}
        >
          ✕
        </button>
        <div style={styles.successIcon}>✓</div>
        <h2 id="login-success-title" style={styles.successTitle}>{t('loginDialogs.success.title')}</h2>
        <p style={styles.successText}>
          {migratedCount > 0
            ? t('loginDialogs.success.migrated', { count: migratedCount })
            : t('loginDialogs.success.redirecting')}
        </p>
        <Button
          variant="primary"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          {t('loginDialogs.success.continue')}
        </Button>
      </div>
    </div>
  );
};
