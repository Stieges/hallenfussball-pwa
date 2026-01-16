/**
 * useRegisterForm - Form state management for registration
 *
 * Handles:
 * - Form field state
 * - Field-level validation
 * - Email typo suggestions
 * - Registration code validation
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 */

import { useState, useCallback } from 'react';
import { validateEmail } from '../utils/emailValidation';

export interface RegisterFormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  registrationCode?: string;
  general?: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  registrationCode: string;
}

export interface UseRegisterFormReturn {
  /** Form field values */
  formData: RegisterFormData;
  /** Validation errors */
  errors: RegisterFormErrors;
  /** Email typo suggestion */
  emailSuggestion: string | null;
  /** Set a single field value */
  setField: <K extends keyof RegisterFormData>(field: K, value: string) => void;
  /** Set all errors */
  setErrors: React.Dispatch<React.SetStateAction<RegisterFormErrors>>;
  /** Set email suggestion */
  setEmailSuggestion: React.Dispatch<React.SetStateAction<string | null>>;
  /** Validate all fields, returns true if valid */
  validateForm: () => boolean;
  /** Reset form to initial state */
  resetForm: () => void;
  /** Apply email suggestion */
  applySuggestion: () => void;
}

const initialFormData: RegisterFormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  registrationCode: '',
};

export function useRegisterForm(): UseRegisterFormReturn {
  const [formData, setFormData] = useState<RegisterFormData>(initialFormData);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof RegisterFormData>(
    field: K,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: RegisterFormErrors = {};

    // Name validation
    const trimmedName = formData.name.trim();
    if (trimmedName.length < 2) {
      newErrors.name = 'Name muss mindestens 2 Zeichen haben.';
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Name darf maximal 100 Zeichen haben.';
    }

    // Enhanced email validation
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error;
      // Store suggestion for typo correction
      if (emailValidation.suggestion) {
        setEmailSuggestion(emailValidation.suggestion);
      } else {
        setEmailSuggestion(null);
      }
    } else {
      setEmailSuggestion(null);
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Passwort ist erforderlich';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Passwort muss mindestens 6 Zeichen haben';
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwörter stimmen nicht überein';
    }

    // Registration code validation (case-insensitive)
    const expectedCode = import.meta.env.VITE_REGISTRATION_CODE as string | undefined;
    const providedCode = formData.registrationCode.trim().toLowerCase();
    const expectedCodeNormalized = expectedCode?.trim().toLowerCase();

    if (expectedCodeNormalized && providedCode !== expectedCodeNormalized) {
      newErrors.registrationCode = 'Ungültiger Einladungscode';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setEmailSuggestion(null);
  }, []);

  const applySuggestion = useCallback(() => {
    if (emailSuggestion) {
      setFormData(prev => ({ ...prev, email: emailSuggestion }));
      setEmailSuggestion(null);
      // Clear email error since we're applying the suggestion
      setErrors(prev => {
        const { email: _, ...rest } = prev;
        return rest;
      });
    }
  }, [emailSuggestion]);

  return {
    formData,
    errors,
    emailSuggestion,
    setField,
    setErrors,
    setEmailSuggestion,
    validateForm,
    resetForm,
    applySuggestion,
  };
}
