/**
 * AuthCallback - Handles OAuth and Magic Link redirects
 *
 * This component processes the authentication callback from Supabase
 * after a user clicks a magic link or completes OAuth login.
 *
 * Route: /auth/callback
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { cssVars } from '../../../design-tokens';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Auth callback only works with Supabase configured
      if (!isSupabaseConfigured || !supabase) {
        void navigate('/', { replace: true });
        return;
      }

      try {
        // Get the hash fragment from the URL (Supabase puts tokens there)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorDescription = hashParams.get('error_description');

        if (errorDescription) {
          setError(decodeURIComponent(errorDescription));
          return;
        }

        if (accessToken && refreshToken) {
          // Set the session manually
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError(sessionError.message);
            return;
          }
        }

        // Check if we have a valid session
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession();

        if (getSessionError) {
          setError(getSessionError.message);
          return;
        }

        if (session) {
          // Successfully authenticated, redirect to home
          void navigate('/', { replace: true });
        } else {
          // No session, might be a confirmation email link
          // Check for email confirmation
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );

          if (exchangeError) {
            // Not a code exchange flow, just redirect to login
            void navigate('/login', { replace: true });
            return;
          }

          // Successfully exchanged code, redirect to home
          void navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Ein unerwarteter Fehler ist aufgetreten.');
      }
    };

    void handleAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.title}>Authentifizierung fehlgeschlagen</h2>
          <p style={styles.text}>{error}</p>
          <button
            onClick={() => void navigate('/login', { replace: true })}
            style={styles.button}
          >
            Zum Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <h2 style={styles.title}>Anmeldung wird verarbeitet...</h2>
        <p style={styles.text}>Bitte warte einen Moment.</p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: cssVars.colors.background,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: cssVars.spacing.xl,
    maxWidth: '400px',
    textAlign: 'center',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: `4px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: cssVars.spacing.lg,
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.background,
    background: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.full,
    marginBottom: cssVars.spacing.lg,
  },
  title: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  },
  text: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
  },
  button: {
    padding: `${cssVars.spacing.md} ${cssVars.spacing.xl}`,
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
  },
};

export default AuthCallback;
