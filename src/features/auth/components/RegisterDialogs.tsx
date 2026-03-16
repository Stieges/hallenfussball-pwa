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
import { useTranslation } from 'react-i18next';
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
        aria-labelledby="email-confirm-title"
      >
        <button
          type="button"
          onClick={onClose}
          style={styles.successCloseButton}
          aria-label={t('login.close')}
        >
          ✕
        </button>
        <div style={styles.successIcon}>✉</div>
        <h2 id="email-confirm-title" style={styles.successTitle}>{t('registerDialogs.emailConfirmation.title')}</h2>
        <p style={styles.successText}>
          {t('registerDialogs.emailConfirmation.message', { email })}
          {migratedCount > 0 && (
            <><br /><br />{t('registerDialogs.emailConfirmation.migrated', { count: migratedCount })}</>
          )}
        </p>
        <Button
          variant="primary"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          {t('registerDialogs.emailConfirmation.toLogin')}
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
        aria-labelledby="success-title"
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
        <h2 id="success-title" style={styles.successTitle}>{t('registerDialogs.success.title')}</h2>
        <p style={styles.successText}>
          {t('registerDialogs.success.message')}
          {migratedCount > 0 && (
            <><br />{t('registerDialogs.success.migrated', { count: migratedCount })}</>
          )}
        </p>
        <Button
          variant="primary"
          fullWidth
          onClick={onClose}
          style={{ marginTop: cssVars.spacing.lg }}
        >
          {t('registerDialogs.success.continue')}
        </Button>
      </div>
    </div>
  );
};
