/**
 * Membership Service - Turnier-Mitgliedschafts-Verwaltung (Supabase)
 *
 * Verwaltet User-Rollen in Turnieren über die tournament_collaborators Tabelle.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.5
 */

import type { TournamentMembership, TournamentRole } from '../types/auth.types';
import { canChangeRole, canSetRoleTo, canTransferOwnership } from '../utils/permissions';
// getCurrentUser removed - userId now passed as parameter
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// ============================================
// TYPES
// ============================================

export interface ChangeRoleResult {
  success: boolean;
  membership?: TournamentMembership;
  error?: string;
}

export interface TransferOwnershipResult {
  success: boolean;
  oldOwnerMembership?: TournamentMembership;
  newOwnerMembership?: TournamentMembership;
  error?: string;
}

// ============================================
// DATABASE TYPES (from Supabase)
// ============================================

interface CollaboratorRow {
  id: string;
  tournament_id: string;
  user_id: string | null;
  invite_email: string | null;
  invite_code: string | null;
  role: string;
  team_ids: string[] | null;
  label: string | null;
  max_uses: number | null;
  use_count: number | null;
  expires_at: string | null;
  invited_at: string | null;
  invited_by: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_at: string | null;
  allowed_fields: number[] | null;
  allowed_groups: string[] | null;
}

// ============================================
// MAPPER FUNCTIONS
// ============================================

/**
 * Maps DB row to Membership type
 */
function mapRowToMembership(row: CollaboratorRow): TournamentMembership {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    tournamentId: row.tournament_id,
    role: row.role as TournamentRole,
    teamIds: row.team_ids ?? [],
    invitedBy: row.invited_by ?? undefined,
    invitedAt: row.invited_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.created_at ?? new Date().toISOString(),
  };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Erstellt eine Owner-Membership für ein neues Turnier
 *
 * @param tournamentId - ID des Turniers
 * @param userId - ID des Erstellers
 * @returns Die erstellte Membership oder undefined
 */
export const createOwnerMembership = async (
  tournamentId: string,
  userId: string
): Promise<TournamentMembership | undefined> => {
  if (!isSupabaseConfigured || !supabase) {
    console.error('Supabase is not configured');
    return undefined;
  }

  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .insert({
        tournament_id: tournamentId,
        user_id: userId,
        role: 'owner',
        team_ids: [],
        created_at: now,
        accepted_at: now, // Owner is automatically accepted
      })
      .select()
      .single();

    if (error) {
      console.error('Create owner membership error:', error);
      return undefined;
    }

    return mapRowToMembership(data as CollaboratorRow);
  } catch (err) {
    console.error('Create owner membership error:', err);
    return undefined;
  }
};

/**
 * Lädt alle Mitglieder eines Turniers (nur akzeptierte)
 *
 * @param tournamentId - Turnier-ID
 * @returns Array von Memberships
 */
export const getTournamentMembers = async (tournamentId: string): Promise<TournamentMembership[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('tournament_id', tournamentId)
      .not('user_id', 'is', null) // Only accepted members (have user_id)
      .is('declined_at', null); // Not declined

     
    if (error || !data) {
      console.error('Get tournament members error:', error);
      return [];
    }

    return (data as CollaboratorRow[]).map(mapRowToMembership);
  } catch (err) {
    console.error('Get tournament members error:', err);
    return [];
  }
};

/**
 * Lädt die Membership eines Users in einem Turnier
 *
 * @param tournamentId - Turnier-ID
 * @param userId - User-ID
 * @returns Membership oder undefined
 */
export const getUserMembership = async (
  tournamentId: string,
  userId: string
): Promise<TournamentMembership | undefined> => {
  if (!isSupabaseConfigured || !supabase) {
    return undefined;
  }

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .is('declined_at', null)
      .single();

     
    if (error || !data) {
      return undefined;
    }

    return mapRowToMembership(data as CollaboratorRow);
  } catch {
    return undefined;
  }
};

/**
 * Ändert die Rolle eines Mitglieds
 *
 * @param membershipId - ID der Membership
 * @param newRole - Neue Rolle
 * @param newTeamIds - Neue Team-Zuordnungen (für Trainer)
 * @returns Ergebnis
 */
export const changeRole = async (
  membershipId: string,
  newRole: TournamentRole,
  userId: string,
  newTeamIds?: string[]
): Promise<ChangeRoleResult> => {
  if (!userId) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud-Funktionen sind nicht verfügbar' };
  }

  try {
    // Get target membership
    const { data: targetData, error: targetError } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('id', membershipId)
      .single();

     
    if (targetError || !targetData) {
      return { success: false, error: 'Mitglied nicht gefunden' };
    }

    const targetMembership = mapRowToMembership(targetData as CollaboratorRow);

    // Get my membership in the same tournament
    const myMembership = await getUserMembership(targetMembership.tournamentId, userId);

    if (!myMembership) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Permission checks
    if (!canChangeRole(myMembership.role, targetMembership.role)) {
      return { success: false, error: 'Keine Berechtigung für diese Aktion' };
    }

    if (!canSetRoleTo(myMembership.role, targetMembership.role, newRole)) {
      return { success: false, error: 'Diese Rolle kann nicht vergeben werden' };
    }

    // Update role
    const { data: updatedData, error: updateError } = await supabase
      .from('tournament_collaborators')
      .update({
        role: newRole,
        team_ids: newRole === 'trainer' ? (newTeamIds ?? targetMembership.teamIds) : [],
      })
      .eq('id', membershipId)
      .select()
      .single();

    if (updateError) {
      console.error('Change role error:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, membership: mapRowToMembership(updatedData as CollaboratorRow) };
  } catch (err) {
    console.error('Change role error:', err);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
  }
};

/**
 * Aktualisiert die Team-Zuordnungen eines Trainers
 *
 * @param membershipId - ID der Membership
 * @param teamIds - Neue Team-IDs
 * @returns Ergebnis
 */
export const updateTrainerTeams = async (
  membershipId: string,
  teamIds: string[],
  userId: string
): Promise<ChangeRoleResult> => {
  if (!userId) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud-Funktionen sind nicht verfügbar' };
  }

  try {
    // Get target membership
    const { data: targetData, error: targetError } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('id', membershipId)
      .single();

     
    if (targetError || !targetData) {
      return { success: false, error: 'Mitglied nicht gefunden' };
    }

    const targetMembership = mapRowToMembership(targetData as CollaboratorRow);

    if (targetMembership.role !== 'trainer') {
      return { success: false, error: 'Nur Trainer haben Team-Zuordnungen' };
    }

    // Get my membership
    const myMembership = await getUserMembership(targetMembership.tournamentId, userId);

    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'co-admin')) {
      return { success: false, error: 'Keine Berechtigung' };
    }

    // Update team assignments
    // Note: team_ids exists in DB but Supabase types may be out of sync
    const { data: updatedData, error: updateError } = await supabase
      .from('tournament_collaborators')
      .update({ team_ids: teamIds } as Record<string, unknown>)
      .eq('id', membershipId)
      .select()
      .single();

    if (updateError) {
      console.error('Update trainer teams error:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, membership: mapRowToMembership(updatedData as CollaboratorRow) };
  } catch (err) {
    console.error('Update trainer teams error:', err);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
  }
};

/**
 * Entfernt ein Mitglied aus dem Turnier
 *
 * @param membershipId - ID der Membership
 * @returns true wenn erfolgreich
 */
export const removeMember = async (membershipId: string, userId: string): Promise<boolean> => {
  if (!userId) {
    return false;
  }

  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    // Get target membership
    const { data: targetData, error: targetError } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('id', membershipId)
      .single();

     
    if (targetError || !targetData) {
      return false;
    }

    const targetMembership = mapRowToMembership(targetData as CollaboratorRow);

    // Owner cannot be removed
    if (targetMembership.role === 'owner') {
      return false;
    }

    // Get my membership
    const myMembership = await getUserMembership(targetMembership.tournamentId, userId);

    if (!myMembership) {
      return false;
    }

    // Permission check
    if (!canChangeRole(myMembership.role, targetMembership.role)) {
      return false;
    }

    // Delete the membership
    const { error: deleteError } = await supabase
      .from('tournament_collaborators')
      .delete()
      .eq('id', membershipId);

    return !deleteError;
  } catch {
    return false;
  }
};

/**
 * Überträgt Ownership an einen Co-Admin
 *
 * @param tournamentId - Turnier-ID
 * @param newOwnerId - User-ID des neuen Owners
 * @returns Ergebnis
 */
export const transferOwnership = async (
  tournamentId: string,
  newOwnerId: string,
  userId: string
): Promise<TransferOwnershipResult> => {
  if (!userId) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud-Funktionen sind nicht verfügbar' };
  }

  try {
    // Get my membership (must be owner)
    const myMembership = await getUserMembership(tournamentId, userId);

    if (!myMembership) {
      return { success: false, error: 'Nicht Mitglied dieses Turniers' };
    }

    if (!canTransferOwnership(myMembership.role)) {
      return { success: false, error: 'Nur der Owner kann Ownership übertragen' };
    }

    // Get new owner's membership
    const newOwnerMembership = await getUserMembership(tournamentId, newOwnerId);

    if (!newOwnerMembership) {
      return { success: false, error: 'Ziel-User ist nicht Mitglied' };
    }

    if (newOwnerMembership.role !== 'co-admin') {
      return { success: false, error: 'Ownership kann nur an Co-Admins übertragen werden' };
    }

    // Use a transaction-like approach: update both in sequence
    // Old owner becomes co-admin
    const { data: oldOwnerData, error: oldOwnerError } = await supabase
      .from('tournament_collaborators')
      .update({ role: 'co-admin' })
      .eq('id', myMembership.id)
      .select()
      .single();

    if (oldOwnerError) {
      console.error('Transfer ownership error (old owner):', oldOwnerError);
      return { success: false, error: oldOwnerError.message };
    }

    // New owner becomes owner
    const { data: newOwnerData, error: newOwnerError } = await supabase
      .from('tournament_collaborators')
      .update({ role: 'owner' })
      .eq('id', newOwnerMembership.id)
      .select()
      .single();

    if (newOwnerError) {
      // Try to rollback old owner change
      await supabase
        .from('tournament_collaborators')
        .update({ role: 'owner' })
        .eq('id', myMembership.id);

      console.error('Transfer ownership error (new owner):', newOwnerError);
      return { success: false, error: newOwnerError.message };
    }

    return {
      success: true,
      oldOwnerMembership: mapRowToMembership(oldOwnerData as CollaboratorRow),
      newOwnerMembership: mapRowToMembership(newOwnerData as CollaboratorRow),
    };
  } catch (err) {
    console.error('Transfer ownership error:', err);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
  }
};

/**
 * Gibt alle Co-Admins eines Turniers zurück
 *
 * @param tournamentId - Turnier-ID
 * @returns Array von Co-Admin Memberships
 */
export const getCoAdmins = async (tournamentId: string): Promise<TournamentMembership[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('role', 'co-admin')
      .not('user_id', 'is', null);

     
    if (error || !data) {
      return [];
    }

    return (data as CollaboratorRow[]).map(mapRowToMembership);
  } catch {
    return [];
  }
};

