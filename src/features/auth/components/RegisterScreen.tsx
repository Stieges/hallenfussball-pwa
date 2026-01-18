/**
 * RegisterScreen - Registrierung mit Name, E-Mail und Passwort
 *
 * Phase 2: Supabase Auth Integration
 *
 * Features:
 * - Name, E-Mail und Passwort Registrierung
 * - Passwort-Bestätigung
 * - Google OAuth Option
 * - Gast-zu-User Migration
 * - Semi-transparenter Backdrop
 * - ESC-Taste zum Schließen
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

import React, { useState } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { validateEmail } from '../utils/emailValidation';
import { validateRegistrationCode } from '../utils/validateRegistrationCode';
import { registerStyles as styles } from './RegisterScreen.styles';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { AUTH_ERRORS } from '../constants';

interface RegisterScreenProps {
  /** Called when registration is successful */
  onSuccess?: () => void;
  /** Called when user clicks "Login" link */
  onNavigateToLogin?: () => void;
  /** Called when user wants to go back/close */
  onBack?: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onSuccess,
  onNavigateToLogin,
  onBack,
}) => {
  const { register, loginWithGoogle, isGuest, connectionState, reconnect } = useAuth();
  const isOffline = connectionState === 'offline';
  const { showMigrationSuccess } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    registrationCode?: string;
    general?: string;
  }>({});
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

  // Focus trap for email confirmation dialog
  const emailConfirmTrap = useFocusTrap({
    isActive: showEmailConfirmation,
    onEscape: onNavigateToLogin,
  });

  // Focus trap for success dialog
  const successTrap = useFocusTrap({
    isActive: showSuccess,
    onEscape: onSuccess,
  });

  // Focus trap for main registration form
  const formTrap = useFocusTrap({
    isActive: !showEmailConfirmation && !showSuccess,
    onEscape: onBack,
  });

  const validateForm = async (): Promise<boolean> => {
    const newErrors: typeof errors = {};

    // Name validation
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      newErrors.name = AUTH_ERRORS.NAME_TOO_SHORT;
    } else if (trimmedName.length > 100) {
      newErrors.name = AUTH_ERRORS.NAME_TOO_LONG;
    }

    // Enhanced email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error;
      // Store suggestion for typo correction
      if (emailValidation.suggestion) {
        setEmailSuggestion(emailValidation.suggestion);
      } else {
        setEmailSuggestion(null);
      }
    } else {
      setEmailSuggestion(null);
    }

    // Password validation
    if (!password) {
      newErrors.password = AUTH_ERRORS.PASSWORD_REQUIRED;
    } else if (password.length < 6) {
      newErrors.password = AUTH_ERRORS.PASSWORD_TOO_SHORT;
    }

    // Confirm password validation
    if (password !== confirmPassword) {
      newErrors.confirmPassword = AUTH_ERRORS.PASSWORD_MISMATCH;
    }

    // Server-side registration code validation
    // This prevents exposure of the code in the client bundle
    if (registrationCode.trim()) {
      const codeValidation = await validateRegistrationCode(registrationCode.trim());
      if (!codeValidation.valid) {
        newErrors.registrationCode = codeValidation.error || AUTH_ERRORS.REGISTRATION_CODE_INVALID;
      }
    } else {
      // Registration code is required
      newErrors.registrationCode = AUTH_ERRORS.REGISTRATION_CODE_REQUIRED;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(await validateForm())) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await register(name, email, password);

      if (result.success) {
        // Store migration count for feedback
        if (result.migratedCount && result.migratedCount > 0) {
          setMigratedCount(result.migratedCount);
          showMigrationSuccess();
        }

        // Check if email confirmation is required
        // Supabase may require email verification
        if (!result.session) {
          setShowEmailConfirmation(true);
        } else {
          setShowSuccess(true);
          setTimeout(() => {
            onSuccess?.();
          }, 2000);
        }
      } else {
        setErrors({ general: result.error });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Register error:', err);
      }
      setErrors({ general: AUTH_ERRORS.UNEXPECTED });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrors({});
    setIsLoading(true);

    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setErrors({ general: result.error ?? AUTH_ERRORS.GOOGLE_LOGIN_FAILED });
        setIsLoading(false);
      }
      // On success, the page will redirect
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Google login error:', err);
      }
      setErrors({ general: AUTH_ERRORS.UNEXPECTED });
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onBack) {
      onBack();
    }
  };

  // Email confirmation state
  if (showEmailConfirmation) {
    const handleEmailConfirmClose = () => {
      onNavigateToLogin?.();
    };

    return (
      <div style={styles.backdrop} onClick={handleEmailConfirmClose}>
        <div
          ref={emailConfirmTrap.containerRef}
          style={styles.card}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-confirm-title"
        >
          <button
            type="button"
            onClick={handleEmailConfirmClose}
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
            onClick={handleEmailConfirmClose}
            style={{ marginTop: cssVars.spacing.lg }}
          >
            Zum Login
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
        <div
          ref={successTrap.containerRef}
          style={styles.card}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
        >
          <button
            type="button"
            onClick={handleSuccessClose}
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
      <div
        ref={formTrap.containerRef}
        style={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
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

        <h1 id="register-title" style={styles.title}>
          {isGuest ? 'Konto erstellen' : 'Registrieren'}
        </h1>

        {/* Offline Banner */}
        {isOffline && (
          <div style={styles.offlineBanner} role="alert">
            <span style={styles.offlineIcon}>📡</span>
            <div style={styles.offlineTextContainer}>
              <span style={styles.offlineTitle}>Cloud nicht erreichbar</span>
              <span style={styles.offlineSubtitle}>Registrierung nicht möglich</span>
            </div>
            <button
              type="button"
              onClick={() => void reconnect()}
              style={styles.offlineRetryButton}
            >
              Erneut
            </button>
          </div>
        )}

        <p style={styles.subtitle}>
          {isGuest
            ? 'Erstelle ein Konto, um deine Turniere zu synchronisieren.'
            : 'Erstelle ein Konto, um Turniere zu verwalten.'}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="name" style={styles.label}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vor- und Nachname"
              style={{
                ...styles.input,
                ...(errors.name ? styles.inputError : {}),
              }}
              autoComplete="name"
              autoFocus
            />
            {errors.name && <span style={styles.errorText}>{errors.name}</span>}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Clear suggestion when user types
                setEmailSuggestion(null);
              }}
              placeholder="name@mein-verein.de"
              style={{
                ...styles.input,
                ...(errors.email ? styles.inputError : {}),
              }}
              autoComplete="email"
            />
            {errors.email && <span style={styles.errorText}>{errors.email}</span>}
            {emailSuggestion && (
              <button
                type="button"
                onClick={() => {
                  setEmail(emailSuggestion);
                  setEmailSuggestion(null);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                style={styles.suggestionButton}
              >
                ✓ {emailSuggestion} verwenden
              </button>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => {
                const newPassword = e.target.value;
                setPassword(newPassword);
                // Auto-sync to confirmation if it was filled by password manager
                // (detected by large change in value length, e.g. paste/autofill)
                if (newPassword.length > 6 && confirmPassword === '') {
                  setConfirmPassword(newPassword);
                }
              }}
              placeholder="Mindestens 6 Zeichen"
              style={{
                ...styles.input,
                ...(errors.password ? styles.inputError : {}),
              }}
              autoComplete="new-password"
              minLength={6}
            />
            {errors.password && <span style={styles.errorText}>{errors.password}</span>}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="confirmPassword" style={styles.label}>
              Passwort bestätigen
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              style={{
                ...styles.input,
                ...(errors.confirmPassword ? styles.inputError : {}),
              }}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <span style={styles.errorText}>{errors.confirmPassword}</span>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="registrationCode" style={styles.label}>
              Einladungscode
            </label>
            <input
              id="registrationCode"
              name="registrationCode"
              type="text"
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              placeholder="Code vom Veranstalter"
              style={{
                ...styles.input,
                ...(errors.registrationCode ? styles.inputError : {}),
              }}
              autoComplete="off"
            />
            {errors.registrationCode && (
              <span style={styles.errorText}>{errors.registrationCode}</span>
            )}
            <span style={styles.hint}>
              Den Code bekommst du vom Turnierveranstalter.
            </span>
          </div>

          {errors.general && (
            <div style={styles.generalError}>{errors.general}</div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            style={styles.button}
          >
            Konto erstellen
          </Button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>oder</span>
          <span style={styles.dividerLine} />
        </div>

        {/* Google Signup */}
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void handleGoogleLogin()}
          disabled={isLoading}
          style={styles.googleButton}
        >
          <span style={styles.googleIcon}>G</span>
          Mit Google registrieren
        </Button>

        <p style={styles.footer}>
          Bereits registriert?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            style={styles.link}
            onFocus={(e) => {
              Object.assign(e.currentTarget.style, styles.linkFocused);
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
          >
            Anmelden
          </button>
        </p>

        <p style={styles.legal}>
          Mit der Registrierung stimmst du unseren Nutzungsbedingungen und der
          Datenschutzerklärung zu.
        </p>
      </div>
    </div>
  );
};

export default RegisterScreen;
