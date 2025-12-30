/**
 * Invitation Service - Einladungs-Verwaltung
 *
 * Verwaltet Token-basierte Einladungen zu Turnieren.
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
import { AUTH_STORAGE_KEYS } from '../types/auth.types';
import { generateToken, generateUUID } from '../utils/tokenGenerator';
import { getCurrentUser } from './authService';

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
// STORAGE
// ============================================

/**
 * Lädt alle Einladungen
 */
const getInvitations = (): Invitation[] => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.INVITATIONS);
    return raw ? (JSON.parse(raw) as Invitation[]) : [];
  } catch {
    return [];
  }
};

/**
 * Speichert alle Einladungen
 */
const saveInvitations = (invitations: Invitation[]): void => {
  localStorage.setItem(AUTH_STORAGE_KEYS.INVITATIONS, JSON.stringify(invitations));
};

/**
 * Lädt alle Memberships
 */
const getMemberships = (): TournamentMembership[] => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.MEMBERSHIPS);
    return raw ? (JSON.parse(raw) as TournamentMembership[]) : [];
  } catch {
    return [];
  }
};

/**
 * Speichert alle Memberships
 */
const saveMemberships = (memberships: TournamentMembership[]): void => {
  localStorage.setItem(AUTH_STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(memberships));
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Erstellt eine neue Einladung
 *
 * @param options - Einladungs-Optionen
 * @returns Ergebnis mit Einladung und Link
 *
 * @example
 * ```ts
 * const result = createInvitation({
 *   tournamentId: 'abc123',
 *   role: 'trainer',
 *   teamIds: ['team-1', 'team-2'],
 *   duration: INVITATION_DURATION.ONE_WEEK,
 *   maxUses: 1,
 * });
 *
 * if (result.success) {
 *   console.log('Link:', result.inviteLink);
 * }
 * ```
 */
export const createInvitation = (options: CreateInvitationOptions): CreateInvitationResult => {
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

  const now = new Date();
  const daysInMs = (options.expiresInDays ?? 7) * 24 * 60 * 60 * 1000;

  const invitation: Invitation = {
    id: generateUUID(),
    token: generateToken(),
    tournamentId: options.tournamentId,
    role: options.role,
    teamIds: options.teamIds ?? [],
    label: options.label,
    createdBy: options.createdBy,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + daysInMs).toISOString(),
    maxUses: options.maxUses ?? 1,
    useCount: 0,
    usedBy: [],
    isActive: true,
  };

  // Speichern
  const invitations = getInvitations();
  invitations.push(invitation);
  saveInvitations(invitations);

  // Link generieren
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.turnier.de';
  const inviteLink = `${baseUrl}/invite?token=${invitation.token}`;

  return {
    success: true,
    invitation,
    inviteLink,
  };
};

/**
 * Validiert einen Einladungs-Token
 *
 * @param token - Der zu validierende Token
 * @returns Validierungs-Ergebnis
 */
export const validateInvitation = (token: string): InvitationValidationResult => {
  const invitations = getInvitations();
  const invitation = invitations.find((i) => i.token === token);

  if (!invitation) {
    return { valid: false, error: 'not_found' };
  }

  if (!invitation.isActive) {
    return { valid: false, error: 'deactivated' };
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    return { valid: false, error: 'expired' };
  }

  if (invitation.maxUses > 0 && invitation.useCount >= invitation.maxUses) {
    return { valid: false, error: 'max_uses_reached' };
  }

  // Turnier-Info laden (vereinfacht)
  const tournamentsRaw = localStorage.getItem('tournaments');
  const tournaments = tournamentsRaw ? (JSON.parse(tournamentsRaw) as Array<{ id: string; title: string }>) : [];
  const tournament = tournaments.find((t) => t.id === invitation.tournamentId);

  // Ersteller-Info laden (vereinfacht)
  const usersRaw = localStorage.getItem(AUTH_STORAGE_KEYS.USERS);
  const users = usersRaw ? (JSON.parse(usersRaw) as Array<{ id: string; name: string }>) : [];
  const inviter = users.find((u) => u.id === invitation.createdBy);

  return {
    valid: true,
    invitation,
    tournament: tournament ? { id: tournament.id, name: tournament.title } : undefined,
    inviter: inviter ? { id: inviter.id, name: inviter.name } : undefined,
  };
};

/**
 * Nimmt eine Einladung an
 *
 * @param token - Der Einladungs-Token
 * @param userId - ID des annehmenden Users
 * @returns Ergebnis mit Membership
 */
export const acceptInvitation = (token: string, userId: string): AcceptInvitationResult => {
  const validation = validateInvitation(token);

  if (!validation.valid || !validation.invitation) {
    return { success: false, error: validation.error ?? 'Einladung nicht gefunden' };
  }

  const invitation = validation.invitation;
  const memberships = getMemberships();

  // Prüfen ob User bereits Mitglied ist
  const existingMembership = memberships.find(
    (m) => m.userId === userId && m.tournamentId === invitation.tournamentId
  );

  if (existingMembership) {
    return { success: false, error: 'already_member' };
  }

  // Neue Membership erstellen
  const now = new Date().toISOString();
  const membership: TournamentMembership = {
    id: generateUUID(),
    userId,
    tournamentId: invitation.tournamentId,
    role: invitation.role,
    teamIds: invitation.teamIds,
    invitedBy: invitation.createdBy,
    invitedAt: invitation.createdAt,
    acceptedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  // Membership speichern
  memberships.push(membership);
  saveMemberships(memberships);

  // Einladung aktualisieren
  const invitations = getInvitations();
  const invIndex = invitations.findIndex((i) => i.id === invitation.id);
  if (invIndex >= 0) {
    invitations[invIndex].useCount++;
    invitations[invIndex].usedBy.push(userId);
    saveInvitations(invitations);
  }

  return { success: true, membership };
};

/**
 * Deaktiviert eine Einladung
 *
 * @param invitationId - ID der Einladung
 * @returns true wenn erfolgreich
 */
export const deactivateInvitation = (invitationId: string): boolean => {
  const invitations = getInvitations();
  const index = invitations.findIndex((i) => i.id === invitationId);

  if (index < 0) {
    return false;
  }

  invitations[index].isActive = false;
  saveInvitations(invitations);
  return true;
};

/**
 * Lädt alle aktiven Einladungen für ein Turnier
 *
 * @param tournamentId - Turnier-ID
 * @returns Array von Einladungen
 */
export const getActiveInvitationsForTournament = (tournamentId: string): Invitation[] => {
  const invitations = getInvitations();
  return invitations.filter(
    (i) =>
      i.tournamentId === tournamentId &&
      i.isActive &&
      new Date(i.expiresAt) > new Date() &&
      (i.maxUses === 0 || i.useCount < i.maxUses)
  );
};

/**
 * Lädt eine Einladung anhand des Tokens
 *
 * @param token - Der Token
 * @returns Die Einladung oder undefined
 */
export const getInvitationByToken = (token: string): Invitation | undefined => {
  const invitations = getInvitations();
  return invitations.find((i) => i.token === token);
};
