/**
 * Centralized Auth Error Messages
 *
 * All user-facing error messages for authentication are defined here.
 * This ensures consistency and makes translations easier in the future.
 *
 * Convention:
 * - User-facing messages: German
 * - Developer logs: English (and behind import.meta.env.DEV guards)
 *
 * @see .claude/CLAUDE.md - Error message conventions
 */

export const AUTH_ERRORS = {
  // ============================================
  // GENERAL ERRORS
  // ============================================
  UNEXPECTED: 'Ein unerwarteter Fehler ist aufgetreten.',
  NOT_LOGGED_IN: 'Nicht angemeldet.',

  // ============================================
  // CONNECTION / CLOUD ERRORS
  // ============================================
  CLOUD_NOT_AVAILABLE: 'Cloud-Funktionen sind nicht verfügbar.',
  CLOUD_NOT_AVAILABLE_GUEST: 'Cloud-Funktionen sind nicht verfügbar. Bitte als Gast fortfahren.',
  CONNECTION_TIMEOUT: 'Verbindung zum Server fehlgeschlagen. Bitte prüfe deine Internetverbindung und versuche es erneut.',

  // ============================================
  // SESSION ERRORS
  // ============================================
  SESSION_EXPIRED: 'Deine Sitzung ist abgelaufen.',
  SESSION_CREATE_FAILED: 'Sitzung konnte nicht erstellt werden. Bitte versuche es erneut.',

  // ============================================
  // LOGIN ERRORS
  // ============================================
  LOGIN_FAILED: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
  INVALID_CREDENTIALS: 'E-Mail oder Passwort ist falsch.',
  ACCOUNT_NOT_FOUND: 'Kein Account mit dieser E-Mail gefunden.',

  // ============================================
  // REGISTRATION ERRORS
  // ============================================
  REGISTRATION_FAILED: 'Registrierung fehlgeschlagen.',
  EMAIL_ALREADY_REGISTERED: 'Diese E-Mail ist bereits registriert.',

  // ============================================
  // MAGIC LINK ERRORS
  // ============================================
  MAGIC_LINK_FAILED: 'Magic Link konnte nicht gesendet werden.',
  LINK_EXPIRED: 'Der Link ist abgelaufen. Bitte fordere einen neuen an.',

  // ============================================
  // GOOGLE LOGIN ERRORS
  // ============================================
  GOOGLE_LOGIN_FAILED: 'Google Login fehlgeschlagen.',

  // ============================================
  // PASSWORD ERRORS
  // ============================================
  PASSWORD_REQUIRED: 'Passwort ist erforderlich.',
  PASSWORD_TOO_SHORT: 'Passwort muss mindestens 6 Zeichen haben.',
  PASSWORD_MISMATCH: 'Passwörter stimmen nicht überein.',
  PASSWORD_RESET_FAILED: 'Passwort-Reset konnte nicht gesendet werden.',
  PASSWORD_UPDATE_FAILED: 'Passwort konnte nicht geändert werden.',
  PASSWORD_SAME_AS_OLD: 'Das neue Passwort muss sich vom alten unterscheiden.',

  // ============================================
  // EMAIL ERRORS
  // ============================================
  EMAIL_REQUIRED: 'E-Mail ist erforderlich.',
  EMAIL_INVALID: 'Bitte gib eine gültige E-Mail-Adresse ein.',

  // ============================================
  // NAME ERRORS
  // ============================================
  NAME_TOO_SHORT: 'Name muss mindestens 2 Zeichen haben.',
  NAME_TOO_LONG: 'Name darf maximal 100 Zeichen haben.',
  NAME_LENGTH_INVALID: 'Name muss 2-100 Zeichen haben.',

  // ============================================
  // REGISTRATION CODE ERRORS
  // ============================================
  REGISTRATION_CODE_REQUIRED: 'Einladungscode ist erforderlich.',
  REGISTRATION_CODE_INVALID: 'Ungültiger Einladungscode.',
} as const;

/**
 * Type for AUTH_ERRORS keys
 */
export type AuthErrorKey = keyof typeof AUTH_ERRORS;

/**
 * Type for AUTH_ERRORS values
 */
export type AuthErrorMessage = (typeof AUTH_ERRORS)[AuthErrorKey];
