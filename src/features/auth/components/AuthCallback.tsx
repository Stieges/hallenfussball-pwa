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

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
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

        if (errorDescription) {
          setError(decodeURIComponent(errorDescription));
          return;
        }

        // Handle PKCE flow (code in query params)
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            setError(exchangeError.message);
            return;
          }

          // Check if this is a recovery flow
          // Check both URL param (legacy/implicit) and sessionStorage flag (PKCE)
          // The PASSWORD_RECOVERY event fires during exchangeCodeForSession and sets the flag
          const isPasswordRecovery = type === 'recovery' || sessionStorage.getItem('auth:passwordRecovery') === 'true';

          if (isPasswordRecovery) {
            // Clear the flag so it doesn't persist
            sessionStorage.removeItem('auth:passwordRecovery');
            void navigate('/set-password', { replace: true });
            return;
          }

          // Successfully authenticated
          void navigate('/', { replace: true });
          return;
        }

        // Handle Implicit flow (tokens in hash)
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError(sessionError.message);
            return;
          }

          // Check if this is a password recovery flow
          if (type === 'recovery') {
            void navigate('/set-password', { replace: true });
            return;
          }

          // Successfully authenticated, redirect to home
          void navigate('/', { replace: true });
          return;
        }

        // Check if we already have a valid session (e.g., from onAuthStateChange)
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession();

        if (getSessionError) {
          setError(getSessionError.message);
          return;
        }

        if (session) {
          // Check if this is a password recovery flow
          // Check both URL param (legacy/implicit) and sessionStorage flag (PKCE)
          const isPasswordRecovery = type === 'recovery' || sessionStorage.getItem('auth:passwordRecovery') === 'true';

          if (isPasswordRecovery) {
            // Clear the flag so it doesn't persist
            sessionStorage.removeItem('auth:passwordRecovery');
            void navigate('/set-password', { replace: true });
            return;
          }

          // Successfully authenticated, redirect to home
          void navigate('/', { replace: true });
        } else {
          // No session and no tokens - redirect to login
          void navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Ein unerwarteter Fehler ist aufgetreten.');
      }
    };

    void handleAuthCallback();
  }, [navigate, location.search]);

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
