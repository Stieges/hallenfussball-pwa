/**
 * LoginScreen - E-Mail-Eingabe für Login
 *
 * Phase 1: Lokale Simulation (kein echter Magic Link)
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.1
 */

import React, { useState, CSSProperties } from 'react';
import {
  colors,
  spacing,
  fontSizes,
  fontWeights,
  borderRadius,
} from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

interface LoginScreenProps {
  /** Called when login is successful */
  onSuccess?: () => void;
  /** Called when user clicks "Register" link */
  onNavigateToRegister?: () => void;
  /** Called when user clicks "Continue as guest" */
  onContinueAsGuest?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSuccess,
  onNavigateToRegister,
  onContinueAsGuest,
}) => {
  const { login, continueAsGuest } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate async operation with setTimeout
    setTimeout(() => {
      const result = login(email);

      setIsLoading(false);

      if (result.success) {
        // Show success and callback
        setShowSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 500);
      } else {
        setError(result.error ?? 'Login fehlgeschlagen');
      }
    }, 300);
  };

  const handleGuestContinue = () => {
    continueAsGuest();
    onContinueAsGuest?.();
  };

  // Success state
  if (showSuccess) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Angemeldet!</h2>
          <p style={styles.successText}>Du wirst weitergeleitet...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Anmelden</h1>
        <p style={styles.subtitle}>
          Gib deine E-Mail-Adresse ein, um dich anzumelden.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>
              E-Mail
            </label>
            <input
              id="email"
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
            />
            {error && <span style={styles.errorText}>{error}</span>}
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            style={styles.button}
          >
            Magic Link senden
          </Button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>oder</span>
        </div>

        <Button
          variant="ghost"
          fullWidth
          onClick={handleGuestContinue}
          style={styles.ghostButton}
        >
          Als Gast fortfahren
        </Button>

        <p style={styles.footer}>
          Noch kein Konto?{' '}
          <button
            type="button"
            onClick={onNavigateToRegister}
            style={styles.link}
          >
            Registrieren
          </button>
        </p>
      </div>
    </div>
  );
};

// Styles using design tokens
const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: spacing.lg,
    background: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: spacing.xl,
    background: colors.surface,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border}`,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    margin: 0,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  },
  input: {
    width: '100%',
    height: '48px',
    padding: `0 ${spacing.md}`,
    fontSize: fontSizes.lg, // 16px to prevent iOS zoom
    color: colors.textPrimary,
    background: colors.surfaceSolid,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.md,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: fontSizes.sm,
    color: colors.error,
  },
  button: {
    minHeight: '56px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: `${spacing.lg} 0`,
  },
  dividerText: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    position: 'relative',
  },
  ghostButton: {
    minHeight: '48px',
  },
  footer: {
    marginTop: spacing.lg,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    cursor: 'pointer',
    fontWeight: fontWeights.medium,
    textDecoration: 'none',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto',
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.xxl,
    color: colors.background,
    background: colors.primary,
    borderRadius: borderRadius.full,
  },
  successTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    margin: 0,
    textAlign: 'center',
  },
};

export default LoginScreen;
