/**
 * useInvitation - Hook für Einladungs-Handling
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

  // Validation
  validateToken: (token: string) => InvitationValidationResult;

  // Accept
  acceptToken: (token: string) => AcceptInvitationResult;

  // Create (for admins)
  createNewInvitation: (options: Omit<CreateInvitationOptions, 'createdBy'>) => CreateInvitationResult;

  // Manage
  deactivate: (invitationId: string) => boolean;
  getActiveInvitations: (tournamentId: string) => Invitation[];

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
    (token: string): InvitationValidationResult => {
      setIsLoading(true);
      setError(null);

      try {
        const result: InvitationValidationResult = validateInvitation(token);
        if (!result.valid) {
          setError(result.error ?? 'Ungültige Einladung');
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Akzeptiert eine Einladung
   */
  const acceptToken = useCallback((token: string): AcceptInvitationResult => {
    if (!user) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = acceptInvitation(token, user.id);
      if (!result.success) {
        setError(result.error ?? 'Fehler beim Annehmen der Einladung');
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Erstellt eine neue Einladung (für Admins)
   */
  const createNewInvitation = useCallback(
    (options: Omit<CreateInvitationOptions, 'createdBy'>): CreateInvitationResult => {
      if (!user) {
        return { success: false, error: 'Nicht angemeldet' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const result: CreateInvitationResult = createInvitation({
          ...options,
          createdBy: user.id,
        });
        if (!result.success) {
          setError(result.error ?? 'Fehler beim Erstellen der Einladung');
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  /**
   * Deaktiviert eine Einladung
   */
  const deactivate = useCallback((invitationId: string): boolean => {
    setIsLoading(true);
    setError(null);

    try {
      const success = deactivateInvitation(invitationId);
      if (!success) {
        setError('Einladung konnte nicht deaktiviert werden');
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Lädt aktive Einladungen für ein Turnier
   */
  const getActiveInvitations = useCallback((tournamentId: string): Invitation[] => {
    return getActiveInvitationsForTournament(tournamentId);
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
