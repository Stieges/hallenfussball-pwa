/**
 * Auth Service - Authentifizierung (Registrierung, Login, Logout)
 *
 * Phase 1: Lokale Simulation mit localStorage
 * Phase 2: Wird durch Supabase Auth ersetzt
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

import type {
  User,
  GlobalRole,
  LoginResult,
  RegisterResult,
} from '../types/auth.types';
import { AUTH_STORAGE_KEYS } from '../types/auth.types';
import { generateUUID } from '../utils/tokenGenerator';
import {
  createSession,
  clearSession,
  getSession,
  getSessionUserId,
} from './sessionService';

// ============================================
// USER STORAGE HELPERS
// ============================================

/**
 * Lädt alle Users aus localStorage
 */
const getUsers = (): User[] => {
  try {
    const usersJson = localStorage.getItem(AUTH_STORAGE_KEYS.USERS);
    return usersJson ? (JSON.parse(usersJson) as User[]) : [];
  } catch {
    return [];
  }
};

/**
 * Speichert alle Users in localStorage
 */
const saveUsers = (users: User[]): void => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (error) {
    console.error('Failed to save users:', error);
  }
};

/**
 * Speichert den aktuellen User in localStorage
 */
const saveCurrentUser = (user: User | null): void => {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_USER);
    }
  } catch (error) {
    console.error('Failed to save current user:', error);
  }
};

// ============================================
// REGISTRATION
// ============================================

/**
 * Registriert einen neuen User
 *
 * @param name - Anzeigename
 * @param email - E-Mail-Adresse (wird lowercase gespeichert)
 * @param rememberMe - Session 30 Tage statt 24h
 * @returns RegisterResult mit User und Session oder Fehler
 */
export const register = (
  name: string,
  email: string,
  rememberMe: boolean = false
): RegisterResult => {
  // Validierung
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (trimmedName.length < 2) {
    return {
      success: false,
      error: 'Name muss mindestens 2 Zeichen haben.',
    };
  }

  if (trimmedName.length > 100) {
    return {
      success: false,
      error: 'Name darf maximal 100 Zeichen haben.',
    };
  }

  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      error: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    };
  }

  // Prüfe ob E-Mail bereits existiert
  const users = getUsers();
  const existingUser = users.find((u) => u.email === normalizedEmail);

  if (existingUser) {
    return {
      success: false,
      error: 'Diese E-Mail ist bereits registriert.',
    };
  }

  // User erstellen
  const now = new Date().toISOString();
  const newUser: User = {
    id: generateUUID(),
    email: normalizedEmail,
    name: trimmedName,
    globalRole: 'user',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  // User speichern
  users.push(newUser);
  saveUsers(users);

  // Session erstellen
  const session = createSession(newUser.id, rememberMe);

  // Current User setzen
  saveCurrentUser(newUser);

  return {
    success: true,
    user: newUser,
    session,
  };
};

// ============================================
// LOGIN
// ============================================

/**
 * Loggt einen User ein (Magic Link Simulation)
 *
 * In Phase 1 wird kein echter Magic Link gesendet.
 * Der Login erfolgt direkt über die E-Mail-Adresse.
 *
 * @param email - E-Mail-Adresse
 * @param rememberMe - Session 30 Tage statt 24h
 * @returns LoginResult mit User und Session oder Fehler
 */
export const login = (
  email: string,
  rememberMe: boolean = false
): LoginResult => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    return {
      success: false,
      error: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    };
  }

  // User finden
  const users = getUsers();
  const user = users.find((u) => u.email === normalizedEmail);

  if (!user) {
    return {
      success: false,
      error: 'Kein Account mit dieser E-Mail gefunden.',
    };
  }

  // LastLoginAt aktualisieren
  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  saveUsers(users);

  // Session erstellen
  const session = createSession(user.id, rememberMe);

  // Current User setzen
  saveCurrentUser(user);

  return {
    success: true,
    user,
    session,
  };
};

/**
 * Loggt einen User über einen Magic Link Token ein
 *
 * In Phase 1 ist dies identisch mit login(), da keine echten
 * Magic Links versendet werden.
 *
 * @param token - Magic Link Token (in Phase 1 = E-Mail)
 */
export const loginWithMagicLink = (token: string): LoginResult => {
  // In Phase 1: Token ist die E-Mail
  return login(token);
};

// ============================================
// LOGOUT
// ============================================

/**
 * Loggt den aktuellen User aus
 */
export const logout = (): void => {
  clearSession();
  saveCurrentUser(null);
};

// ============================================
// CURRENT USER
// ============================================

/**
 * Gibt den aktuell eingeloggten User zurück
 *
 * @returns User oder null wenn nicht eingeloggt
 */
export const getCurrentUser = (): User | null => {
  // Erst Session prüfen
  const userId = getSessionUserId();
  if (!userId) {
    saveCurrentUser(null);
    return null;
  }

  // User aus Users-Liste laden (für aktuelle Daten)
  const users = getUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    // Session existiert aber User nicht mehr → ausloggen
    logout();
    return null;
  }

  // Cached User aktualisieren
  saveCurrentUser(user);
  return user;
};

/**
 * Gibt den gecachten aktuellen User zurück (schneller, evtl. veraltet)
 */
export const getCachedCurrentUser = (): User | null => {
  try {
    const userJson = localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER);
    return userJson ? (JSON.parse(userJson) as User) : null;
  } catch {
    return null;
  }
};

/**
 * Prüft ob ein User eingeloggt ist
 */
export const isAuthenticated = (): boolean => {
  return getSession() !== null;
};

/**
 * Prüft ob der aktuelle User ein Gast ist
 */
export const isCurrentUserGuest = (): boolean => {
  const user = getCurrentUser();
  return user?.globalRole === 'guest';
};

// ============================================
// GUEST MODE
// ============================================

/**
 * Erstellt einen Gast-User (nicht persistent)
 *
 * Gäste können Turniere lokal erstellen, aber nicht synchronisieren.
 *
 * @returns Guest User
 */
export const createGuestUser = (): User => {
  const now = new Date().toISOString();
  const guestUser: User = {
    id: generateUUID(),
    email: '',
    name: 'Gast',
    globalRole: 'guest',
    createdAt: now,
    updatedAt: now,
  };

  // Gast-User speichern (aber nicht in users Liste)
  saveCurrentUser(guestUser);

  // Keine Session für Gäste (optional: kurze Session)
  // clearSession();

  return guestUser;
};

/**
 * Konvertiert einen Gast zu einem registrierten User
 *
 * @param guestId - ID des Gast-Users
 * @param name - Name für den neuen Account
 * @param email - E-Mail für den neuen Account
 * @param rememberMe - Session-Dauer verlängern
 * @returns RegisterResult
 */
export const convertGuestToUser = (
  _guestId: string,
  name: string,
  email: string,
  rememberMe: boolean = false
): RegisterResult => {
  const result = register(name, email, rememberMe);

  if (result.success && result.user) {
    // TODO: Lokale Turniere des Gastes auf neuen User übertragen
    // Dies passiert in membershipService

    // Return with migration flag for UI feedback
    return {
      ...result,
      wasMigrated: true,
    };
  }

  return result;
};

// ============================================
// USER UPDATES
// ============================================

/**
 * Aktualisiert den aktuellen User
 *
 * @param updates - Zu aktualisierende Felder
 * @returns Aktualisierter User oder null bei Fehler
 */
export const updateCurrentUser = (
  updates: Partial<Pick<User, 'name' | 'avatarUrl'>>
): User | null => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return null;
  }

  // Name validieren falls übergeben
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return null;
    }
    updates.name = trimmedName;
  }

  // User aktualisieren
  const users = getUsers();
  const userIndex = users.findIndex((u) => u.id === currentUser.id);

  if (userIndex === -1) {
    return null;
  }

  const updatedUser: User = {
    ...users[userIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  users[userIndex] = updatedUser;
  saveUsers(users);
  saveCurrentUser(updatedUser);

  return updatedUser;
};

/**
 * Ändert die globale Rolle eines Users (nur Admin)
 *
 * @param userId - ID des Users
 * @param newRole - Neue globale Rolle
 * @returns true wenn erfolgreich
 */
export const setUserGlobalRole = (userId: string, newRole: GlobalRole): boolean => {
  const currentUser = getCurrentUser();

  // Nur Admins können globale Rollen ändern
  if (currentUser?.globalRole !== 'admin') {
    return false;
  }

  const users = getUsers();
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return false;
  }

  users[userIndex] = {
    ...users[userIndex],
    globalRole: newRole,
    updatedAt: new Date().toISOString(),
  };

  saveUsers(users);

  // Falls es der aktuelle User ist, auch cached User aktualisieren
  if (userId === currentUser.id) {
    saveCurrentUser(users[userIndex]);
  }

  return true;
};

// ============================================
// USER LOOKUP
// ============================================

/**
 * Findet einen User anhand der ID
 */
export const getUserById = (userId: string): User | null => {
  const users = getUsers();
  return users.find((u) => u.id === userId) ?? null;
};

/**
 * Findet einen User anhand der E-Mail
 */
export const getUserByEmail = (email: string): User | null => {
  const normalizedEmail = email.trim().toLowerCase();
  const users = getUsers();
  return users.find((u) => u.email === normalizedEmail) ?? null;
};

/**
 * Prüft ob eine E-Mail bereits registriert ist
 */
export const isEmailRegistered = (email: string): boolean => {
  return getUserByEmail(email) !== null;
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validiert eine E-Mail-Adresse
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validiert einen Namen
 */
export const isValidName = (name: string): { valid: boolean; error?: string } => {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Name muss mindestens 2 Zeichen haben.' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Name darf maximal 100 Zeichen haben.' };
  }

  return { valid: true };
};
