/**
 * RegisterScreen - Registrierung mit Name + E-Mail
 *
 * Phase 1: Lokale Simulation
 *
 * Features:
 * - Semi-transparenter Backdrop für Kontext
 * - Zurück-Button und X-Button
 * - ESC-Taste zum Schließen
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.2
 */

import React, { useState, useEffect, CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { isValidName } from '../services/authService';

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
  const { register } = useAuth();
  const { showMigrationSuccess } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on backdrop, not on card
    if (e.target === e.currentTarget && onBack) {
      onBack();
    }
  };

  // Success state
  if (showSuccess) {
    return (
      <div style={styles.backdrop} onClick={handleBackdropClick}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Willkommen!</h2>
          <p style={styles.successText}>Dein Konto wurde erstellt.</p>
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

        <h1 id="register-title" style={styles.title}>Registrieren</h1>
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
    background: 'rgba(10, 22, 40, 0.85)', // Semi-transparent to show context
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
    fontSize: cssVars.fontSizes.lg, // 16px to prevent iOS zoom
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    outline: 'none',
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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    accentColor: cssVars.colors.primary,
  },
  button: {
    minHeight: '56px',
    marginTop: cssVars.spacing.sm,
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
  },
};

export default RegisterScreen;
