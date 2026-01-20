/**
 * AuthCallback Helper Functions
 *
 * Extracted from AuthCallback.tsx for testability and reusability.
 *
 * @module authCallbackHelpers
 */

import { supabase } from '../../../lib/supabase';
import { safeSessionStorage, safeLocalStorage } from '../../../core/utils/safeStorage';
import { AUTH_ERRORS } from '../constants';

// ============================================================================
// Types
// ============================================================================

export interface AuthFlowResult {
  handled: boolean;
  redirectTo?: string;
  error?: string;
}

export interface ParsedAuthParams {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  errorDescription: string | null;
}

// ============================================================================
// URL Parsing Helpers
// ============================================================================

/**
 * Parses URL parameters from HashRouter URLs
 *
 * HashRouter URLs look like: https://example.com/#/auth/callback?code=xxx&type=recovery
 * - window.location.hash = "#/auth/callback?code=xxx&type=recovery"
 * - window.location.search = "" (empty!)
 *
 * We need to extract query params from within the hash.
 */
export function parseHashRouterParams(): { query: URLSearchParams; fragment: URLSearchParams } {
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
export function isPasswordRecoveryPending(): boolean {
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

/**
 * Parses all auth-related parameters from various URL sources
 * Combines HashRouter params, fragment params, and React Router search params
 */
export function parseAllAuthParams(locationSearch: string): ParsedAuthParams {
  const { query: queryParams, fragment: fragmentParams } = parseHashRouterParams();
  const routerParams = new URLSearchParams(locationSearch);

  return {
    accessToken: fragmentParams.get('access_token') ?? queryParams.get('access_token') ?? routerParams.get('access_token'),
    refreshToken: fragmentParams.get('refresh_token') ?? queryParams.get('refresh_token') ?? routerParams.get('refresh_token'),
    code: queryParams.get('code') ?? routerParams.get('code'),
    type: fragmentParams.get('type') ?? queryParams.get('type') ?? routerParams.get('type'),
    errorDescription: fragmentParams.get('error_description') ?? queryParams.get('error_description') ?? routerParams.get('error_description'),
  };
}

// ============================================================================
// Auth Flow Handlers
// ============================================================================

/**
 * Handles the case when a valid session already exists
 * Clears guest user and redirects based on recovery flow status
 */
export function handleExistingSession(type: string | null): AuthFlowResult {
  safeLocalStorage.removeItem('auth:guestUser');
  const isRecoveryFlow = type === 'recovery' || isPasswordRecoveryPending();

  if (isRecoveryFlow) {
    safeSessionStorage.removeItem('auth:passwordRecovery');
    return { handled: true, redirectTo: '/set-password' };
  }
  return { handled: true, redirectTo: '/' };
}

/**
 * Handles PKCE code exchange flow
 * Exchanges authorization code for session tokens
 */
export async function handleCodeExchange(
  code: string,
  type: string | null
): Promise<AuthFlowResult> {
  if (!supabase) {
    return { handled: false };
  }

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
    if (import.meta.env.DEV) {
      console.error('Code exchange error:', exchangeError);
    }
    return {
      handled: true,
      error: exchangeError.message.includes('expired')
        ? AUTH_ERRORS.LINK_EXPIRED
        : AUTH_ERRORS.LOGIN_FAILED,
    };
  }

  // Verify session was created
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    if (import.meta.env.DEV) {
      console.error('Exchange successful but no session found');
    }
    return { handled: true, error: AUTH_ERRORS.SESSION_CREATE_FAILED };
  }

  return handleExistingSession(type);
}

/**
 * Creates a promise that rejects after a timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Handles implicit flow with access and refresh tokens
 * Sets session directly from URL tokens
 *
 * IMPORTANT: setSession() can hang indefinitely in some edge cases
 * (e.g., Supabase internal lock acquisition, network issues).
 * We add timeout protection to prevent infinite loading states.
 */
export async function handleImplicitFlow(
  accessToken: string,
  refreshToken: string,
  type: string | null
): Promise<AuthFlowResult> {
  if (!supabase) {
    return { handled: false };
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[AuthCallback] Starting implicit flow with tokens...');
    // eslint-disable-next-line no-console
    console.log('[AuthCallback] Access token length:', accessToken.length);
    // eslint-disable-next-line no-console
    console.log('[AuthCallback] Refresh token length:', refreshToken.length);
  }

  try {
    // Timeout protection: setSession() should complete within 10 seconds
    // This prevents infinite hangs that were observed in production
    const { error: sessionError } = await withTimeout(
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
      10000,
      'Session-Erstellung hat zu lange gedauert. Bitte versuche es erneut.'
    );

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[AuthCallback] setSession completed:', { error: !!sessionError, errorMsg: sessionError?.message });
    }

    if (sessionError) {
      if (import.meta.env.DEV) {
        console.error('[AuthCallback] setSession error:', sessionError);
      }
      return { handled: true, error: sessionError.message };
    }

    // Verify session was actually created
    const { data: { session } } = await withTimeout(
      supabase.auth.getSession(),
      5000,
      'Session-Verifikation fehlgeschlagen.'
    );

    if (!session) {
      if (import.meta.env.DEV) {
        console.error('[AuthCallback] setSession succeeded but no session found');
      }
      return { handled: true, error: AUTH_ERRORS.SESSION_CREATE_FAILED };
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[AuthCallback] Session verified, user:', session.user?.email);
    }

    safeLocalStorage.removeItem('auth:guestUser');
    return { handled: true, redirectTo: type === 'recovery' ? '/set-password' : '/' };
  } catch (err) {
    // Handle timeout or other errors
    if (import.meta.env.DEV) {
      console.error('[AuthCallback] Implicit flow error:', err);
    }
    const message = err instanceof Error ? err.message : AUTH_ERRORS.LOGIN_FAILED;
    return { handled: true, error: message };
  }
}
