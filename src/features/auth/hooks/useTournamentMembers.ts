/**
 * useTournamentMembers - Hook für Turnier-Mitglieder-Verwaltung
 *
 * Lädt und verwaltet Mitglieder eines Turniers.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.5
 */

import { useState, useCallback, useMemo } from 'react';
import type { TournamentMembership, TournamentRole, User } from '../types/auth.types';
import {
  getTournamentMembers,
  changeRole,
  updateTrainerTeams,
  removeMember,
  transferOwnership,
  getCoAdmins,
} from '../services/membershipService';
import { getUserById } from '../services/authService';
import { useAuth } from './useAuth';
import { canChangeRole, canSetRoleTo, canTransferOwnership } from '../utils/permissions';

// ============================================
// TYPES
// ============================================

export interface MemberWithUser {
  membership: TournamentMembership;
  user: User | null;
}

export interface UseTournamentMembersReturn {
  // Data
  members: MemberWithUser[];
  coAdmins: TournamentMembership[];
  myMembership: TournamentMembership | null;

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => void;
  setRole: (membershipId: string, newRole: TournamentRole, teamIds?: string[]) => boolean;
  setTrainerTeams: (membershipId: string, teamIds: string[]) => boolean;
  remove: (membershipId: string) => boolean;
  transfer: (newOwnerId: string) => boolean;

  // Permission checks
  canEditMember: (targetMembership: TournamentMembership) => boolean;
  canSetRole: (targetMembership: TournamentMembership, newRole: TournamentRole) => boolean;
  canTransfer: () => boolean;

  // Clear error
  clearError: () => void;
}

// ============================================
// HOOK
// ============================================

export const useTournamentMembers = (tournamentId: string): UseTournamentMembersReturn => {
  const { user } = useAuth();
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Lädt alle Mitglieder mit User-Daten
   */
  const members = useMemo((): MemberWithUser[] => {
    if (!tournamentId) {
      return [];
    }

    const memberships = getTournamentMembers(tournamentId);
    return memberships.map((membership) => ({
      membership,
      user: getUserById(membership.userId),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, refreshCounter]);

  /**
   * Lädt alle Co-Admins
   */
  const coAdmins = useMemo((): TournamentMembership[] => {
    if (!tournamentId) {
      return [];
    }
    return getCoAdmins(tournamentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, refreshCounter]);

  /**
   * Eigene Membership
   */
  const myMembership = useMemo((): TournamentMembership | null => {
    if (!user) {
      return null;
    }
    const found = members.find((m) => m.membership.userId === user.id);
    return found?.membership ?? null;
  }, [members, user]);

  /**
   * Aktualisiert die Mitglieder-Liste
   */
  const refresh = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  /**
   * Ändert die Rolle eines Mitglieds
   */
  const setRole = useCallback(
    (membershipId: string, newRole: TournamentRole, teamIds?: string[]): boolean => {
      setIsLoading(true);
      setError(null);

      try {
        const result = changeRole(membershipId, newRole, teamIds);
        if (!result.success) {
          setError(result.error ?? 'Rolle konnte nicht geändert werden');
          return false;
        }
        refresh();
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh]
  );

  /**
   * Aktualisiert die Team-Zuordnungen eines Trainers
   */
  const setTrainerTeams = useCallback(
    (membershipId: string, teamIds: string[]): boolean => {
      setIsLoading(true);
      setError(null);

      try {
        const result = updateTrainerTeams(membershipId, teamIds);
        if (!result.success) {
          setError(result.error ?? 'Teams konnten nicht aktualisiert werden');
          return false;
        }
        refresh();
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh]
  );

  /**
   * Entfernt ein Mitglied
   */
  const remove = useCallback(
    (membershipId: string): boolean => {
      setIsLoading(true);
      setError(null);

      try {
        const success = removeMember(membershipId);
        if (!success) {
          setError('Mitglied konnte nicht entfernt werden');
          return false;
        }
        refresh();
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh]
  );

  /**
   * Überträgt Ownership
   */
  const transfer = useCallback(
    (newOwnerId: string): boolean => {
      setIsLoading(true);
      setError(null);

      try {
        const result = transferOwnership(tournamentId, newOwnerId);
        if (!result.success) {
          setError(result.error ?? 'Ownership konnte nicht übertragen werden');
          return false;
        }
        refresh();
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    [tournamentId, refresh]
  );

  /**
   * Prüft ob das aktuelle Mitglied ein anderes bearbeiten kann
   */
  const canEditMember = useCallback(
    (targetMembership: TournamentMembership): boolean => {
      if (!myMembership) {
        return false;
      }
      return canChangeRole(myMembership.role, targetMembership.role);
    },
    [myMembership]
  );

  /**
   * Prüft ob eine bestimmte Rolle vergeben werden kann
   */
  const canSetRole = useCallback(
    (targetMembership: TournamentMembership, newRole: TournamentRole): boolean => {
      if (!myMembership) {
        return false;
      }
      return canSetRoleTo(myMembership.role, targetMembership.role, newRole);
    },
    [myMembership]
  );

  /**
   * Prüft ob Ownership übertragen werden kann
   */
  const canTransfer = useCallback((): boolean => {
    if (!myMembership) {
      return false;
    }
    return canTransferOwnership(myMembership.role);
  }, [myMembership]);

  /**
   * Löscht den Fehlerzustand
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    members,
    coAdmins,
    myMembership,
    isLoading,
    error,
    refresh,
    setRole,
    setTrainerTeams,
    remove,
    transfer,
    canEditMember,
    canSetRole,
    canTransfer,
    clearError,
  };
};
