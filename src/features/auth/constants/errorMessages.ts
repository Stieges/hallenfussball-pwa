/**
 * Auth Error Messages - Centralized error message constants
 *
 * All user-facing error messages are in German.
 * Log messages remain in English (in the component code).
 *
 * @see docs/concepts/ENTERPRISE-FEATURES-PLAN.md - FIX 7
 */

export const AUTH_ERRORS = {
  // Generic errors
  UNEXPECTED: 'Ein unerwarteter Fehler ist aufgetreten.',

  // Session errors
  SESSION_EXPIRED: 'Deine Sitzung ist abgelaufen.',
  SESSION_CREATE_FAILED: 'Sitzung konnte nicht erstellt werden. Bitte versuche es erneut.',

  // Login errors
  LOGIN_FAILED: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
  GOOGLE_LOGIN_FAILED: 'Google Login fehlgeschlagen.',

  // Magic Link errors
  MAGIC_LINK_FAILED: 'Magic Link konnte nicht gesendet werden.',

  // Password errors
  PASSWORD_RESET_FAILED: 'Passwort-Reset konnte nicht gesendet werden.',
  PASSWORD_UPDATE_FAILED: 'Passwort konnte nicht geändert werden.',
  PASSWORD_MISMATCH: 'Passwörter stimmen nicht überein.',
  PASSWORD_TOO_SHORT: 'Passwort muss mindestens 6 Zeichen haben.',

  // Link errors
  LINK_EXPIRED: 'Der Link ist abgelaufen. Bitte fordere einen neuen an.',

  // Email errors
  EMAIL_REQUIRED: 'Bitte gib zuerst deine E-Mail-Adresse ein.',
} as const;

export type AuthErrorKey = keyof typeof AUTH_ERRORS;
