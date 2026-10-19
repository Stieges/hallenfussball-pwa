/**
 * AuthContext - React Context für Auth-State
 *
 * Phase 2: Supabase Auth Integration
 *
 * Features:
 * - Email/Password Login
 * - Magic Link (passwordless)
 * - Google OAuth
 * - Guest Mode (local only)
 * - Profile Management via profiles table
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 * @see docs/concepts/SUPABASE-SCHEMA-KONZEPT.md
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import type { User, Session, ConnectionState } from '../types/auth.types';
import type { AuthContextValue } from './authContextValue';
import { AuthContext } from './authContextInstance';
import { mapSupabaseUser, mapSupabaseSession } from './authMapper';
import * as authActions from './authActions';
import type { AuthActionDeps } from './authActions';
import { cacheUserProfile } from '../services/profileCacheService';
import { isFeatureEnabled } from '../../../config';
import { useRemoteSessionCheck } from './remoteSignOut';
import { SignedOutElsewhereNotice } from '../components/SignedOutElsewhereNotice';
import { ServerSlowNotice } from '../components/ServerSlowNotice';
import { fetchProfile } from './fetchProfile';
import { useAuthInit } from './useAuthInit';
import { useAutoReconnect } from './useAutoReconnect';
import { useCrossTabAuthSync } from './useCrossTabAuthSync';

// Re-export the context for consumers
export { AuthContext } from './authContextInstance';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider - Wrapper für Auth-State mit Supabase
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  // Antwort des Servers steht seit mehr als 5 s aus (@AN-019, @AN-032); endet mit der Antwort.
  const [isServerSlow, setIsServerSlow] = useState(false);
  // Jüngster updateAuthState-Aufruf: ein älteres Ergebnis darf einen neueren Zustand nicht überschreiben (A-07d2).
  const authSeqRef = useRef(0);
  // Solange die App startet (bis initAuth fertig ist): nur dann ersetzt die Nutzerkopie den fehlenden Nutzer (@AN-019).
  const startingRef = useRef(true);

  /**
   * Updates auth state from Supabase session
   */
  const updateAuthState = useCallback(async (supabaseSession: SupabaseSession | null) => {
    const seq = ++authSeqRef.current;
    if (!supabaseSession?.user) {
      // Check if we have a guest user stored
      const storedGuest = safeLocalStorage.getItem('auth:guestUser');
      if (storedGuest) {
        try {
          const guestUser = JSON.parse(storedGuest) as User;
          if (guestUser.globalRole === 'guest') {
            setUser(guestUser);
            setIsGuest(true);
            setSession(null);
            setIsLoading(false);
            return;
          }
        } catch {
          safeLocalStorage.removeItem('auth:guestUser');
        }
      }

      setUser(null);
      setSession(null);
      setIsGuest(false);
      setIsLoading(false);
      return;
    }

    // Fetch profile data (pass metadata for self-healing)
    const profileData = await fetchProfile(supabaseSession.user.id);
    if (seq !== authSeqRef.current) { return; }

    // Map to our types
    const mappedUser = mapSupabaseUser(supabaseSession.user, profileData);
    const mappedSession = mapSupabaseSession(supabaseSession);

    // Cache authenticated user for offline fallback (BUG-004 fix)
    // This allows us to restore the user if auth init fails after max retries
    // Use both localStorage (sync, quick) and IndexedDB (async, more robust)
    try {
      safeLocalStorage.setItem('auth:cachedUser', JSON.stringify(mappedUser));
    } catch {
      // localStorage not available, skip caching
    }
    // Also cache to IndexedDB for better offline support (async, fire-and-forget)
    // Only if OFFLINE_FIRST feature flag is enabled
    if (mappedUser && isFeatureEnabled('OFFLINE_FIRST')) {
      void cacheUserProfile(mappedUser);
    }

    setUser(mappedUser);
    setSession(mappedSession);
    setIsGuest(false);
    setIsLoading(false);
  }, []);

  // Start: Sitzung lesen, Hinweis „langsam“, Zeitgrenze, Abo der Auth-Ereignisse.
  useAuthInit({
    isLoading,
    setUser,
    setSession,
    setIsGuest,
    setIsLoading,
    setConnectionState,
    setIsServerSlow,
    startingRef,
    updateAuthState,
  });

  // Wiederverbindung bei „offline“ oder „Server antwortet langsam“.
  useAutoReconnect({
    connectionState,
    isServerSlow,
    setUser,
    setSession,
    setIsGuest,
    setConnectionState,
    setIsServerSlow,
    updateAuthState,
  });

  // Abgleich mit anderen Fenstern (Sitzungsschlüssel, Gast).
  useCrossTabAuthSync({ setUser, setSession, setIsGuest, updateAuthState });

  // Derived state
  const isAuthenticated = useMemo(() => {
    return user !== null && user.globalRole !== 'guest';
  }, [user]);

  // Check if user is an anonymous Supabase user (has account but no credentials)
  const isAnonymous = useMemo(() => {
    return user?.isAnonymous === true;
  }, [user]);

  // ============================================
  // AUTH ACTION DEPENDENCIES
  // ============================================

  /**
   * Ref to hold current state, avoiding stale closures in action callbacks.
   * Without this, actionDeps would depend on user/isGuest, causing ALL
   * action callbacks to be recreated on every state change.
   */
  const stateRef = useRef({ user, isGuest });
  useEffect(() => { stateRef.current = { user, isGuest }; }, [user, isGuest]);

  /**
   * Memoized dependencies for auth actions
   */
  const actionDeps: AuthActionDeps = useMemo(() => ({
    fetchProfile,
    setUser,
    setSession,
    setIsGuest,
    // Aktionen setzen „verbunden“ nur nach einer Antwort des Servers (Anmelden, Wiederverbinden): der Hinweis endet.
    setConnectionState: (state: ConnectionState) => {
      setConnectionState(state);
      if (state === 'connected') {
        setIsServerSlow(false);
      }
    },
    setIsLoading,
    updateAuthState,
    getCurrentState: () => stateRef.current,
  }), [updateAuthState]);

  // Anderes Gerät hat abgemeldet: Sitzung beim Start, bei online und bei Sichtbarkeit prüfen (A-07d2).
  useRemoteSessionCheck(supabase, isAuthenticated, () => authActions.logout(actionDeps, { scope: 'local' }));

  // ============================================
  // AUTH ACTIONS (delegating to authActions module)
  // ============================================

  const register = useCallback(
    (name: string, email: string, password: string) =>
      authActions.register(actionDeps, name, email, password),
    [actionDeps]
  );

  const login = useCallback(
    (email: string, password: string) =>
      authActions.login(actionDeps, email, password),
    [actionDeps]
  );

  const sendMagicLink = useCallback(
    (email: string) => authActions.sendMagicLink(email),
    []
  );

  const loginWithGoogle = useCallback(
    () => authActions.loginWithGoogle(),
    []
  );

  const logout = useCallback(
    (options?: { scope?: 'local' | 'others' }) => authActions.logout(actionDeps, options),
    [actionDeps]
  );

  const continueAsGuest = useCallback(
    () => authActions.continueAsGuest(actionDeps),
    [actionDeps]
  );

  const refreshAuth = useCallback(
    () => authActions.refreshAuth(actionDeps),
    [actionDeps]
  );

  const reconnect = useCallback(
    () => authActions.reconnect(actionDeps),
    [actionDeps]
  );

  const resetPassword = useCallback(
    (email: string) => authActions.resetPassword(email),
    []
  );

  const updateProfile = useCallback(
    (updates: { name?: string; avatarUrl?: string }) =>
      authActions.updateProfile(actionDeps, updates),
    [actionDeps]
  );

  const updatePassword = useCallback(
    (newPassword: string) => authActions.updatePassword(newPassword),
    []
  );

  // Context value
  const value: AuthContextValue = {
    user,
    session,
    isAuthenticated,
    isGuest,
    isAnonymous,
    isLoading,
    connectionState,
    register,
    login,
    sendMagicLink,
    loginWithGoogle,
    logout,
    continueAsGuest,
    refreshAuth,
    reconnect,
    updateProfile,
    resetPassword,
    updatePassword,
  };

  // Globale Hinweise: „von einem anderen Gerät aus abgemeldet“ (@AN-024) und „Server antwortet langsam“ (@AN-019, @AN-032).
  return <AuthContext.Provider value={value}>{children}<SignedOutElsewhereNotice /><ServerSlowNotice visible={isServerSlow} /></AuthContext.Provider>;
}
