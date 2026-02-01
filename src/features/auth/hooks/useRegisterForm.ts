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
import { AUTH_ERRORS } from '../constants';

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

export type RegisterFormField = keyof RegisterFormData;

export interface UseRegisterFormReturn {
  /** Form field values */
  formData: RegisterFormData;
  /** Validation errors */
  errors: RegisterFormErrors;
  /** Which fields have been blurred at least once */
  touched: Record<RegisterFormField, boolean>;
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
  /** Validate a single field (client-side only) */
  validateField: (field: RegisterFormField) => void;
  /** Handle blur event — marks field as touched and validates it */
  handleBlur: (field: RegisterFormField) => void;
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

const initialTouched: Record<RegisterFormField, boolean> = {
  name: false,
  email: false,
  password: false,
  confirmPassword: false,
  registrationCode: false,
};

export function useRegisterForm(): UseRegisterFormReturn {
  const [formData, setFormData] = useState<RegisterFormData>(initialFormData);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [touched, setTouched] = useState<Record<RegisterFormField, boolean>>(initialTouched);
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
      newErrors.name = AUTH_ERRORS.NAME_TOO_SHORT;
    } else if (trimmedName.length > 100) {
      newErrors.name = AUTH_ERRORS.NAME_TOO_LONG;
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
      newErrors.password = AUTH_ERRORS.PASSWORD_REQUIRED;
    } else if (formData.password.length < 6) {
      newErrors.password = AUTH_ERRORS.PASSWORD_TOO_SHORT;
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = AUTH_ERRORS.PASSWORD_MISMATCH;
    }

    // Registration code validation (case-insensitive)
    const expectedCode = import.meta.env.VITE_REGISTRATION_CODE as string | undefined;
    const providedCode = formData.registrationCode.trim().toLowerCase();
    const expectedCodeNormalized = expectedCode?.trim().toLowerCase();

    if (expectedCodeNormalized && providedCode !== expectedCodeNormalized) {
      newErrors.registrationCode = AUTH_ERRORS.REGISTRATION_CODE_INVALID;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const validateField = useCallback((field: RegisterFormField) => {
    setErrors(prev => {
      const updated = { ...prev };

      switch (field) {
        case 'name': {
          const trimmedName = formData.name.trim();
          if (trimmedName.length < 2) {
            updated.name = AUTH_ERRORS.NAME_TOO_SHORT;
          } else if (trimmedName.length > 100) {
            updated.name = AUTH_ERRORS.NAME_TOO_LONG;
          } else {
            delete updated.name;
          }
          break;
        }
        case 'email': {
          const emailValidation = validateEmail(formData.email);
          if (!emailValidation.isValid) {
            updated.email = emailValidation.error;
            if (emailValidation.suggestion) {
              setEmailSuggestion(emailValidation.suggestion);
            }
          } else {
            delete updated.email;
            setEmailSuggestion(null);
          }
          break;
        }
        case 'password': {
          if (!formData.password) {
            updated.password = AUTH_ERRORS.PASSWORD_REQUIRED;
          } else if (formData.password.length < 6) {
            updated.password = AUTH_ERRORS.PASSWORD_TOO_SHORT;
          } else {
            delete updated.password;
          }
          break;
        }
        case 'confirmPassword': {
          if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
            updated.confirmPassword = AUTH_ERRORS.PASSWORD_MISMATCH;
          } else {
            delete updated.confirmPassword;
          }
          break;
        }
        case 'registrationCode': {
          // Only validate presence on blur — server-side validation happens on submit
          if (!formData.registrationCode.trim()) {
            updated.registrationCode = AUTH_ERRORS.REGISTRATION_CODE_REQUIRED;
          } else {
            delete updated.registrationCode;
          }
          break;
        }
      }

      return updated;
    });
  }, [formData]);

  const handleBlur = useCallback((field: RegisterFormField) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field);
  }, [validateField]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setTouched(initialTouched);
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
    touched,
    emailSuggestion,
    setField,
    setErrors,
    setEmailSuggestion,
    validateForm,
    validateField,
    handleBlur,
    resetForm,
    applySuggestion,
  };
}
