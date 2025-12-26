/**
 * usePermissions Hook
 *
 * Prüft Berechtigungen basierend auf der Benutzerrolle.
 * Aktuell: Organisator hat immer alle Rechte (keine Invite-System implementiert)
 * Zukunft: Prüft gegen AcceptedInvite aus localStorage
 */

import { useMemo } from 'react';

/**
 * Available permissions in the system
 */
export type Permission =
  | 'view_schedule'
  | 'control_timer'
  | 'control_timer_own_field'
  | 'enter_score'
  | 'enter_score_own_field'
  | 'enter_score_all_fields'
  | 'assign_referees'
  | 'correct_results'
  | 'edit_tournament'
  | 'delete_tournament'
  | 'invite_helpers';

/**
 * User roles with their permissions
 */
export type UserRole =
  | 'organizer'   // Turnier-Ersteller - alle Rechte
  | 'admin'       // Vollzugriff
  | 'manager'     // Spielleiter
  | 'scorekeeper' // Schreiber
  | 'timekeeper'; // Zeitnehmer

/**
 * Permission mapping per role
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  organizer: [
    'view_schedule',
    'control_timer',
    'enter_score',
    'enter_score_all_fields',
    'assign_referees',
    'correct_results',
    'edit_tournament',
    'delete_tournament',
    'invite_helpers',
  ],
  admin: [
    'view_schedule',
    'control_timer',
    'enter_score',
    'enter_score_all_fields',
    'assign_referees',
    'correct_results',
    'edit_tournament',
    'invite_helpers',
  ],
  manager: [
    'view_schedule',
    'control_timer',
    'enter_score',
    'enter_score_all_fields',
    'assign_referees',
    'correct_results',
  ],
  scorekeeper: [
    'view_schedule',
    'enter_score',
    'enter_score_all_fields',
  ],
  timekeeper: [
    'view_schedule',
    'control_timer_own_field',
    'enter_score_own_field',
  ],
};

/**
 * Get current user role for a tournament
 * Currently returns 'organizer' as default (no invite system yet)
 */
function getCurrentRole(_tournamentId: string): UserRole {
  // TODO: When invite system is implemented, check localStorage for AcceptedInvite
  // const invites = localStorage.getItem('acceptedInvites');
  // if (invites) {
  //   const parsed = JSON.parse(invites);
  //   const invite = parsed.find((i: any) => i.tournamentId === tournamentId);
  //   if (invite) return invite.role as UserRole;
  // }

  // Default: User is the organizer (created the tournament locally)
  return 'organizer';
}

/**
 * Hook to check permissions for a tournament
 */
export function usePermissions(tournamentId: string) {
  const role = useMemo(() => getCurrentRole(tournamentId), [tournamentId]);
  const permissions = useMemo(() => ROLE_PERMISSIONS[role], [role]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  /**
   * Check if user can correct results
   */
  const canCorrectResults = useMemo(
    () => permissions.includes('correct_results'),
    [permissions]
  );

  /**
   * Check if user can enter scores (any field)
   */
  const canEnterScores = useMemo(
    () => permissions.includes('enter_score') || permissions.includes('enter_score_all_fields'),
    [permissions]
  );

  /**
   * Check if user can assign referees
   */
  const canAssignReferees = useMemo(
    () => permissions.includes('assign_referees'),
    [permissions]
  );

  /**
   * Check if user can edit tournament settings
   */
  const canEditTournament = useMemo(
    () => permissions.includes('edit_tournament'),
    [permissions]
  );

  return {
    role,
    permissions,
    hasPermission,
    canCorrectResults,
    canEnterScores,
    canAssignReferees,
    canEditTournament,
  };
}

/**
 * Standalone function to check permission (without React hooks)
 */
export function checkPermission(tournamentId: string, permission: Permission): boolean {
  const role = getCurrentRole(tournamentId);
  return ROLE_PERMISSIONS[role].includes(permission);
}
