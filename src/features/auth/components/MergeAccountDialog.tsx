/**
 * MergeAccountDialog - Dialog for merging anonymous user data into existing account
 *
 * Shown when an anonymous user tries to register with an email that already exists.
 * Offers options to:
 * 1. Log into existing account and merge data
 * 2. Cancel and use a different email
 *
 * @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md - Section on Merge & Claim
 */

import React, { useState, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/dialogs/Dialog';
import { mergeAccounts, MergeResult } from '../services/mergeService';

interface MergeAccountDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** The email that already exists */
  conflictEmail: string;
  /** The anonymous user ID whose data should be merged */
  anonymousUserId: string;
  /** Callback when dialog is closed (cancelled) */
  onClose: () => void;
  /** Callback when user chooses to login to existing account */
  onLoginClick: () => void;
  /** Callback after successful merge */
  onMergeSuccess?: (result: MergeResult) => void;
  /** Callback on merge error */
  onMergeError?: (error: string) => void;
}

type DialogState = 'prompt' | 'merging' | 'success' | 'error';

/**
 * Dialog that handles the account merge flow.
 *
 * Flow:
 * 1. User sees conflict message with options
 * 2. User clicks "Login & Merge"
 * 3. (External) User authenticates with existing account
 * 4. This dialog is reopened with authenticated session
 * 5. Merge is executed automatically
 * 6. Success/Error state shown
 *
 * @example
 * ```tsx
 * <MergeAccountDialog
 *   isOpen={showMergeDialog}
 *   conflictEmail="user@example.com"
 *   anonymousUserId={currentUser.id}
 *   onClose={() => setShowMergeDialog(false)}
 *   onLoginClick={() => navigate('/login', { state: { mergeAfterLogin: true } })}
 *   onMergeSuccess={(result) => {
 *     showToast(`${result.tournamentsMerged} Turniere übertragen!`);
 *   }}
 * />
 * ```
 */
export const MergeAccountDialog: React.FC<MergeAccountDialogProps> = ({
  isOpen,
  conflictEmail,
  anonymousUserId,
  onClose,
  onLoginClick,
  onMergeSuccess,
  onMergeError,
}) => {
  const { t } = useTranslation('auth');
  const [state, setState] = useState<DialogState>('prompt');
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoginClick = () => {
    onClose();
    onLoginClick();
  };

  const handleMerge = async () => {
    setState('merging');
    setError(null);

    const result = await mergeAccounts(anonymousUserId);

    if (result.success) {
      setMergeResult(result);
      setState('success');
      onMergeSuccess?.(result);
    } else {
      setError(result.error ?? t('errors.unknownError'));
      setState('error');
      onMergeError?.(result.error ?? t('errors.unknownError'));
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setState('prompt');
    setMergeResult(null);
    setError(null);
    onClose();
  };

  const renderContent = () => {
    switch (state) {
      case 'prompt':
        return (
          <>
            {/* Icon */}
            <div style={styles.iconContainer}>
              <span style={styles.icon} role="img" aria-label="Info">
                ℹ️
              </span>
            </div>

            {/* Message */}
            <div style={styles.messageContainer}>
              <p style={styles.message}>
                {t('mergeDialog.message', { email: conflictEmail })}
              </p>
              <p style={styles.submessage}>
                {t('mergeDialog.submessage')}
              </p>
            </div>

            {/* Benefits List */}
            <div style={styles.benefitsList}>
              <div style={styles.benefitItem}>
                <span style={styles.checkIcon}>✓</span>
                <span>{t('mergeDialog.benefits.transferAll')}</span>
              </div>
              <div style={styles.benefitItem}>
                <span style={styles.checkIcon}>✓</span>
                <span>{t('mergeDialog.benefits.noDataLoss')}</span>
              </div>
              <div style={styles.benefitItem}>
                <span style={styles.checkIcon}>✓</span>
                <span>{t('mergeDialog.benefits.cloudAccess')}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={styles.actions}>
              <Button
                variant="primary"
                onClick={handleLoginClick}
                style={styles.primaryButton}
                data-testid="merge-login-button"
              >
                {t('mergeDialog.loginWithExisting')}
              </Button>

              <Button
                variant="ghost"
                onClick={handleClose}
                style={styles.secondaryButton}
                data-testid="merge-different-email-button"
              >
                {t('mergeDialog.useOtherEmail')}
              </Button>
            </div>
          </>
        );

      case 'merging':
        return (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>{t('mergeDialog.merging.title')}</p>
            <p style={styles.loadingSubtext}>
              {t('mergeDialog.merging.message')}
            </p>
          </div>
        );

      case 'success':
        return (
          <div data-testid="merge-success-message">
            {/* Icon */}
            <div style={styles.successIconContainer}>
              <span style={styles.icon} role="img" aria-label="Erfolg">
                ✅
              </span>
            </div>

            {/* Message */}
            <div style={styles.messageContainer}>
              <p style={styles.successTitle}>{t('mergeDialog.success.title')}</p>
              <p style={styles.submessage}>
                {mergeResult?.tournamentsMerged
                  ? t('mergeDialog.success.merged', { count: mergeResult.tournamentsMerged })
                  : t('mergeDialog.success.fallback')}
              </p>
            </div>

            {/* Action */}
            <div style={styles.actions}>
              <Button
                variant="primary"
                onClick={handleClose}
                style={styles.primaryButton}
              >
                {t('mergeDialog.done')}
              </Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div data-testid="merge-error-message">
            {/* Icon */}
            <div style={styles.errorIconContainer}>
              <span style={styles.icon} role="img" aria-label="Fehler">
                ❌
              </span>
            </div>

            {/* Message */}
            <div style={styles.messageContainer}>
              <p style={styles.errorTitle}>{t('mergeDialog.error.title')}</p>
              <p style={styles.submessage}>
                {error ?? t('errors.unknownError')}
              </p>
            </div>

            {/* Actions */}
            <div style={styles.actions}>
              <Button
                variant="primary"
                onClick={handleMerge}
                style={styles.primaryButton}
                data-testid="merge-retry-button"
              >
                {t('mergeDialog.error.retry')}
              </Button>

              <Button
                variant="ghost"
                onClick={handleClose}
                style={styles.secondaryButton}
              >
                {t('mergeDialog.error.cancel')}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={state === 'merging' ? () => void 0 : handleClose}
      title={t('mergeDialog.title')}
      maxWidth="420px"
      closeOnBackdropClick={state !== 'merging'}
      data-testid="merge-account-dialog"
    >
      <div style={styles.content}>{renderContent()}</div>
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
    background: cssVars.colors.primaryLight,
    borderRadius: cssVars.borderRadius.full,
  },
  successIconContainer: {
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: cssVars.colors.successLight,
    borderRadius: cssVars.borderRadius.full,
  },
  errorIconContainer: {
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: cssVars.colors.errorLight,
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
  successTitle: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.success,
  },
  errorTitle: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.error,
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
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.xl,
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: `4px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    margin: 0,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  },
  loadingSubtext: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
  },
};

export default MergeAccountDialog;
