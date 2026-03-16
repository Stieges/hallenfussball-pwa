/**
 * SetPasswordScreen - Neues Passwort setzen nach Recovery
 *
 * Wird nach Klick auf Password-Reset-Link angezeigt.
 * Ermöglicht dem User ein neues Passwort zu setzen.
 */

import React, { useState, useEffect, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ERRORS } from '../constants';

export const SetPasswordScreen: React.FC = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { updatePassword, session, isAuthenticated, isLoading: authLoading } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  // Session-Check beim Mount: Wenn kein Auth geladen ist und keine Session existiert,
  // muss der User einen neuen Reset-Link anfordern
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !session)) {
      setSessionError(true);
    }
  }, [authLoading, isAuthenticated, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Double-check session (könnte während Eingabe abgelaufen sein)
    if (!session) {
      setSessionError(true);
      return;
    }

    // Validation
    if (password.length < 6) {
      setError(AUTH_ERRORS.PASSWORD_TOO_SHORT);
      return;
    }

    if (password !== confirmPassword) {
      setError(AUTH_ERRORS.PASSWORD_MISMATCH);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updatePassword(password);

      if (result.success) {
        setShowSuccess(true);
      } else {
        setError(result.error ?? AUTH_ERRORS.PASSWORD_UPDATE_FAILED);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Update password error:', err);
      }
      setError(AUTH_ERRORS.UNEXPECTED);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    void navigate('/');
  };

  const handleBackToLogin = () => {
    void navigate('/login', { replace: true });
  };

  // Session abgelaufen oder nicht vorhanden - User muss neu starten
  if (sessionError) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card} role="dialog" aria-modal="true" aria-label={t('setPassword.sessionExpired')}>
          <div style={styles.errorIcon}>!</div>
          <h1 style={styles.title}>{t('setPassword.sessionExpired')}</h1>
          <p style={styles.subtitle}>
            {t('setPassword.sessionExpiredMessage')}
          </p>
          <Button
            variant="primary"
            fullWidth
            onClick={handleBackToLogin}
            style={styles.button}
          >
            {t('setPassword.backToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  // Loading-State: Auth wird noch initialisiert
  if (authLoading) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card} role="dialog" aria-modal="true" aria-label={t('setPassword.loadingAriaLabel')}>
          <div style={styles.spinner} />
          <p style={styles.subtitle}>{t('setPassword.loading')}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card} role="dialog" aria-modal="true" aria-label={t('setPassword.success.title')}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>{t('setPassword.success.title')}</h2>
          <p style={styles.successText}>
            {t('setPassword.success.message')}
          </p>
          <Button
            variant="primary"
            fullWidth
            onClick={handleContinue}
            style={{ marginTop: cssVars.spacing.lg }}
          >
            {t('setPassword.success.continue')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.card} role="dialog" aria-modal="true" aria-labelledby="set-password-title">
        <h1 id="set-password-title" style={styles.title}>{t('setPassword.title')}</h1>
        <p style={styles.subtitle}>
          {t('setPassword.subtitle')}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>
              {t('setPassword.newPassword')}
            </label>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('setPassword.newPasswordPlaceholder')}
              style={{
                ...styles.input,
                ...(error ? styles.inputError : {}),
              }}
              autoComplete="new-password"
              autoFocus
              required
              minLength={6}
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="confirm-password" style={styles.label}>
              {t('setPassword.confirmPassword')}
            </label>
            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('setPassword.confirmPasswordPlaceholder')}
              style={{
                ...styles.input,
                ...(error ? styles.inputError : {}),
              }}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          {error && <span style={styles.errorText}>{error}</span>}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            style={styles.button}
          >
            {t('setPassword.submit')}
          </Button>
        </form>

        <Button
          variant="ghost"
          fullWidth
          onClick={handleContinue}
          disabled={isSubmitting}
          style={styles.ghostButton}
        >
          {t('setPassword.skip')}
        </Button>
      </div>
    </div>
  );
};

// Styles using design tokens
const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: cssVars.spacing.lg,
    background: cssVars.colors.backdrop,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1000,
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: '400px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: cssVars.spacing.xl,
    background: cssVars.colors.surfaceSolid,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px solid ${cssVars.colors.border}`,
    boxShadow: `0 8px 32px ${cssVars.colors.shadowModal}`,
  },
  title: {
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  },
  label: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  },
  input: {
    width: '100%',
    height: '48px',
    padding: `0 ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.lg,
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  inputError: {
    borderColor: cssVars.colors.error,
  },
  errorText: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.error,
  },
  button: {
    minHeight: '56px',
  },
  ghostButton: {
    minHeight: '48px',
    marginTop: cssVars.spacing.sm,
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
    color: cssVars.colors.background,
    background: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.full,
  },
  successTitle: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
    textAlign: 'center',
  },
  successText: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    textAlign: 'center',
    lineHeight: '1.5',
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
    color: cssVars.colors.background,
    background: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.full,
  },
  spinner: {
    width: '48px',
    height: '48px',
    margin: '0 auto',
    marginBottom: cssVars.spacing.md,
    border: `4px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default SetPasswordScreen;
