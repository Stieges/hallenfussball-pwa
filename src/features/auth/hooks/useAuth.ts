/**
 * useAuth Hook - Auth-State und Actions
 *
 * Zentraler Hook für Authentifizierung in der App.
 * Verwendet den AuthContext für geteilten State.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, login, logout, register } = useAuth();
 *
 * if (!isAuthenticated) {
 *   return <LoginScreen />;
 * }
 * ```
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextValue } from '../context/authContextValue';

/**
 * Return-Type des useAuth Hooks (re-export for backwards compatibility)
 */
export type UseAuthReturn = AuthContextValue;

/**
 * Hook für Authentifizierungs-State und -Actions
 *
 * Muss innerhalb eines AuthProvider verwendet werden.
 */
export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
