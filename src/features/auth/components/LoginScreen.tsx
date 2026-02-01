/**
 * LoginScreen - Login mit Email/Password oder Magic Link
 *
 * Phase 2: Supabase Auth Integration
 *
 * Features:
 * - Email/Password Login
 * - Magic Link Option
 * - Google OAuth
 * - Als Gast fortfahren Option
 * - Semi-transparenter Backdrop für Kontext
 * - ESC-Taste zum Schließen
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { useAuth } from '../hooks/useAuth';
import { useLoginForm } from '../hooks/useLoginForm';
import { checkOAuthOnlyUser, getOAuthPasswordResetMessage } from '../utils/authHelpers';
import { AUTH_ERRORS } from '../constants';
import { loginStyles as styles } from './LoginScreen.styles';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { LoginResetPasswordDialog, LoginMagicLinkDialog, LoginSuccessDialog } from './LoginDialogs';
import { OfflineBanner } from './OfflineBanner';

interface LoginScreenProps {
  /** Called when login is successful */
  onSuccess?: () => void;
  /** Called when user clicks "Register" link */
  onNavigateToRegister?: () => void;
  /** Called when user clicks "Continue as guest" */
  onContinueAsGuest?: () => void;
  /** Called when user wants to go back/close */
  onBack?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSuccess,
  onNavigateToRegister,
  onContinueAsGuest,
  onBack,
}) => {
  const { login, sendMagicLink, loginWithGoogle, continueAsGuest, resetPassword, connectionState, reconnect } = useAuth();
  const isOffline = connectionState === 'offline';

  const {
    formData, errors: fieldErrors,
    setEmail, setPassword, setLoginMode,
    validateForm,
  } = useLoginForm();

  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);

  // Focus trap for main login form
  const formTrap = useFocusTrap({
    isActive: !resetPasswordSent && !magicLinkSent && !showSuccess,
    onEscape: onBack,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      if (formData.loginMode === 'magic-link') {
        const result = await sendMagicLink(formData.email);

        if (result.success) {
          setMagicLinkSent(true);
        } else {
          setApiError(result.error ?? AUTH_ERRORS.MAGIC_LINK_FAILED);
        }
      } else {
        const result = await login(formData.email, formData.password);

        if (result.success) {
          if (result.migratedCount && result.migratedCount > 0) {
            setMigratedCount(result.migratedCount);
          }
          setShowSuccess(true);
          const delay = (result.migratedCount && result.migratedCount > 0) ? 2500 : 1500;
          setTimeout(() => {
            onSuccess?.();
          }, delay);
        } else {
          setApiError(result.error ?? AUTH_ERRORS.LOGIN_FAILED);
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Login error:', err);
      }
      setApiError(AUTH_ERRORS.UNEXPECTED);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setApiError(null);
    setIsLoading(true);

    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setApiError(result.error ?? AUTH_ERRORS.GOOGLE_LOGIN_FAILED);
        setIsLoading(false);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Google login error:', err);
      }
      setApiError(AUTH_ERRORS.UNEXPECTED);
      setIsLoading(false);
    }
  };

  const handleGuestContinue = async () => {
    await continueAsGuest();
    onContinueAsGuest?.();
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setApiError(AUTH_ERRORS.EMAIL_REQUIRED);
      return;
    }

    setApiError(null);
    setIsLoading(true);

    try {
      const oauthCheck = await checkOAuthOnlyUser(formData.email);

      if (oauthCheck.isOAuthOnly) {
        setApiError(getOAuthPasswordResetMessage(oauthCheck.provider));
        setIsLoading(false);
        return;
      }

      if (oauthCheck.error && import.meta.env.DEV) {
        console.warn('OAuth check failed, proceeding with reset anyway:', oauthCheck.error);
      }

      const result = await resetPassword(formData.email);

      if (result.success) {
        setResetPasswordSent(true);
      } else {
        setApiError(result.error ?? AUTH_ERRORS.PASSWORD_RESET_FAILED);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Reset password error:', err);
      }
      setApiError(AUTH_ERRORS.UNEXPECTED);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onBack) {
      onBack();
    }
  };

  // Reset Password Sent State
  if (resetPasswordSent) {
    return (
      <LoginResetPasswordDialog
        email={formData.email}
        onClose={() => setResetPasswordSent(false)}
        onBackdropClick={handleBackdropClick}
      />
    );
  }

  // Magic Link Sent State
  if (magicLinkSent) {
    return (
      <LoginMagicLinkDialog
        email={formData.email}
        onClose={() => setMagicLinkSent(false)}
        onBackdropClick={handleBackdropClick}
      />
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <LoginSuccessDialog
        migratedCount={migratedCount}
        onClose={() => onSuccess?.()}
      />
    );
  }

  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div
        ref={formTrap.containerRef}
        style={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        {/* Header with back and close buttons */}
        <div style={styles.header}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={styles.backButton}
              aria-label="Zurück"
            >
              ← Zurück
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={styles.closeButton}
              aria-label="Schließen"
            >
              ✕
            </button>
          )}
        </div>

        <h1 id="login-title" style={styles.title}>Anmelden</h1>

        {/* Offline Banner */}
        {isOffline && (
          <OfflineBanner
            subtitle="Nur Gast-Modus verfügbar"
            onRetry={() => void reconnect()}
            data-testid="offline-banner"
          />
        )}

        <p style={styles.subtitle}>
          {formData.loginMode === 'password'
            ? 'Melde dich mit E-Mail und Passwort an.'
            : 'Wir senden dir einen Magic Link per E-Mail.'}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mein-verein.de"
              style={{
                ...styles.input,
                ...(fieldErrors.email ? styles.inputError : {}),
              }}
              autoComplete="email"
              autoFocus
              required
              data-testid="login-email-input"
            />
            {fieldErrors.email && <span style={styles.errorText}>{fieldErrors.email}</span>}
          </div>

          {formData.loginMode === 'password' && (
            <div style={styles.inputGroup}>
              <label htmlFor="password" style={styles.label}>
                Passwort
              </label>
              <PasswordInput
                id="password"
                name="password"
                value={formData.password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  ...styles.input,
                  ...(fieldErrors.password ? styles.inputError : {}),
                }}
                autoComplete="current-password"
                required
                minLength={6}
                data-testid="login-password-input"
              />
              {fieldErrors.password && <span style={styles.errorText}>{fieldErrors.password}</span>}
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                disabled={isLoading}
                style={styles.forgotPasswordLink}
              >
                Passwort vergessen?
              </button>
            </div>
          )}

          {apiError && <span style={styles.errorText} data-testid="login-error-message">{apiError}</span>}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            style={styles.button}
            data-testid="login-submit-button"
          >
            {formData.loginMode === 'password' ? 'Anmelden' : 'Magic Link senden'}
          </Button>
        </form>

        {/* Login mode toggle */}
        <button
          type="button"
          onClick={() => setLoginMode(formData.loginMode === 'password' ? 'magic-link' : 'password')}
          style={styles.modeToggle}
        >
          {formData.loginMode === 'password'
            ? 'Stattdessen Magic Link verwenden'
            : 'Mit Passwort anmelden'}
        </button>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>oder</span>
          <span style={styles.dividerLine} />
        </div>

        {/* Google Login */}
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void handleGoogleLogin()}
          disabled={isLoading}
          style={styles.googleButton}
        >
          <span style={styles.googleIcon}>G</span>
          Mit Google anmelden
        </Button>

        {/* Guest option */}
        <Button
          variant="ghost"
          fullWidth
          onClick={() => void handleGuestContinue()}
          disabled={isLoading}
          style={styles.ghostButton}
          data-testid="login-guest-button"
        >
          Als Gast fortfahren
        </Button>

        <p style={styles.footer}>
          Noch kein Konto?{' '}
          <button
            type="button"
            onClick={onNavigateToRegister}
            style={styles.link}
            data-testid="login-register-link"
          >
            Registrieren
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
