/**
 * Invitation Service - Einladungs-Verwaltung (Supabase)
 *
 * Verwaltet Token-basierte Einladungen zu Turnieren.
 * Nutzt die tournament_collaborators Tabelle in Supabase.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.3
 */

import type {
  Invitation,
  TournamentRole,
  TournamentMembership,
  InvitationValidationResult,
} from '../types/auth.types';
// Re-export for consumers
export type { InvitationValidationResult } from '../types/auth.types';
import { generateToken } from '../utils/tokenGenerator';
import { getCurrentUser } from './authService';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// ============================================
// TYPES
// ============================================

/**
 * Einladungs-Erstellungs-Optionen
 */
export interface CreateInvitationOptions {
  /** Turnier-ID */
  tournamentId: string;
  /** Zu vergebende Rolle */
  role: TournamentRole;
  /** Ersteller-ID */
  createdBy: string;
  /** Vorab-Zuordnung für Trainer */
  teamIds?: string[];
  /** Optionales Label */
  label?: string;
  /** Gültigkeitsdauer in Tagen */
  expiresInDays?: number;
  /** Maximale Verwendungen (0 = unbegrenzt) */
  maxUses?: number;
}

/**
 * Ergebnis der Einladungs-Erstellung
 */
export interface CreateInvitationResult {
  success: boolean;
  invitation?: Invitation;
  inviteLink?: string;
  error?: string;
}

/**
 * Ergebnis der Einladungs-Annahme
 */
export interface AcceptInvitationResult {
  success: boolean;
  membership?: TournamentMembership;
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
 * Maps DB row to Invitation type
 */
function mapRowToInvitation(row: CollaboratorRow): Invitation {
  return {
    id: row.id,
    token: row.invite_code ?? '',
    tournamentId: row.tournament_id,
    role: row.role as TournamentRole,
    teamIds: row.team_ids ?? [],
    label: row.label ?? undefined,
    createdBy: row.invited_by ?? '',
    createdAt: row.invited_at ?? row.created_at ?? new Date().toISOString(),
    expiresAt: row.expires_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxUses: row.max_uses ?? 1,
    useCount: row.use_count ?? 0,
    usedBy: [], // Not stored in DB, could add if needed
    isActive: !row.accepted_at && !row.declined_at && row.invite_code !== null,
  };
}

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
 * Erstellt eine neue Einladung
 *
 * @param options - Einladungs-Optionen
 * @returns Ergebnis mit Einladung und Link
 */
export const createInvitation = async (options: CreateInvitationOptions): Promise<CreateInvitationResult> => {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  if (currentUser.globalRole === 'guest') {
    return { success: false, error: 'Gäste können keine Einladungen erstellen' };
  }

  // Owner-Einladungen sind nicht erlaubt
  if (options.role === 'owner') {
    return { success: false, error: 'Owner-Einladungen sind nicht erlaubt' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud-Funktionen sind nicht verfügbar' };
  }

  const now = new Date();
  const daysInMs = (options.expiresInDays ?? 7) * 24 * 60 * 60 * 1000;
  const inviteCode = generateToken();

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .insert({
        tournament_id: options.tournamentId,
        invite_code: inviteCode,
        role: options.role,
        team_ids: options.teamIds ?? [],
        label: options.label,
        max_uses: options.maxUses ?? 1,
        use_count: 0,
        expires_at: new Date(now.getTime() + daysInMs).toISOString(),
        invited_by: options.createdBy,
        invited_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Create invitation error:', error);
      return { success: false, error: error.message };
    }

    const invitation = mapRowToInvitation(data as CollaboratorRow);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.turnier.de';
    const inviteLink = `${baseUrl}/invite?token=${inviteCode}`;

    return {
      success: true,
      invitation,
      inviteLink,
    };
  } catch (err) {
    console.error('Create invitation error:', err);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
  }
};

/**
 * Validiert einen Einladungs-Token
 *
 * @param token - Der zu validierende Token
 * @returns Validierungs-Ergebnis
 */
export const validateInvitation = async (token: string): Promise<InvitationValidationResult> => {
  if (!isSupabaseConfigured || !supabase) {
    return { valid: false, error: 'not_found' };
  }

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .select('*, tournaments(id, title)')
      .eq('invite_code', token)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (error || !data) {
      return { valid: false, error: 'not_found' };
    }

    const row = data as CollaboratorRow & { tournaments?: { id: string; title: string } };

    // Check if already used (has user_id = accepted)
    if (row.user_id) {
      return { valid: false, error: 'already_used' };
    }

    // Check if deactivated
    if (row.declined_at) {
      return { valid: false, error: 'deactivated' };
    }

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { valid: false, error: 'expired' };
    }

    // Check max uses
    const maxUses = row.max_uses ?? 1;
    const useCount = row.use_count ?? 0;
    if (maxUses > 0 && useCount >= maxUses) {
      return { valid: false, error: 'max_uses_reached' };
    }

    const invitation = mapRowToInvitation(row);

    // Get inviter info
    let inviter: { id: string; name: string } | undefined;
    if (row.invited_by) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', row.invited_by)
        .single();

      if (profileData) {
        inviter = {
          id: profileData.id,
          name: profileData.display_name ?? 'Unknown',
        };
      }
    }

    return {
      valid: true,
      invitation,
      tournament: row.tournaments ? { id: row.tournaments.id, name: row.tournaments.title } : undefined,
      inviter,
    };
  } catch (err) {
    console.error('Validate invitation error:', err);
    return { valid: false, error: 'not_found' };
  }
};

/**
 * Nimmt eine Einladung an
 *
 * @param token - Der Einladungs-Token
 * @param userId - ID des annehmenden Users
 * @returns Ergebnis mit Membership
 */
export const acceptInvitation = async (token: string, userId: string): Promise<AcceptInvitationResult> => {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud-Funktionen sind nicht verfügbar' };
  }

  const validation = await validateInvitation(token);

  if (!validation.valid || !validation.invitation) {
    return { success: false, error: validation.error ?? 'Einladung nicht gefunden' };
  }

  const invitation = validation.invitation;

  try {
    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('tournament_collaborators')
      .select('id')
      .eq('tournament_id', invitation.tournamentId)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return { success: false, error: 'already_member' };
    }

    const now = new Date().toISOString();

    // Update the invitation row: set user_id and accepted_at
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .update({
        user_id: userId,
        accepted_at: now,
        use_count: invitation.useCount + 1,
      })
      .eq('id', invitation.id)
      .select()
      .single();

    if (error) {
      console.error('Accept invitation error:', error);
      return { success: false, error: error.message };
    }

    const membership = mapRowToMembership(data as CollaboratorRow);

    return { success: true, membership };
  } catch (err) {
    console.error('Accept invitation error:', err);
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten' };
  }
};

/**
 * Deaktiviert eine Einladung
 *
 * @param invitationId - ID der Einladung
 * @returns true wenn erfolgreich
 */
export const deactivateInvitation = async (invitationId: string): Promise<boolean> => {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('tournament_collaborators')
      .update({ declined_at: new Date().toISOString() })
      .eq('id', invitationId)
      .is('user_id', null); // Only deactivate pending invitations

    return !error;
  } catch {
    return false;
  }
};

/**
 * Lädt alle aktiven Einladungen für ein Turnier
 *
 * @param tournamentId - Turnier-ID
 * @returns Array von Einladungen
 */
export const getActiveInvitationsForTournament = async (tournamentId: string): Promise<Invitation[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('tournament_id', tournamentId)
      .is('user_id', null) // Pending invitations only
      .is('declined_at', null) // Not deactivated
      .gt('expires_at', new Date().toISOString()); // Not expired

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (error || !data) {
      return [];
    }

    return (data as CollaboratorRow[])
      .filter((row) => {
        const maxUses = row.max_uses ?? 1;
        const useCount = row.use_count ?? 0;
        return maxUses === 0 || useCount < maxUses;
      })
      .map(mapRowToInvitation);
  } catch {
    return [];
  }
};

/**
 * Lädt eine Einladung anhand des Tokens
 *
 * @param token - Der Token
 * @returns Die Einladung oder undefined
 */
export const getInvitationByToken = async (token: string): Promise<Invitation | undefined> => {
  if (!isSupabaseConfigured || !supabase) {
    return undefined;
  }

  try {
    const { data, error } = await supabase
      .from('tournament_collaborators')
      .select('*')
      .eq('invite_code', token)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (error || !data) {
      return undefined;
    }

    return mapRowToInvitation(data as CollaboratorRow);
  } catch {
    return undefined;
  }
};

// ============================================
// LEGACY SYNC FUNCTIONS (for backward compatibility)
// ============================================

/**
 * @deprecated Use async version instead
 * Synchronous wrapper - returns empty for non-async contexts
 */
export const createInvitationSync = (options: CreateInvitationOptions): CreateInvitationResult => {
  console.warn('createInvitationSync is deprecated. Use createInvitation() async function.');
  // Trigger async operation
  void createInvitation(options);
  return { success: false, error: 'Use async version' };
};
