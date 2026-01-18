/**
 * AuthCallback - Handles OAuth and Magic Link redirects
 *
 * This component processes the authentication callback from Supabase
 * after a user clicks a magic link or completes OAuth login.
 *
 * Route: /auth/callback
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { cssVars } from '../../../design-tokens';
import { AUTH_ERRORS } from '../constants';
import {
  parseAllAuthParams,
  handleExistingSession,
  handleCodeExchange,
  handleImplicitFlow,
} from '../utils/authCallbackHelpers';
import { authCallbackStyles as styles } from './AuthCallback.styles';

// ============================================================================
// Component
// ============================================================================

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    // Timeout to prevent infinite loading (15 seconds)
    const timeoutId = setTimeout(() => {
      setIsTimedOut(true);
    }, 15000);

    const handleAuthCallback = async (retryCount = 0) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[AuthCallback] Starting, retry:', retryCount, 'URL:', { hash: window.location.hash, search: window.location.search });
      }

      // Auth callback only works with Supabase configured
      if (!isSupabaseConfigured || !supabase) {
        void navigate('/', { replace: true });
        return;
      }

      try {
        // Parse all auth params from URL (HashRouter, fragment, query)
        const params = parseAllAuthParams(location.search);

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[AuthCallback] Parsed params:', {
            code: !!params.code,
            accessToken: !!params.accessToken,
            type: params.type,
            errorDescription: params.errorDescription,
          });
        }

        // Handle URL error
        if (params.errorDescription) {
          setError(decodeURIComponent(params.errorDescription));
          return;
        }

        // Check for existing session FIRST (Supabase may have already processed tokens)
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[AuthCallback] Checking for existing session...');
        }
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[AuthCallback] Existing session:', !!existingSession);
        }

        if (existingSession) {
          const result = handleExistingSession(params.type);
          if (result.redirectTo) {
            void navigate(result.redirectTo, { replace: true });
          }
          return;
        }

        // Handle PKCE flow (code in query params)
        if (params.code) {
          const result = await handleCodeExchange(params.code, params.type);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (result.redirectTo) {
            void navigate(result.redirectTo, { replace: true });
          }
          return;
        }

        // Handle Implicit flow (access_token + refresh_token in fragment)
        if (params.accessToken && params.refreshToken) {
          const result = await handleImplicitFlow(params.accessToken, params.refreshToken, params.type);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (result.redirectTo) {
            void navigate(result.redirectTo, { replace: true });
          }
          return;
        }

        // No code, no tokens, no session - redirect to login
        if (import.meta.env.DEV) {
          console.warn('AuthCallback: No auth data found in URL', { hash: window.location.hash, search: window.location.search });
        }
        void navigate('/login', { replace: true });
      } catch (err) {
        // AbortError is expected in React StrictMode (double mount/unmount)
        // Retry after a short delay to let StrictMode settle
        if (err instanceof Error && err.name === 'AbortError') {
          if (retryCount < 2) {
            await new Promise(resolve => setTimeout(resolve, 150));
            return handleAuthCallback(retryCount + 1);
          }
          // After retries, redirect to home - auth might have succeeded
          void navigate('/', { replace: true });
          return;
        }

        if (import.meta.env.DEV) {
          console.error('Auth callback error:', err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('Error details:', errorMessage);
        }
        setError(AUTH_ERRORS.UNEXPECTED);
      }
    };

    void handleAuthCallback();

    return () => clearTimeout(timeoutId);
  }, [navigate, location.search]);

  // Auto-redirect on error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        void navigate('/login', { replace: true });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, navigate]);

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.title}>Authentifizierung fehlgeschlagen</h2>
          <p style={styles.text}>{error}</p>
          <p style={{ ...styles.text, fontSize: cssVars.fontSizes.sm }}>
            Du wirst in 5 Sekunden zum Login weitergeleitet...
          </p>
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

  // Timeout state - authentication is taking too long
  if (isTimedOut) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.title}>Anmeldung dauert zu lange</h2>
          <p style={styles.text}>
            Die Authentifizierung konnte nicht abgeschlossen werden.
            Bitte versuche es erneut.
          </p>
          <button
            onClick={() => void navigate('/login', { replace: true })}
            style={styles.button}
          >
            Zurück zum Login
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

export default AuthCallback;
