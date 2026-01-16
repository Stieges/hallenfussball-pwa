/**
 * SetPasswordScreen - Neues Passwort setzen nach Recovery
 *
 * Wird nach Klick auf Password-Reset-Link angezeigt.
 * Ermöglicht dem User ein neues Passwort zu setzen.
 */

import React, { useState, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

export const SetPasswordScreen: React.FC = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Note: User is already authenticated when reaching this screen
  // AuthCallback sets session before redirecting here

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await updatePassword(password);

      if (result.success) {
        setShowSuccess(true);
      } else {
        setError(result.error ?? 'Passwort konnte nicht geändert werden.');
      }
    } catch (err) {
      console.error('Update password error:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    void navigate('/');
  };

  // Success state
  if (showSuccess) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Passwort geändert!</h2>
          <p style={styles.successText}>
            Dein neues Passwort wurde erfolgreich gespeichert.
          </p>
          <Button
            variant="primary"
            fullWidth
            onClick={handleContinue}
            style={{ marginTop: cssVars.spacing.lg }}
          >
            Weiter zur App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.card} role="dialog" aria-modal="true" aria-labelledby="set-password-title">
        <h1 id="set-password-title" style={styles.title}>Neues Passwort setzen</h1>
        <p style={styles.subtitle}>
          Gib dein neues Passwort ein.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>
              Neues Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
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
              Passwort bestätigen
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
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
            loading={isLoading}
            style={styles.button}
          >
            Passwort speichern
          </Button>
        </form>

        <Button
          variant="ghost"
          fullWidth
          onClick={handleContinue}
          disabled={isLoading}
          style={styles.ghostButton}
        >
          Überspringen
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
};

export default SetPasswordScreen;
