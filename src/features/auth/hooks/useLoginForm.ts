/**
 * useLoginForm - Form State Hook für Login
 *
 * Verwaltet Form State und Validierung für LoginScreen.
 * Extrahiert aus LoginScreen.tsx für bessere Testbarkeit.
 *
 * @see LoginScreen.tsx
 */

import { useState, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

export type LoginMode = 'password' | 'magic-link';

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
  loginMode: LoginMode;
}

export interface UseLoginFormReturn {
  // Form data
  formData: LoginFormData;
  errors: LoginFormErrors;

  // Field setters
  setField: <K extends keyof LoginFormData>(field: K, value: LoginFormData[K]) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setRememberMe: (rememberMe: boolean) => void;
  setLoginMode: (mode: LoginMode) => void;

  // Validation
  validateForm: () => boolean;
  validateEmail: () => boolean;
  validatePassword: () => boolean;

  // Actions
  resetForm: () => void;
  clearErrors: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const INITIAL_FORM_DATA: LoginFormData = {
  email: '',
  password: '',
  rememberMe: false,
  loginMode: 'password',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================
// HOOK
// ============================================

export function useLoginForm(): UseLoginFormReturn {
  const [formData, setFormData] = useState<LoginFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<LoginFormErrors>({});

  /**
   * Generic field setter
   */
  const setField = useCallback(<K extends keyof LoginFormData>(
    field: K,
    value: LoginFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  /**
   * Convenience setters
   */
  const setEmail = useCallback((email: string) => {
    setField('email', email);
  }, [setField]);

  const setPassword = useCallback((password: string) => {
    setField('password', password);
  }, [setField]);

  const setRememberMe = useCallback((rememberMe: boolean) => {
    setField('rememberMe', rememberMe);
  }, [setField]);

  const setLoginMode = useCallback((mode: LoginMode) => {
    setField('loginMode', mode);
    // Clear password error when switching modes
    if (mode === 'magic-link') {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
  }, [setField]);

  /**
   * Email validation
   */
  const validateEmail = useCallback((): boolean => {
    const trimmedEmail = formData.email.trim();

    if (!trimmedEmail) {
      setErrors((prev) => ({ ...prev, email: 'E-Mail ist erforderlich' }));
      return false;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Bitte gib eine gültige E-Mail-Adresse ein' }));
      return false;
    }

    setErrors((prev) => ({ ...prev, email: undefined }));
    return true;
  }, [formData.email]);

  /**
   * Password validation (only for password mode)
   */
  const validatePassword = useCallback((): boolean => {
    // Skip password validation for magic-link mode
    if (formData.loginMode === 'magic-link') {
      return true;
    }

    if (!formData.password) {
      setErrors((prev) => ({ ...prev, password: 'Passwort ist erforderlich' }));
      return false;
    }

    if (formData.password.length < 6) {
      setErrors((prev) => ({ ...prev, password: 'Passwort muss mindestens 6 Zeichen haben' }));
      return false;
    }

    setErrors((prev) => ({ ...prev, password: undefined }));
    return true;
  }, [formData.password, formData.loginMode]);

  /**
   * Full form validation
   */
  const validateForm = useCallback((): boolean => {
    const emailValid = validateEmail();
    const passwordValid = validatePassword();

    return emailValid && passwordValid;
  }, [validateEmail, validatePassword]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    formData,
    errors,
    setField,
    setEmail,
    setPassword,
    setRememberMe,
    setLoginMode,
    validateForm,
    validateEmail,
    validatePassword,
    resetForm,
    clearErrors,
  };
}
