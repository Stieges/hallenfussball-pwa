/**
 * Centralized Auth Error Messages
 *
 * All user-facing error messages for authentication are defined here.
 * Values are resolved from i18n translations at access time via getters.
 *
 * Convention:
 * - User-facing messages: Translated via i18n (auth namespace)
 * - Developer logs: English (and behind import.meta.env.DEV guards)
 *
 * @see .claude/CLAUDE.md - Error message conventions
 */

import i18n from 'i18next';

const t = (key: string): string => i18n.t(`auth:errors.${key}`, { defaultValue: '' });

export const AUTH_ERRORS = {
  // ============================================
  // GENERAL ERRORS
  // ============================================
  get UNEXPECTED() { return t('unexpected'); },
  get NOT_LOGGED_IN() { return t('notLoggedIn'); },

  // ============================================
  // CONNECTION / CLOUD ERRORS
  // ============================================
  get CLOUD_NOT_AVAILABLE() { return t('cloudNotAvailable'); },
  get CLOUD_NOT_AVAILABLE_GUEST() { return t('cloudNotAvailableGuest'); },
  get CONNECTION_TIMEOUT() { return t('connectionTimeout'); },

  // ============================================
  // SESSION ERRORS
  // ============================================
  get SESSION_EXPIRED() { return t('sessionExpired'); },
  get SESSION_CREATE_FAILED() { return t('sessionCreateFailed'); },

  // ============================================
  // LOGIN ERRORS
  // ============================================
  get LOGIN_FAILED() { return t('loginFailed'); },
  get INVALID_CREDENTIALS() { return t('invalidCredentials'); },
  get ACCOUNT_NOT_FOUND() { return t('accountNotFound'); },

  // ============================================
  // REGISTRATION ERRORS
  // ============================================
  get REGISTRATION_FAILED() { return t('registrationFailed'); },
  get EMAIL_ALREADY_REGISTERED() { return t('emailAlreadyRegistered'); },

  // ============================================
  // MAGIC LINK ERRORS
  // ============================================
  get MAGIC_LINK_FAILED() { return t('magicLinkFailed'); },
  get LINK_EXPIRED() { return t('linkExpired'); },

  // ============================================
  // GOOGLE LOGIN ERRORS
  // ============================================
  get GOOGLE_LOGIN_FAILED() { return t('googleLoginFailed'); },

  // ============================================
  // PASSWORD ERRORS
  // ============================================
  get PASSWORD_REQUIRED() { return t('passwordRequired'); },
  get PASSWORD_TOO_SHORT() { return t('passwordTooShort'); },
  get PASSWORD_MISMATCH() { return t('passwordMismatch'); },
  get PASSWORD_RESET_FAILED() { return t('passwordResetFailed'); },
  get PASSWORD_UPDATE_FAILED() { return t('passwordUpdateFailed'); },
  get PASSWORD_SAME_AS_OLD() { return t('passwordSameAsOld'); },

  // ============================================
  // EMAIL ERRORS
  // ============================================
  get EMAIL_REQUIRED() { return t('emailRequired'); },
  get EMAIL_INVALID() { return t('emailInvalid'); },

  // ============================================
  // NAME ERRORS
  // ============================================
  get NAME_TOO_SHORT() { return t('nameTooShort'); },
  get NAME_TOO_LONG() { return t('nameTooLong'); },
  get NAME_LENGTH_INVALID() { return t('nameLengthInvalid'); },

  // ============================================
  // REGISTRATION CODE ERRORS
  // ============================================
  get REGISTRATION_CODE_REQUIRED() { return t('registrationCodeRequired'); },
  get REGISTRATION_CODE_INVALID() { return t('registrationCodeInvalid'); },
};

/**
 * Type for AUTH_ERRORS keys
 */
export type AuthErrorKey = keyof typeof AUTH_ERRORS;

/**
 * Type for AUTH_ERRORS values (now dynamic strings via i18n)
 */
export type AuthErrorMessage = string;
