/**
 * useCurrentUser Hook - Convenience Hook für aktuellen User
 *
 * Leichtgewichtiger Hook wenn nur der User benötigt wird,
 * ohne Auth-Actions.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, isGuest } = useCurrentUser();
 *
 * return <span>Hallo, {user?.name ?? 'Gast'}!</span>;
 * ```
 */

import { useState, useEffect, useMemo } from 'react';
import type { User } from '../types/auth.types';
import { getCurrentUser, getCachedCurrentUser } from '../services/authService';

/**
 * Return-Type des useCurrentUser Hooks
 */
export interface UseCurrentUserReturn {
  /** Aktueller User oder null */
  user: User | null;
  /** Ist der User authentifiziert (nicht Gast, nicht null) */
  isAuthenticated: boolean;
  /** Ist der User ein Gast */
  isGuest: boolean;
  /** Ist der User ein Admin */
  isAdmin: boolean;
  /** Wird noch geladen */
  isLoading: boolean;
}

/**
 * Hook für den aktuellen User
 *
 * Verwendet gecachten User für schnelles Initial-Render,
 * aktualisiert dann mit frischen Daten.
 */
export const useCurrentUser = (): UseCurrentUserReturn => {
  // Initialer State mit gecachtem User für schnelles Render
  const [user, setUser] = useState<User | null>(() => getCachedCurrentUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Frische Daten laden (validiert Session)
    const freshUser = getCurrentUser();
    setUser(freshUser);
    setIsLoading(false);
  }, []);

  const isAuthenticated = useMemo(() => {
    return user !== null && user.globalRole !== 'guest';
  }, [user]);

  const isGuest = useMemo(() => {
    return user?.globalRole === 'guest';
  }, [user]);

  const isAdmin = useMemo(() => {
    return user?.globalRole === 'admin';
  }, [user]);

  return {
    user,
    isAuthenticated,
    isGuest,
    isAdmin,
    isLoading,
  };
};

export default useCurrentUser;
