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

import React, { useState, useEffect, CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

/** Common valid TLDs */
const VALID_TLDS = new Set([
  // Generic
  'com', 'net', 'org', 'edu', 'gov', 'info', 'biz', 'io', 'co', 'app', 'dev',
  // European
  'de', 'at', 'ch', 'nl', 'be', 'fr', 'uk', 'es', 'it', 'pt', 'pl', 'cz', 'eu',
  // Other major
  'us', 'ca', 'au', 'nz', 'jp', 'kr', 'cn', 'in', 'br', 'mx', 'ru',
]);

/** Common disposable email domains to block */
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'trashmail.com', 'fakeinbox.com', 'temp-mail.org',
  'disposablemail.com', 'yopmail.com', 'tempail.com', 'mohmal.com',
  'getnada.com', 'mailnesia.com', 'emailondeck.com', 'dispostable.com',
]);

/** Common email provider typos */
const EMAIL_TYPO_SUGGESTIONS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.de': 'gmail.com', // Gmail doesn't have .de
  'gmx.com': 'gmx.de', // GMX is mostly .de
  'outook.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'web.com': 'web.de',
};

interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Enhanced email validation
 * Checks format, TLD validity, disposable domains, and common typos
 */
function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();

  // Basic format check
  if (!trimmed) {
    return { isValid: false, error: 'E-Mail ist erforderlich' };
  }

  // More comprehensive regex: local@domain.tld
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein' };
  }

  // Extract domain parts
  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Ungültiges E-Mail-Format' };
  }

  const [localPart, domain] = parts;

  // Local part checks
  if (localPart.length < 1) {
    return { isValid: false, error: 'E-Mail-Adresse vor @ ist zu kurz' };
  }
  if (localPart.length > 64) {
    return { isValid: false, error: 'E-Mail-Adresse vor @ ist zu lang' };
  }

  // Domain checks
  if (domain.length < 4) {
    return { isValid: false, error: 'Domain ist zu kurz' };
  }
  if (domain.length > 255) {
    return { isValid: false, error: 'Domain ist zu lang' };
  }

  // Check for typos in common providers
  const suggestion = EMAIL_TYPO_SUGGESTIONS[domain];
  if (suggestion) {
    return {
      isValid: false,
      error: `Meintest du ${localPart}@${suggestion}?`,
      suggestion: `${localPart}@${suggestion}`,
    };
  }

  // Check for disposable email domains
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Wegwerf-E-Mail-Adressen sind nicht erlaubt',
    };
  }

  // Extract and validate TLD
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (tld.length < 2) {
    return { isValid: false, error: 'Ungültige Domain-Endung' };
  }

  // Check if TLD is in our known list (warning, not blocking)
  // We don't block unknown TLDs as new ones are created regularly
  if (!VALID_TLDS.has(tld) && tld.length > 6) {
    // Very long unknown TLDs are suspicious
    return {
      isValid: false,
      error: 'Bitte überprüfe die Domain-Endung',
    };
  }

  return { isValid: true };
}

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
  const { register, loginWithGoogle, isGuest } = useAuth();
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
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

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

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Name validation
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      newErrors.name = 'Name muss mindestens 2 Zeichen haben.';
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Name darf maximal 100 Zeichen haben.';
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
      newErrors.password = 'Passwort ist erforderlich';
    } else if (password.length < 6) {
      newErrors.password = 'Passwort muss mindestens 6 Zeichen haben';
    }

    // Confirm password validation
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwörter stimmen nicht überein';
    }

    // Registration code validation (case-insensitive)
    const expectedCode = import.meta.env.VITE_REGISTRATION_CODE as string | undefined;
    const providedCode = registrationCode.trim().toLowerCase();
    const expectedCodeNormalized = expectedCode?.trim().toLowerCase();

    if (expectedCodeNormalized && providedCode !== expectedCodeNormalized) {
      newErrors.registrationCode = 'Ungültiger Einladungscode';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await register(name, email, password);

      if (result.success) {
        // Show migration toast if guest was converted
        if (result.wasMigrated) {
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
      console.error('Register error:', err);
      setErrors({ general: 'Ein unerwarteter Fehler ist aufgetreten.' });
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
        setErrors({ general: result.error ?? 'Google Login fehlgeschlagen' });
        setIsLoading(false);
      }
      // On success, the page will redirect
    } catch (err) {
      console.error('Google login error:', err);
      setErrors({ general: 'Ein unerwarteter Fehler ist aufgetreten' });
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
        <div style={styles.card} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleEmailConfirmClose}
            style={styles.successCloseButton}
            aria-label="Schließen"
          >
            ✕
          </button>
          <div style={styles.successIcon}>✉</div>
          <h2 style={styles.successTitle}>Bestätige deine E-Mail</h2>
          <p style={styles.successText}>
            Wir haben eine Bestätigungs-E-Mail an <strong>{email}</strong> gesendet.
            Bitte klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
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
          <h2 style={styles.successTitle}>Willkommen!</h2>
          <p style={styles.successText}>Dein Konto wurde erstellt.</p>
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
      <div style={styles.card} role="dialog" aria-modal="true" aria-labelledby="register-title">
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
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.md,
    minHeight: '32px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    cursor: 'pointer',
    transition: 'color 0.2s, background 0.2s',
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    marginLeft: 'auto',
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.lg,
    cursor: 'pointer',
    transition: 'color 0.2s, background 0.2s',
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
  hint: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textMuted,
    marginTop: cssVars.spacing.xs,
  },
  suggestionButton: {
    marginTop: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.primary,
    background: cssVars.colors.primarySubtle,
    border: `1px solid ${cssVars.colors.primary}`,
    borderRadius: cssVars.borderRadius.sm,
    cursor: 'pointer',
    fontWeight: cssVars.fontWeights.medium,
  },
  generalError: {
    padding: cssVars.spacing.md,
    background: 'rgba(239, 68, 68, 0.1)',
    border: `1px solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.error,
    fontSize: cssVars.fontSizes.sm,
    textAlign: 'center',
  },
  button: {
    minHeight: '56px',
    marginTop: cssVars.spacing.sm,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    margin: `${cssVars.spacing.lg} 0`,
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: cssVars.colors.border,
  },
  dividerText: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  googleButton: {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
  },
  googleIcon: {
    fontWeight: cssVars.fontWeights.bold,
    fontSize: cssVars.fontSizes.lg,
    color: cssVars.colors.primary,
  },
  footer: {
    marginTop: cssVars.spacing.lg,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
  },
  link: {
    color: cssVars.colors.primary,
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    cursor: 'pointer',
    fontWeight: cssVars.fontWeights.medium,
    textDecoration: 'none',
  },
  legal: {
    marginTop: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textMuted,
    textAlign: 'center',
    lineHeight: '1.5',
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
  successCloseButton: {
    position: 'absolute',
    top: cssVars.spacing.md,
    right: cssVars.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.lg,
    cursor: 'pointer',
    transition: 'color 0.2s, background 0.2s',
  },
};

export default RegisterScreen;
