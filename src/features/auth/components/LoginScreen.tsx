/**
 * LoginScreen - E-Mail-Eingabe für Login
 *
 * Phase 1: Lokale Simulation (kein echter Magic Link)
 *
 * Features:
 * - Semi-transparenter Backdrop für Kontext
 * - Zurück-Button und X-Button
 * - ESC-Taste zum Schließen
 * - Als Gast fortfahren Option
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 4.1
 */

import React, { useState, useEffect, CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

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
  const { login, continueAsGuest } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
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
          <h2 style={styles.successTitle}>Angemeldet!</h2>
          <p style={styles.successText}>Du wirst weitergeleitet...</p>
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
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>oder</span>
          <span style={styles.dividerLine} />
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
    minHeight: '44px', // Touch target minimum
    gap: cssVars.spacing.sm,
    flexWrap: 'nowrap' as const,
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
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    minHeight: '44px', // Touch target
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
  button: {
    minHeight: '56px',
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
  ghostButton: {
    minHeight: '48px',
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

export default LoginScreen;
