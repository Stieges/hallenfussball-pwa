/**
 * Registration Code Validation Utility
 *
 * Client-side wrapper for server-side registration code validation.
 * Calls Supabase Edge Function to validate codes without exposing them in client bundle.
 *
 * @see supabase/functions/validate-registration-code/index.ts
 * @see docs/roadmap/P0-IMPLEMENTATION-PLAN.md#p0-1
 */

import { supabase } from '../../../lib/supabase';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a registration code via Supabase Edge Function
 *
 * @param code - The registration code to validate
 * @returns Promise resolving to validation result
 *
 * @example
 * ```typescript
 * const result = await validateRegistrationCode('abc123');
 * if (result.valid) {
 *   // Proceed with registration
 * } else {
 *   // Show error: result.error
 * }
 * ```
 */
export async function validateRegistrationCode(code: string): Promise<ValidationResult> {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      console.error('Supabase not configured');
      return {
        valid: false,
        error: 'Cloud-Validierung nicht verfügbar. Bitte prüfe deine Internetverbindung.',
      };
    }

    // Call Edge Function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await supabase.functions.invoke<ValidationResult>(
      'validate-registration-code',
      {
        body: { code },
      }
    );

    if (error) {
      console.error('Edge Function error:', error);
      return {
        valid: false,
        error: 'Validierung fehlgeschlagen. Bitte versuche es erneut.',
      };
    }

    if (!data) {
      return {
        valid: false,
        error: 'Keine Antwort vom Server erhalten.',
      };
    }

    return data;
  } catch (error) {
    console.error('Unexpected error validating registration code:', error);
    return {
      valid: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }
}
