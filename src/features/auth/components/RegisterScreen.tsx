/**
 * RegisterScreen - Registrierung mit Name + E-Mail
 *
 * Phase 1: Lokale Simulation
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.2
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
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { isValidName } from '../services/authService';

interface RegisterScreenProps {
  /** Called when registration is successful */
  onSuccess?: () => void;
  /** Called when user clicks "Login" link */
  onNavigateToLogin?: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onSuccess,
  onNavigateToLogin,
}) => {
  const { register } = useAuth();
  const { showMigrationSuccess } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    const nameValidation = isValidName(name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.error;
    }

    if (!email.trim()) {
      newErrors.email = 'E-Mail ist erforderlich';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Bitte gib eine gültige E-Mail-Adresse ein';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Simulate async operation with setTimeout
    setTimeout(() => {
      const result = register(name, email, rememberMe);

      setIsLoading(false);

      if (result.success) {
        // Show migration toast if guest was converted
        if (result.wasMigrated) {
          showMigrationSuccess();
        }

        setShowSuccess(true);
        // Give user time to see success screen and migration toast (if shown)
        setTimeout(() => {
          onSuccess?.();
        }, 2000);
      } else {
        setErrors({ email: result.error });
      }
    }, 300);
  };

  // Success state
  if (showSuccess) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Willkommen!</h2>
          <p style={styles.successText}>Dein Konto wurde erstellt.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Registrieren</h1>
        <p style={styles.subtitle}>
          Erstelle ein Konto, um Turniere zu verwalten und zu synchronisieren.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="name" style={styles.label}>
              Name
            </label>
            <input
              id="name"
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mein-verein.de"
              style={{
                ...styles.input,
                ...(errors.email ? styles.inputError : {}),
              }}
              autoComplete="email"
            />
            {errors.email && <span style={styles.errorText}>{errors.email}</span>}
          </div>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={styles.checkbox}
            />
            <span>Angemeldet bleiben (30 Tage)</span>
          </label>

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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    accentColor: colors.primary,
  },
  button: {
    minHeight: '56px',
    marginTop: spacing.sm,
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
  legal: {
    marginTop: spacing.md,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: '1.5',
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

export default RegisterScreen;
