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

import React, { useState, useEffect } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { checkOAuthOnlyUser, getOAuthPasswordResetMessage } from '../utils/authHelpers';
import { loginStyles as styles } from './LoginScreen.styles';

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

type LoginMode = 'password' | 'magic-link';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSuccess,
  onNavigateToRegister,
  onContinueAsGuest,
  onBack,
}) => {
  const { login, sendMagicLink, loginWithGoogle, continueAsGuest, resetPassword, connectionState, reconnect } = useAuth();
  const isOffline = connectionState === 'offline';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onBack) {
        onBack();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onBack]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (loginMode === 'magic-link') {
        // Send magic link
        const result = await sendMagicLink(email);

        if (result.success) {
          setMagicLinkSent(true);
        } else {
          setError(result.error ?? 'Magic Link konnte nicht gesendet werden');
        }
      } else {
        // Password login
        const result = await login(email, password);

        if (result.success) {
          // Store migration count for success screen
          if (result.migratedCount && result.migratedCount > 0) {
            setMigratedCount(result.migratedCount);
          }
          setShowSuccess(true);
          setTimeout(() => {
            onSuccess?.();
          }, 500);
        } else {
          setError(result.error ?? 'Login fehlgeschlagen');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setError(result.error ?? 'Google Login fehlgeschlagen');
        setIsLoading(false);
      }
      // On success, the page will redirect
    } catch (err) {
      console.error('Google login error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten');
      setIsLoading(false);
    }
  };

  const handleGuestContinue = () => {
    continueAsGuest();
    onContinueAsGuest?.();
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Bitte gib zuerst deine E-Mail-Adresse ein.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Ghost Password Prevention: Check if user registered via OAuth
      // We process this safely - if the check fails (e.g. network), we assume it's safe to proceed
      // (Supabase will handle the actual email sending logic)
      const oauthCheck = await checkOAuthOnlyUser(email);

      // If we positively identified as OAuth-only, block and show message
      if (oauthCheck.isOAuthOnly) {
        setError(getOAuthPasswordResetMessage(oauthCheck.provider));
        setIsLoading(false);
        return;
      }

      // If there was an error during check (e.g. network), we log it but proceed
      if (oauthCheck.error) {
        console.warn('OAuth check failed, processing with reset anyway:', oauthCheck.error);
      }

      const result = await resetPassword(email);

      if (result.success) {
        setResetPasswordSent(true);
      } else {
        // Handle "Failed to fetch" or other errors specifically if needed
        const errorMessage = result.error ?? 'Passwort-Reset konnte nicht gesendet werden';
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten');
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
      <div style={styles.backdrop} onClick={handleBackdropClick}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✉</div>
          <h2 style={styles.successTitle}>E-Mail gesendet!</h2>
          <p style={styles.successText}>
            Wir haben einen Link zum Zurücksetzen deines Passworts an <strong>{email}</strong> gesendet.
            Klicke auf den Link in der E-Mail, um ein neues Passwort zu setzen.
          </p>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setResetPasswordSent(false)}
            style={{ marginTop: cssVars.spacing.lg }}
          >
            Zurück zum Login
          </Button>
        </div>
      </div>
    );
  }

  // Magic Link Sent State
  if (magicLinkSent) {
    return (
      <div style={styles.backdrop} onClick={handleBackdropClick}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✉</div>
          <h2 style={styles.successTitle}>Magic Link gesendet!</h2>
          <p style={styles.successText}>
            Wir haben einen Login-Link an <strong>{email}</strong> gesendet.
            Klicke auf den Link in der E-Mail, um dich anzumelden.
          </p>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setMagicLinkSent(false)}
            style={{ marginTop: cssVars.spacing.lg }}
          >
            Andere E-Mail verwenden
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (showSuccess) {
    const handleSuccessClose = () => {
      onSuccess?.();
    };

    return (
      <div style={styles.backdrop} onClick={handleSuccessClose}>
        <div style={styles.card} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleSuccessClose}
            style={styles.successCloseButton}
            aria-label="Schließen"
          >
            ✕
          </button>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Angemeldet!</h2>
          <p style={styles.successText}>
            {migratedCount > 0
              ? `${migratedCount} Turnier${migratedCount === 1 ? '' : 'e'} synchronisiert!`
              : 'Du wirst weitergeleitet...'}
          </p>
          <Button
            variant="primary"
            fullWidth
            onClick={handleSuccessClose}
            style={{ marginTop: cssVars.spacing.lg }}
          >
            Weiter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div style={styles.card} role="dialog" aria-modal="true" aria-labelledby="login-title">
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
          <div style={styles.offlineBanner} role="alert" data-testid="offline-banner">
            <span style={styles.offlineIcon}>📡</span>
            <div style={styles.offlineTextContainer}>
              <span style={styles.offlineTitle}>Cloud nicht erreichbar</span>
              <span style={styles.offlineSubtitle}>Nur Gast-Modus verfügbar</span>
            </div>
            <button
              type="button"
              onClick={() => void reconnect()}
              style={styles.offlineRetryButton}
              data-testid="offline-retry-button"
            >
              Erneut
            </button>
          </div>
        )}

        <p style={styles.subtitle}>
          {loginMode === 'password'
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mein-verein.de"
              style={{
                ...styles.input,
                ...(error ? styles.inputError : {}),
              }}
              autoComplete="email"
              autoFocus
              required
              data-testid="login-email-input"
            />
          </div>

          {loginMode === 'password' && (
            <div style={styles.inputGroup}>
              <label htmlFor="password" style={styles.label}>
                Passwort
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  ...styles.input,
                  ...(error ? styles.inputError : {}),
                }}
                autoComplete="current-password"
                required
                minLength={6}
                data-testid="login-password-input"
              />
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                disabled={isLoading}
                style={styles.forgotPasswordLink}
                onFocus={(e) => {
                  Object.assign(e.currentTarget.style, styles.forgotPasswordLinkFocused);
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = 'none';
                }}
              >
                Passwort vergessen?
              </button>
            </div>
          )}

          {error && <span style={styles.errorText} data-testid="login-error-message">{error}</span>}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={isOffline}
            style={styles.button}
            data-testid="login-submit-button"
          >
            {loginMode === 'password' ? 'Anmelden' : 'Magic Link senden'}
          </Button>
        </form>

        {/* Login mode toggle */}
        <button
          type="button"
          onClick={() => setLoginMode(loginMode === 'password' ? 'magic-link' : 'password')}
          style={styles.modeToggle}
          onFocus={(e) => {
            Object.assign(e.currentTarget.style, styles.modeToggleFocused);
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        >
          {loginMode === 'password'
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
          onClick={handleGuestContinue}
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
            onFocus={(e) => {
              Object.assign(e.currentTarget.style, styles.linkFocused);
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
          >
            Registrieren
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
