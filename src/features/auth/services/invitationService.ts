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
} from '../types/auth.types';
import { generateToken } from '../utils/tokenGenerator';
// getCurrentUser removed - user now passed as parameter
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { mapInvitationInsertToSupabase } from '../../../core/repositories/supabaseMappers';

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

// ============================================
// PUBLIC API
// ============================================

/**
 * Erstellt eine neue Einladung
 *
 * @param options - Einladungs-Optionen
 * @returns Ergebnis mit Einladung und Link
 */
export const createInvitation = async (
  options: CreateInvitationOptions,
  user: { id: string; globalRole: string } | null
): Promise<CreateInvitationResult> => {
  if (!user) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  if (user.globalRole === 'guest') {
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
      .insert(
        mapInvitationInsertToSupabase({
          tournamentId: options.tournamentId,
          inviteCode,
          role: options.role,
          teamIds: options.teamIds,
          label: options.label,
          maxUses: options.maxUses,
          expiresAtIso: new Date(now.getTime() + daysInMs).toISOString(),
          invitedBy: options.createdBy,
          invitedAtIso: now.toISOString(),
        })
      )
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) { console.error('Create invitation error:', error); }
      return { success: false, error: error.message };
    }

    const invitation = mapRowToInvitation(data);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.turnier.de';
    const inviteLink = `${baseUrl}/invite?token=${inviteCode}`;

    return {
      success: true,
      invitation,
      inviteLink,
    };
  } catch (err) {
    if (import.meta.env.DEV) { console.error('Create invitation error:', err); }
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
