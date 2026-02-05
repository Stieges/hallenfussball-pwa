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
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { validateEmail } from '../utils/emailValidation';
import { validateRegistrationCode } from '../utils/validateRegistrationCode';
import { registerStyles as styles } from './RegisterScreen.styles';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { AUTH_ERRORS } from '../constants';
import { RegisterEmailConfirmationDialog, RegisterSuccessDialog } from './RegisterDialogs';
import { OfflineBanner } from './OfflineBanner';

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
  const { t } = useTranslation('auth');
  const { register, loginWithGoogle, isGuest, connectionState, reconnect } = useAuth();
  const isOffline = connectionState === 'offline';
  const { showMigrationSuccess } = useToast();

  const {
    formData, errors, touched, setErrors,
    emailSuggestion, setEmailSuggestion,
    setField, applySuggestion, handleBlur,
  } = useRegisterForm();

  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

  // Focus trap for main registration form
  const formTrap = useFocusTrap({
    isActive: !showEmailConfirmation && !showSuccess,
    onEscape: onBack,
  });

  const validateForm = async (): Promise<boolean> => {
    const newErrors: typeof errors = {};

    // Name validation
    const trimmedName = formData.name.trim();
    if (trimmedName.length < 2) {
      newErrors.name = AUTH_ERRORS.NAME_TOO_SHORT;
    } else if (trimmedName.length > 100) {
      newErrors.name = AUTH_ERRORS.NAME_TOO_LONG;
    }

    // Enhanced email validation
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error;
      if (emailValidation.suggestion) {
        setEmailSuggestion(emailValidation.suggestion);
      } else {
        setEmailSuggestion(null);
      }
    } else {
      setEmailSuggestion(null);
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = AUTH_ERRORS.PASSWORD_REQUIRED;
    } else if (formData.password.length < 6) {
      newErrors.password = AUTH_ERRORS.PASSWORD_TOO_SHORT;
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = AUTH_ERRORS.PASSWORD_MISMATCH;
    }

    // Server-side registration code validation
    // This prevents exposure of the code in the client bundle
    if (formData.registrationCode.trim()) {
      const codeValidation = await validateRegistrationCode(formData.registrationCode.trim());
      if (!codeValidation.valid) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty error string should also trigger fallback
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
      const result = await register(formData.name, formData.email, formData.password);

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
          const delay = (result.migratedCount && result.migratedCount > 0) ? 2500 : 1500;
          setTimeout(() => {
            onSuccess?.();
          }, delay);
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
    return (
      <RegisterEmailConfirmationDialog
        email={formData.email}
        migratedCount={migratedCount}
        onClose={() => onNavigateToLogin?.()}
      />
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <RegisterSuccessDialog
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
        aria-labelledby="register-title"
      >
        {/* Header with back and close buttons */}
        <div style={styles.header}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={styles.backButton}
              aria-label={t('login.back')}
            >
              {t('login.backWithArrow')}
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={styles.closeButton}
              aria-label={t('login.close')}
            >
              ✕
            </button>
          )}
        </div>

        <h1 id="register-title" style={styles.title}>
          {isGuest ? t('register.titleGuest') : t('register.title')}
        </h1>

        {/* Offline Banner */}
        {isOffline && (
          <OfflineBanner
            subtitle={t('register.offlineSubtitle')}
            onRetry={() => void reconnect()}
          />
        )}

        <p style={styles.subtitle}>
          {isGuest
            ? t('register.subtitleGuest')
            : t('register.subtitle')}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="name" style={styles.label}>
              {t('register.name')}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder={t('register.namePlaceholder')}
              style={{
                ...styles.input,
                ...(touched.name && errors.name ? styles.inputError : {}),
              }}
              autoComplete="name"
              autoFocus
              data-testid="register-name-input"
            />
            {touched.name && errors.name && <span style={styles.errorText}>{errors.name}</span>}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>
              {t('register.email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setField('email', e.target.value);
                setEmailSuggestion(null);
              }}
              onBlur={() => handleBlur('email')}
              placeholder={t('register.emailPlaceholder')}
              style={{
                ...styles.input,
                ...(touched.email && errors.email ? styles.inputError : {}),
              }}
              autoComplete="email"
              data-testid="register-email-input"
            />
            {touched.email && errors.email && <span style={styles.errorText} data-testid="register-email-error">{errors.email}</span>}
            {emailSuggestion && (
              <button
                type="button"
                onClick={() => applySuggestion()}
                style={styles.suggestionButton}
              >
                {'✓ '}{t('register.useSuggestion', { suggestion: emailSuggestion })}
              </button>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>
              {t('register.password')}
            </label>
            <PasswordInput
              id="password"
              name="password"
              value={formData.password}
              onChange={(e) => {
                const newPassword = e.target.value;
                setField('password', newPassword);
                // Auto-sync to confirmation if it was filled by password manager
                // (detected by large change in value length, e.g. paste/autofill)
                if (newPassword.length > 6 && formData.confirmPassword === '') {
                  setField('confirmPassword', newPassword);
                }
              }}
              onBlur={() => handleBlur('password')}
              placeholder={t('register.passwordPlaceholder')}
              style={{
                ...styles.input,
                ...(touched.password && errors.password ? styles.inputError : {}),
              }}
              autoComplete="new-password"
              minLength={6}
              data-testid="register-password-input"
            />
            {touched.password && errors.password && <span style={styles.errorText}>{errors.password}</span>}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="confirmPassword" style={styles.label}>
              {t('register.confirmPassword')}
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setField('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              placeholder={t('register.confirmPasswordPlaceholder')}
              style={{
                ...styles.input,
                ...(touched.confirmPassword && errors.confirmPassword ? styles.inputError : {}),
              }}
              autoComplete="new-password"
              data-testid="register-confirm-password-input"
            />
            {touched.confirmPassword && errors.confirmPassword && (
              <span style={styles.errorText}>{errors.confirmPassword}</span>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="registrationCode" style={styles.label}>
              {t('register.registrationCode')}
            </label>
            <input
              id="registrationCode"
              name="registrationCode"
              type="text"
              value={formData.registrationCode}
              onChange={(e) => setField('registrationCode', e.target.value)}
              onBlur={() => handleBlur('registrationCode')}
              placeholder={t('register.registrationCodePlaceholder')}
              style={{
                ...styles.input,
                ...(touched.registrationCode && errors.registrationCode ? styles.inputError : {}),
              }}
              autoComplete="off"
              data-testid="register-code-input"
            />
            {touched.registrationCode && errors.registrationCode && (
              <span style={styles.errorText}>{errors.registrationCode}</span>
            )}
            <span style={styles.hint}>
              {t('register.registrationCodeHint')}
            </span>
          </div>

          {errors.general && (
            <div style={styles.generalError} data-testid="register-error-message">{errors.general}</div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            style={styles.button}
            data-testid="register-submit-button"
          >
            {t('register.submit')}
          </Button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>{t('register.or')}</span>
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
          {t('register.googleRegister')}
        </Button>

        <p style={styles.footer}>
          {t('register.alreadyRegistered')}{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            style={styles.link}
            data-testid="register-login-link"
          >
            {t('register.login')}
          </button>
        </p>

        <p style={styles.legal}>
          {t('register.legal')}
        </p>
      </div>
    </div>
  );
};

export default RegisterScreen;
