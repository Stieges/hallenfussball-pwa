/**
 * Auth Context Instance
 *
 * Separated from provider for React Refresh compatibility.
 */

import { createContext } from 'react';
import type { AuthContextValue } from './authContextValue';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
