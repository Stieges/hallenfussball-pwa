/**
 * useTournamentMembers - Hook für Turnier-Mitglieder-Verwaltung (Supabase)
 *
 * Lädt und verwaltet Mitglieder eines Turniers.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.5
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { TournamentMembership, TournamentRole, User } from '../types/auth.types';
import {
  getTournamentMembers,
  changeRole,
  updateTrainerTeams,
  removeMember,
  transferOwnership,
  getCoAdmins,
} from '../services/membershipService';
import { getUserById } from '../utils/authHelpers';
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

  // Actions (all async now)
  refresh: () => Promise<void>;
  setRole: (membershipId: string, newRole: TournamentRole, teamIds?: string[]) => Promise<boolean>;
  setTrainerTeams: (membershipId: string, teamIds: string[]) => Promise<boolean>;
  remove: (membershipId: string) => Promise<boolean>;
  transfer: (newOwnerId: string) => Promise<boolean>;

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
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [coAdmins, setCoAdmins] = useState<TournamentMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Lädt alle Mitglieder mit User-Daten
   */
  const loadMembers = useCallback(async () => {
    if (!tournamentId) {
      setMembers([]);
      setCoAdmins([]);
      return;
    }

    setIsLoading(true);
    try {
      const [memberships, coAdminList] = await Promise.all([
        getTournamentMembers(tournamentId),
        getCoAdmins(tournamentId),
      ]);

      const membersWithUsers: MemberWithUser[] = memberships.map((membership) => ({
        membership,
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- BC for localStorage users until Supabase migration
        user: getUserById(membership.userId),
      }));

      setMembers(membersWithUsers);
      setCoAdmins(coAdminList);
    } catch (err) {
      if (import.meta.env.DEV) { console.error('Error loading members:', err); }
      setError('Mitglieder konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  // Load members on mount and when tournamentId changes
  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

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
  const refresh = useCallback(async () => {
    await loadMembers();
  }, [loadMembers]);

  /**
   * Ändert die Rolle eines Mitglieds
   */
  const setRoleAsync = useCallback(
    async (membershipId: string, newRole: TournamentRole, teamIds?: string[]): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await changeRole(membershipId, newRole, user?.id ?? '', teamIds);
        if (!result.success) {
          setError(result.error ?? 'Rolle konnte nicht geändert werden');
          return false;
        }
        await refresh();
        return true;
      } catch (err) {
        if (import.meta.env.DEV) { console.error('Error changing role:', err); }
        setError('Ein unerwarteter Fehler ist aufgetreten');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh, user?.id]
  );

  /**
   * Aktualisiert die Team-Zuordnungen eines Trainers
   */
  const setTrainerTeamsAsync = useCallback(
    async (membershipId: string, teamIds: string[]): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await updateTrainerTeams(membershipId, teamIds, user?.id ?? '');
        if (!result.success) {
          setError(result.error ?? 'Teams konnten nicht aktualisiert werden');
          return false;
        }
        await refresh();
        return true;
      } catch (err) {
        if (import.meta.env.DEV) { console.error('Error updating trainer teams:', err); }
        setError('Ein unerwarteter Fehler ist aufgetreten');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh, user?.id]
  );

  /**
   * Entfernt ein Mitglied
   */
  const removeAsync = useCallback(
    async (membershipId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const success = await removeMember(membershipId, user?.id ?? '');
        if (!success) {
          setError('Mitglied konnte nicht entfernt werden');
          return false;
        }
        await refresh();
        return true;
      } catch (err) {
        if (import.meta.env.DEV) { console.error('Error removing member:', err); }
        setError('Ein unerwarteter Fehler ist aufgetreten');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refresh, user?.id]
  );

  /**
   * Überträgt Ownership
   */
  const transferAsync = useCallback(
    async (newOwnerId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await transferOwnership(tournamentId, newOwnerId, user?.id ?? '');
        if (!result.success) {
          setError(result.error ?? 'Ownership konnte nicht übertragen werden');
          return false;
        }
        await refresh();
        return true;
      } catch (err) {
        if (import.meta.env.DEV) { console.error('Error transferring ownership:', err); }
        setError('Ein unerwarteter Fehler ist aufgetreten');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [tournamentId, refresh, user?.id]
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
  const canSetRoleCheck = useCallback(
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
  const canTransferCheck = useCallback((): boolean => {
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
    setRole: setRoleAsync,
    setTrainerTeams: setTrainerTeamsAsync,
    remove: removeAsync,
    transfer: transferAsync,
    canEditMember,
    canSetRole: canSetRoleCheck,
    canTransfer: canTransferCheck,
    clearError,
  };
};
