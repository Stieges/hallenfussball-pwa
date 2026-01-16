/**
 * AuthConfirmPage - Intermediate Confirmation für Email-Links
 *
 * Diese Seite verhindert, dass Email-Scanner (Outlook/O365) Magic Links
 * automatisch konsumieren. Der Token wird erst bei Button-Klick verarbeitet.
 *
 * Route: /auth/confirm?token=xxx&type=signup|recovery|magiclink|invite
 *
 * @see docs/concepts/SUPABASE-BEST-PRACTICES.md
 */

import React, { useState, CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';

type ConfirmType = 'signup' | 'recovery' | 'magiclink' | 'invite';

export const AuthConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse URL parameters
  const token = searchParams.get('token') ?? searchParams.get('token_hash');
  const type = searchParams.get('type') as ConfirmType | null;
  const redirectTo = searchParams.get('redirect_to') ?? '/';

  // Get type-specific UI text
  const getTypeInfo = () => {
    switch (type) {
      case 'signup':
        return {
          title: 'Email bestätigen',
          description: 'Klicke auf den Button um deine E-Mail-Adresse zu bestätigen.',
          buttonText: 'E-Mail bestätigen',
        };
      case 'recovery':
        return {
          title: 'Passwort zurücksetzen',
          description: 'Klicke auf den Button um dein neues Passwort zu setzen.',
          buttonText: 'Weiter zum Passwort setzen',
        };
      case 'magiclink':
        return {
          title: 'Anmeldung bestätigen',
          description: 'Klicke auf den Button um dich anzumelden.',
          buttonText: 'Anmelden',
        };
      case 'invite':
        return {
          title: 'Einladung annehmen',
          description: 'Klicke auf den Button um die Einladung anzunehmen.',
          buttonText: 'Einladung annehmen',
        };
      default:
        return {
          title: 'Bestätigung',
          description: 'Klicke auf den Button um fortzufahren.',
          buttonText: 'Fortfahren',
        };
    }
  };

  const typeInfo = getTypeInfo();

  /**
   * Handles the confirmation button click
   * Only processes the token when user explicitly clicks
   */
  const handleConfirm = async () => {
    if (!token || !type) {
      setError('Ungültiger Link. Bitte fordere einen neuen Link an.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Cloud-Funktionen sind nicht verfügbar.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      switch (type) {
        case 'signup': {
          // Email Confirmation
          const { error: signupError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'email',
          });
          if (signupError) {
            throw signupError;
          }
          void navigate(redirectTo, { replace: true });
          break;
        }

        case 'recovery': {
          // Password Reset - verify token then redirect to set-password
          const { error: recoveryError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery',
          });
          if (recoveryError) {
            throw recoveryError;
          }
          void navigate('/set-password', { replace: true });
          break;
        }

        case 'magiclink': {
          // Magic Link Login
          const { error: magicError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink',
          });
          if (magicError) {
            throw magicError;
          }
          void navigate(redirectTo, { replace: true });
          break;
        }

        case 'invite': {
          // Tournament Invite - redirect to invite page with token
          void navigate(`/invite?token=${encodeURIComponent(token)}`, { replace: true });
          break;
        }

        default: {
          setError('Unbekannter Link-Typ.');
        }
      }
    } catch (err) {
      console.error('Confirm error:', err);

      // User-friendly error messages
      if (err instanceof Error) {
        if (err.message.includes('expired')) {
          setError('Dieser Link ist abgelaufen. Bitte fordere einen neuen Link an.');
        } else if (err.message.includes('used') || err.message.includes('invalid')) {
          setError('Dieser Link wurde bereits verwendet oder ist ungültig.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Ein unerwarteter Fehler ist aufgetreten.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackToLogin = () => {
    void navigate('/login', { replace: true });
  };

  // Error state
  if (error) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h1 style={styles.errorTitle}>Fehler</h1>
          <p style={styles.errorText}>{error}</p>
          <Button
            variant="primary"
            fullWidth
            onClick={handleBackToLogin}
            style={styles.button}
          >
            Zurück zum Login
          </Button>
        </div>
      </div>
    );
  }

  // Invalid link (no token or type)
  if (!token || !type) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>?</div>
          <h1 style={styles.errorTitle}>Ungültiger Link</h1>
          <p style={styles.errorText}>
            Der Link ist ungültig oder unvollständig.
            Bitte verwende den vollständigen Link aus deiner E-Mail.
          </p>
          <Button
            variant="primary"
            fullWidth
            onClick={handleBackToLogin}
            style={styles.button}
          >
            Zurück zum Login
          </Button>
        </div>
      </div>
    );
  }

  // Main confirmation UI
  return (
    <div style={styles.backdrop}>
      <div style={styles.card} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div style={styles.iconWrapper}>
          <div style={styles.icon}>✉️</div>
        </div>

        <h1 id="confirm-title" style={styles.title}>
          {typeInfo.title}
        </h1>

        <p style={styles.description}>
          {typeInfo.description}
        </p>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => void handleConfirm()}
          loading={isProcessing}
          style={styles.confirmButton}
          data-testid="confirm-button"
        >
          {typeInfo.buttonText}
        </Button>

        <p style={styles.hint}>
          Falls du diesen Link nicht angefordert hast, kannst du diese Seite einfach schließen.
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
    background: cssVars.colors.background,
    zIndex: 1000,
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: '400px',
    padding: cssVars.spacing.xl,
    background: cssVars.colors.surfaceSolid,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px solid ${cssVars.colors.border}`,
    boxShadow: `0 8px 32px ${cssVars.colors.shadowModal}`,
    textAlign: 'center',
  },
  iconWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: cssVars.spacing.lg,
  },
  icon: {
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.scoreSizes.sm, // 40px - fixed size for emoji display
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.full,
  },
  title: {
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  },
  description: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.xl,
    lineHeight: '1.5',
  },
  confirmButton: {
    minHeight: '56px',
  },
  hint: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textTertiary,
    margin: 0,
    marginTop: cssVars.spacing.lg,
    lineHeight: '1.4',
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto',
    marginBottom: cssVars.spacing.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.background,
    background: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.full,
  },
  errorTitle: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  },
  errorText: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
    lineHeight: '1.5',
  },
  button: {
    minHeight: '48px',
  },
};

export default AuthConfirmPage;
