/**
 * useInvitation - Hook für Einladungs-Handling (Supabase)
 *
 * Validiert und akzeptiert Einladungen.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.3
 */

import { useState, useCallback } from 'react';
import type { Invitation } from '../types/auth.types';
import {
  validateInvitation,
  acceptInvitation,
  createInvitation,
  deactivateInvitation,
  getActiveInvitationsForTournament,
  type InvitationValidationResult,
  type AcceptInvitationResult,
  type CreateInvitationResult,
  type CreateInvitationOptions,
} from '../services/invitationService';
import { useAuth } from './useAuth';

// ============================================
// TYPES
// ============================================

export interface UseInvitationReturn {
  // State
  isLoading: boolean;
  error: string | null;

  // Validation (async)
  validateToken: (token: string) => Promise<InvitationValidationResult>;

  // Accept (async)
  acceptToken: (token: string) => Promise<AcceptInvitationResult>;

  // Create (for admins, async)
  createNewInvitation: (options: Omit<CreateInvitationOptions, 'createdBy'>) => Promise<CreateInvitationResult>;

  // Manage (async)
  deactivate: (invitationId: string) => Promise<boolean>;
  getActiveInvitations: (tournamentId: string) => Promise<Invitation[]>;

  // Clear error
  clearError: () => void;
}

// ============================================
// HOOK
// ============================================

export const useInvitation = (): UseInvitationReturn => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validiert einen Einladungs-Token
   */
  const validateToken = useCallback(
    async (token: string): Promise<InvitationValidationResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await validateInvitation(token);
        if (!result.valid) {
          setError(result.error ?? 'Ungültige Einladung');
        }
        return result;
      } catch (err) {
        if (import.meta.env.DEV) { console.error('Error validating token:', err); }
        setError('Ein unerwarteter Fehler ist aufgetreten');
        return { valid: false, error: 'not_found' };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Akzeptiert eine Einladung
   */
  const acceptToken = useCallback(
    async (token: string): Promise<AcceptInvitationResult> => {
      if (!user) {
        return { success: false, error: 'Nicht angemeldet' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await acceptInvitation(token, user.id);
        if (!result.success) {
          setError(result.error ?? 'Fehler beim Annehmen der Einladung');
        }
        return result;
      } catch (err) {
        if (import.meta.env.DEV) { console.error('Error accepting invitation:', err); }
        setError('Ein unerwarteter Fehler ist aufgetreten');
        return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  /**
   * Erstellt eine neue Einladung (für Admins)
   */
  const createNewInvitation = useCallback(
    async (options: Omit<CreateInvitationOptions, 'createdBy'>): Promise<CreateInvitationResult> => {
      if (!user) {
        return { success: false, error: 'Nicht angemeldet' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await createInvitation({
          ...options,
          createdBy: user.id,
        }, user);
        if (!result.success) {
          setError(result.error ?? 'Fehler beim Erstellen der Einladung');
        }
        return result;
      } catch (err) {
        if (import.meta.env.DEV) { console.error('Error creating invitation:', err); }
        setError('Ein unerwarteter Fehler ist aufgetreten');
        return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  /**
   * Deaktiviert eine Einladung
   */
  const deactivate = useCallback(async (invitationId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await deactivateInvitation(invitationId);
      if (!success) {
        setError('Einladung konnte nicht deaktiviert werden');
      }
      return success;
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Error deactivating invitation:', err); }
      setError('Ein unerwarteter Fehler ist aufgetreten');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Lädt aktive Einladungen für ein Turnier
   */
  const getActiveInvitations = useCallback(async (tournamentId: string): Promise<Invitation[]> => {
    try {
      return await getActiveInvitationsForTournament(tournamentId);
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Error getting active invitations:', err); }
      return [];
    }
  }, []);

  /**
   * Löscht den Fehlerzustand
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    validateToken,
    acceptToken,
    createNewInvitation,
    deactivate,
    getActiveInvitations,
    clearError,
  };
};
