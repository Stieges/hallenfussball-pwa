/**
 * Session Service - Verwaltet Anmelde-Sessions in localStorage
 *
 * Phase 1: Lokale Simulation
 * Phase 2: Wird durch Supabase Auth ersetzt
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 3.2
 */

import type { Session } from '../types/auth.types';
import { AUTH_STORAGE_KEYS, SESSION_DURATION } from '../types/auth.types';
import { generateToken, generateUUID } from '../utils/tokenGenerator';

// ============================================
// SESSION CRUD
// ============================================

/**
 * Erstellt eine neue Session für einen User
 *
 * @param userId - ID des Users
 * @param rememberMe - Ob die Session 30 Tage statt 24h gültig sein soll
 * @returns Neue Session
 */
export const createSession = (userId: string, rememberMe: boolean = false): Session => {
  const now = new Date().toISOString();
  const duration = rememberMe ? SESSION_DURATION.REMEMBER_ME : SESSION_DURATION.DEFAULT;
  const expiresAt = new Date(Date.now() + duration).toISOString();

  const session: Session = {
    id: generateUUID(),
    userId,
    token: generateToken(64),
    createdAt: now,
    expiresAt,
    lastActivityAt: now,
  };

  saveSession(session);
  return session;
};

/**
 * Speichert die aktuelle Session in localStorage
 */
export const saveSession = (session: Session): void => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

/**
 * Lädt die aktuelle Session aus localStorage
 *
 * @returns Session oder null wenn keine existiert oder abgelaufen
 */
export const getSession = (): Session | null => {
  try {
    const sessionJson = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION);
    if (!sessionJson) {
      return null;
    }

    const session = JSON.parse(sessionJson) as Session;

    // Prüfe ob Session abgelaufen
    if (isSessionExpired(session)) {
      clearSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
};

/**
 * Löscht die aktuelle Session
 */
export const clearSession = (): void => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
};

/**
 * Aktualisiert den lastActivityAt Timestamp der Session
 */
export const refreshSessionActivity = (): void => {
  const session = getSession();
  if (session) {
    session.lastActivityAt = new Date().toISOString();
    saveSession(session);
  }
};

/**
 * Verlängert die Session um die Standard-Dauer
 *
 * @param rememberMe - Ob für 30 Tage verlängert werden soll
 */
export const extendSession = (rememberMe: boolean = false): void => {
  const session = getSession();
  if (session) {
    const duration = rememberMe ? SESSION_DURATION.REMEMBER_ME : SESSION_DURATION.DEFAULT;
    session.expiresAt = new Date(Date.now() + duration).toISOString();
    session.lastActivityAt = new Date().toISOString();
    saveSession(session);
  }
};

// ============================================
// VALIDATION
// ============================================

/**
 * Prüft ob eine Session abgelaufen ist
 */
export const isSessionExpired = (session: Session): boolean => {
  return new Date(session.expiresAt) < new Date();
};

/**
 * Prüft ob eine gültige Session existiert
 */
export const hasValidSession = (): boolean => {
  const session = getSession();
  return session !== null && !isSessionExpired(session);
};

/**
 * Gibt die User-ID der aktuellen Session zurück
 */
export const getSessionUserId = (): string | null => {
  const session = getSession();
  return session?.userId ?? null;
};

// ============================================
// SESSION INFO
// ============================================

/**
 * Berechnet die verbleibende Zeit der Session in Millisekunden
 */
export const getSessionRemainingTime = (): number => {
  const session = getSession();
  if (!session) {
    return 0;
  }

  const remaining = new Date(session.expiresAt).getTime() - Date.now();
  return Math.max(0, remaining);
};

/**
 * Formatiert die verbleibende Session-Zeit als String
 */
export const formatSessionRemainingTime = (): string => {
  const remaining = getSessionRemainingTime();
  if (remaining === 0) {
    return 'Abgelaufen';
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} Tag${days > 1 ? 'e' : ''}`;
  }

  if (hours > 0) {
    return `${hours} Stunde${hours > 1 ? 'n' : ''}`;
  }

  const minutes = Math.floor(remaining / (1000 * 60));
  return `${minutes} Minute${minutes > 1 ? 'n' : ''}`;
};
