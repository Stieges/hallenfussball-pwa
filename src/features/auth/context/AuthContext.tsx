/**
 * AuthContext - React Context für Auth-State
 *
 * Bietet globalen Auth-State für die gesamte App.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { User } from '../types/auth.types';
import {
  register as authRegister,
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  createGuestUser,
  convertGuestToUser,
} from '../services/authService';
import { getSession, refreshSessionActivity } from '../services/sessionService';
import type { AuthContextValue } from './authContextValue';
import { AuthContext } from './authContextInstance';

// Re-export the context for consumers
export { AuthContext } from './authContextInstance';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider - Wrapper für Auth-State
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialer Auth-Check
  useEffect(() => {
    const initAuth = () => {
      try {
        const currentUser = getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Auth init error:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Session-Aktivität bei User-Interaktion aktualisieren
  useEffect(() => {
    if (!user || user.globalRole === 'guest') {
      return;
    }

    const handleActivity = () => {
      refreshSessionActivity();
    };

    // Aktivität bei Klicks und Tastatureingaben tracken
    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [user]);

  // Abgeleitete States
  const isAuthenticated = useMemo(() => {
    return user !== null && user.globalRole !== 'guest';
  }, [user]);

  const isGuest = useMemo(() => {
    return user?.globalRole === 'guest';
  }, [user]);

  const session = useMemo(() => {
    return getSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Actions
  const register = useCallback(
    (name: string, email: string, rememberMe: boolean = false) => {
      // If current user is a guest, migrate instead of fresh register
      const currentUser = getCurrentUser();
      const isCurrentGuest = currentUser?.globalRole === 'guest';

      const result = isCurrentGuest
        ? convertGuestToUser(currentUser.id, name, email, rememberMe)
        : authRegister(name, email, rememberMe);

      if (result.success && result.user) {
        setUser(result.user);
      }

      return result;
    },
    []
  );

  const login = useCallback(
    (email: string, rememberMe: boolean = false) => {
      const result = authLogin(email, rememberMe);

      if (result.success && result.user) {
        setUser(result.user);
      }

      return result;
    },
    []
  );

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  const continueAsGuest = useCallback((): User => {
    const guestUser = createGuestUser();
    setUser(guestUser);
    return guestUser;
  }, []);

  const refreshAuth = useCallback(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    isAuthenticated,
    isGuest,
    isLoading,
    register,
    login,
    logout,
    continueAsGuest,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
