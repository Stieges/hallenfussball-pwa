/**
 * Auth Context Value Type Definition
 */

import type { AuthState, LoginResult, RegisterResult, User } from '../types/auth.types';

/**
 * AuthContext Value Type
 */
export interface AuthContextValue extends AuthState {
  /** Registriert einen neuen User */
  register: (name: string, email: string, rememberMe?: boolean) => RegisterResult;
  /** Loggt einen User ein */
  login: (email: string, rememberMe?: boolean) => LoginResult;
  /** Loggt den User aus */
  logout: () => void;
  /** Fährt als Gast fort */
  continueAsGuest: () => User;
  /** Aktualisiert den Auth-State manuell */
  refreshAuth: () => void;
}
