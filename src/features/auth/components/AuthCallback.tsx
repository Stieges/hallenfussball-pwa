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
import { safeSessionStorage, safeLocalStorage } from '../../../core/utils/safeStorage';
import { cssVars } from '../../../design-tokens';

/**
 * Parses URL parameters from HashRouter URLs
 *
 * HashRouter URLs look like: https://example.com/#/auth/callback?code=xxx&type=recovery
 * - window.location.hash = "#/auth/callback?code=xxx&type=recovery"
 * - window.location.search = "" (empty!)
 *
 * We need to extract query params from within the hash.
 */
function parseHashRouterParams(): { query: URLSearchParams; fragment: URLSearchParams } {
  const hash = window.location.hash; // e.g., "#/auth/callback?code=xxx&type=recovery"

  // For HashRouter, the query string is inside the hash
  // Format: #/path?query or #/path#fragment
  const hashContent = hash.substring(1); // Remove leading #

  // Check if there's a query string in the hash
  const queryIndex = hashContent.indexOf('?');
  const fragmentIndex = hashContent.indexOf('#', 1); // Look for second # (for implicit flow tokens)

  let queryString = '';
  let fragmentString = '';

  if (queryIndex !== -1) {
    // Query params exist in hash
    const afterQuery = hashContent.substring(queryIndex + 1);
    // Check if there's also a fragment after the query
    const fragInQuery = afterQuery.indexOf('#');
    if (fragInQuery !== -1) {
      queryString = afterQuery.substring(0, fragInQuery);
      fragmentString = afterQuery.substring(fragInQuery + 1);
    } else {
      queryString = afterQuery;
    }
  } else if (fragmentIndex !== -1) {
    // Only fragment (implicit flow tokens)
    fragmentString = hashContent.substring(fragmentIndex + 1);
  }

  // Also check window.location.search as fallback (for BrowserRouter or direct calls)
  if (!queryString && window.location.search) {
    queryString = window.location.search.substring(1);
  }

  return {
    query: new URLSearchParams(queryString),
    fragment: new URLSearchParams(fragmentString),
  };
}

/**
 * Checks if a password recovery flow is pending (with TTL support)
 * Handles both old format ('true') and new format ({pending, expiresAt})
 */
function isPasswordRecoveryPending(): boolean {
  const data = safeSessionStorage.getItem('auth:passwordRecovery');
  if (!data) {
    return false;
  }

  // Handle old format (plain 'true')
  if (data === 'true') {
    return true;
  }

  try {
    const parsed = JSON.parse(data) as { pending?: boolean; expiresAt?: number };
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      // Expired - clean up and return false
      safeSessionStorage.removeItem('auth:passwordRecovery');
      return false;
    }
    return parsed.pending === true;
  } catch {
    // Invalid JSON - treat as old format
    return data === 'true';
  }
}

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
        // Parse parameters from HashRouter URL structure
        const { query: queryParams, fragment: fragmentParams } = parseHashRouterParams();

        // Also try React Router's search params as additional fallback
        const routerParams = new URLSearchParams(location.search);

        // Check fragment first (implicit flow), then query (PKCE flow), then router params
        const accessToken = fragmentParams.get('access_token') ?? queryParams.get('access_token') ?? routerParams.get('access_token');
        const refreshToken = fragmentParams.get('refresh_token') ?? queryParams.get('refresh_token') ?? routerParams.get('refresh_token');
        const errorDescription = fragmentParams.get('error_description') ?? queryParams.get('error_description') ?? routerParams.get('error_description');
        const type = fragmentParams.get('type') ?? queryParams.get('type') ?? routerParams.get('type'); // 'recovery' for password reset
        const code = queryParams.get('code') ?? routerParams.get('code'); // PKCE flow uses code in query

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[AuthCallback] Parsed params:', { code: !!code, accessToken: !!accessToken, type, errorDescription });
        }

        if (errorDescription) {
          setError(decodeURIComponent(errorDescription));
          return;
        }

        // IMPORTANT: Check for existing session FIRST
        // Supabase with detectSessionInUrl:true may have already processed the code/tokens
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
          // Session found!
          // Explicitly clear guest user to prevent any fallback
          safeLocalStorage.removeItem('auth:guestUser');

          const isRecoveryFlow = type === 'recovery' || isPasswordRecoveryPending();

          if (isRecoveryFlow) {
            safeSessionStorage.removeItem('auth:passwordRecovery');
            void navigate('/set-password', { replace: true });
            return;
          }

          void navigate('/', { replace: true });
          return;
        }

        // Handle PKCE flow (code in query params)
        // Note: With detectSessionInUrl: false, we are the only code processor
        // No more race conditions with Supabase auto-detect
        if (code) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('[AuthCallback] Exchanging code for session...');
          }
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('[AuthCallback] Code exchange result:', { error: !!exchangeError, errorMsg: exchangeError?.message });
          }

          if (exchangeError) {
            // Code already used = user clicked link twice or link expired
            // No race condition possible since detectSessionInUrl is false
            if (import.meta.env.DEV) {
              console.error('Code exchange error:', exchangeError);
            }
            setError(
              exchangeError.message.includes('expired')
                ? 'Der Link ist abgelaufen. Bitte fordere einen neuen an.'
                : 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.'
            );
            return;
          }

          // Exchange successful - session should be set immediately
          const { data: { session: verifySession } } = await supabase.auth.getSession();
          if (!verifySession) {
            if (import.meta.env.DEV) {
              console.error('Exchange successful but no session found');
            }
            setError('Sitzung konnte nicht erstellt werden. Bitte versuche es erneut.');
            return;
          }

          safeLocalStorage.removeItem('auth:guestUser');

          const isRecoveryFlow = type === 'recovery' || isPasswordRecoveryPending();

          if (isRecoveryFlow) {
            safeSessionStorage.removeItem('auth:passwordRecovery');
            void navigate('/set-password', { replace: true });
            return;
          }

          void navigate('/', { replace: true });
          return;
        }

        // Handle Implicit flow
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError(sessionError.message);
            return;
          }

          // Success
          safeLocalStorage.removeItem('auth:guestUser');

          if (type === 'recovery') {
            void navigate('/set-password', { replace: true });
            return;
          }

          void navigate('/', { replace: true });
          return;
        }

        // No code, no tokens, no session
        // Check if we accidentally ended up here from Google redirect but parsing failed?
        if (import.meta.env.DEV) {
          console.warn('AuthCallback: No auth data found in URL', { hash: window.location.hash, search: window.location.search });
        }

        // Don't redirect immediately to login if we suspect we might have missed something
        // But for now, standard behavior is redirect.
        void navigate('/login', { replace: true });
      } catch (err) {
        // AbortError is expected in React StrictMode (double mount/unmount)
        // The Supabase lock gets aborted on first unmount
        // Retry after a short delay to let StrictMode settle
        if (err instanceof Error && err.name === 'AbortError') {
          if (retryCount < 2) {
            // Wait for StrictMode to finish its double-mount cycle
            await new Promise(resolve => setTimeout(resolve, 150));
            return handleAuthCallback(retryCount + 1);
          }
          // After retries, redirect to home - auth might have succeeded via detectSessionInUrl
          void navigate('/', { replace: true });
          return;
        }

        if (import.meta.env.DEV) {
          console.error('Auth callback error:', err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('Error details:', errorMessage);
        }
        setError('Ein unerwarteter Fehler ist aufgetreten.');
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
