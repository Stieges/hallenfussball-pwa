/**
 * Auth Context Value Type Definition
 *
 * Updated for Supabase Auth integration.
 * All auth operations are now async.
 */

import type { AuthState, LoginResult, RegisterResult, User } from '../types/auth.types';

/**
 * AuthContext Value Type
 *
 * Note: All auth methods are now async (return Promise)
 */
export interface AuthContextValue extends AuthState {
  /** Registriert einen neuen User (async) */
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  /** Loggt einen User mit Email/Password ein (async) */
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Sendet einen Magic Link (async) */
  sendMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  /** Loggt mit Google OAuth ein (async) */
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  /** Loggt den User aus (async) */
  logout: () => Promise<void>;
  /** Fährt als Gast fort */
  continueAsGuest: () => User;
  /** Aktualisiert den Auth-State manuell (async) */
  refreshAuth: () => Promise<void>;
  /** Aktualisiert das User-Profil (async) */
  updateProfile: (updates: { name?: string; avatarUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  /** Sendet eine Passwort-Reset E-Mail (async) */
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  /** Setzt ein neues Passwort (nach Recovery) (async) */
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}
