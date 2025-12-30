/**
 * Membership Service - Turnier-Mitgliedschafts-Verwaltung
 *
 * Verwaltet User-Rollen in Turnieren.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.5
 */

import type { TournamentMembership, TournamentRole } from '../types/auth.types';
import { AUTH_STORAGE_KEYS } from '../types/auth.types';
import { generateUUID } from '../utils/tokenGenerator';
import { canChangeRole, canSetRoleTo, canTransferOwnership } from '../utils/permissions';
import { getCurrentUser } from './authService';

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
// STORAGE
// ============================================

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
 * Erstellt eine Owner-Membership für ein neues Turnier
 *
 * @param tournamentId - ID des Turniers
 * @param userId - ID des Erstellers
 * @returns Die erstellte Membership
 */
export const createOwnerMembership = (
  tournamentId: string,
  userId: string
): TournamentMembership => {
  const now = new Date().toISOString();

  const membership: TournamentMembership = {
    id: generateUUID(),
    userId,
    tournamentId,
    role: 'owner',
    teamIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const memberships = getMemberships();
  memberships.push(membership);
  saveMemberships(memberships);

  return membership;
};

/**
 * Lädt alle Mitglieder eines Turniers
 *
 * @param tournamentId - Turnier-ID
 * @returns Array von Memberships
 */
export const getTournamentMembers = (tournamentId: string): TournamentMembership[] => {
  const memberships = getMemberships();
  return memberships.filter((m) => m.tournamentId === tournamentId);
};

/**
 * Lädt die Membership eines Users in einem Turnier
 *
 * @param tournamentId - Turnier-ID
 * @param userId - User-ID
 * @returns Membership oder undefined
 */
export const getUserMembership = (
  tournamentId: string,
  userId: string
): TournamentMembership | undefined => {
  const memberships = getMemberships();
  return memberships.find((m) => m.tournamentId === tournamentId && m.userId === userId);
};

/**
 * Ändert die Rolle eines Mitglieds
 *
 * @param membershipId - ID der Membership
 * @param newRole - Neue Rolle
 * @param newTeamIds - Neue Team-Zuordnungen (für Trainer)
 * @returns Ergebnis
 */
export const changeRole = (
  membershipId: string,
  newRole: TournamentRole,
  newTeamIds?: string[]
): ChangeRoleResult => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  const memberships = getMemberships();
  const targetIndex = memberships.findIndex((m) => m.id === membershipId);

  if (targetIndex < 0) {
    return { success: false, error: 'Mitglied nicht gefunden' };
  }

  const targetMembership = memberships[targetIndex];

  // Eigene Membership finden
  const myMembership = memberships.find(
    (m) => m.tournamentId === targetMembership.tournamentId && m.userId === currentUser.id
  );

  if (!myMembership) {
    return { success: false, error: 'Keine Berechtigung' };
  }

  // Berechtigungs-Check
  if (!canChangeRole(myMembership.role, targetMembership.role)) {
    return { success: false, error: 'Keine Berechtigung für diese Aktion' };
  }

  if (!canSetRoleTo(myMembership.role, targetMembership.role, newRole)) {
    return { success: false, error: 'Diese Rolle kann nicht vergeben werden' };
  }

  // Rolle ändern
  memberships[targetIndex] = {
    ...targetMembership,
    role: newRole,
    teamIds: newRole === 'trainer' ? (newTeamIds ?? targetMembership.teamIds) : [],
    updatedAt: new Date().toISOString(),
  };

  saveMemberships(memberships);

  return { success: true, membership: memberships[targetIndex] };
};

/**
 * Aktualisiert die Team-Zuordnungen eines Trainers
 *
 * @param membershipId - ID der Membership
 * @param teamIds - Neue Team-IDs
 * @returns Ergebnis
 */
export const updateTrainerTeams = (
  membershipId: string,
  teamIds: string[]
): ChangeRoleResult => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  const memberships = getMemberships();
  const targetIndex = memberships.findIndex((m) => m.id === membershipId);

  if (targetIndex < 0) {
    return { success: false, error: 'Mitglied nicht gefunden' };
  }

  const targetMembership = memberships[targetIndex];

  if (targetMembership.role !== 'trainer') {
    return { success: false, error: 'Nur Trainer haben Team-Zuordnungen' };
  }

  // Eigene Membership finden
  const myMembership = memberships.find(
    (m) => m.tournamentId === targetMembership.tournamentId && m.userId === currentUser.id
  );

  if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'co-admin')) {
    return { success: false, error: 'Keine Berechtigung' };
  }

  // Team-Zuordnungen aktualisieren
  memberships[targetIndex] = {
    ...targetMembership,
    teamIds,
    updatedAt: new Date().toISOString(),
  };

  saveMemberships(memberships);

  return { success: true, membership: memberships[targetIndex] };
};

/**
 * Entfernt ein Mitglied aus dem Turnier
 *
 * @param membershipId - ID der Membership
 * @returns true wenn erfolgreich
 */
export const removeMember = (membershipId: string): boolean => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return false;
  }

  const memberships = getMemberships();
  const targetIndex = memberships.findIndex((m) => m.id === membershipId);

  if (targetIndex < 0) {
    return false;
  }

  const targetMembership = memberships[targetIndex];

  // Owner kann nicht entfernt werden
  if (targetMembership.role === 'owner') {
    return false;
  }

  // Eigene Membership finden
  const myMembership = memberships.find(
    (m) => m.tournamentId === targetMembership.tournamentId && m.userId === currentUser.id
  );

  if (!myMembership) {
    return false;
  }

  // Berechtigungs-Check
  if (!canChangeRole(myMembership.role, targetMembership.role)) {
    return false;
  }

  // Entfernen
  memberships.splice(targetIndex, 1);
  saveMemberships(memberships);

  return true;
};

/**
 * Überträgt Ownership an einen Co-Admin
 *
 * @param tournamentId - Turnier-ID
 * @param newOwnerId - User-ID des neuen Owners
 * @returns Ergebnis
 */
export const transferOwnership = (
  tournamentId: string,
  newOwnerId: string
): TransferOwnershipResult => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'Nicht angemeldet' };
  }

  const memberships = getMemberships();

  // Aktuelle Owner-Membership finden
  const ownerIndex = memberships.findIndex(
    (m) => m.tournamentId === tournamentId && m.userId === currentUser.id
  );

  if (ownerIndex < 0) {
    return { success: false, error: 'Nicht Mitglied dieses Turniers' };
  }

  const ownerMembership = memberships[ownerIndex];

  if (!canTransferOwnership(ownerMembership.role)) {
    return { success: false, error: 'Nur der Owner kann Ownership übertragen' };
  }

  // Neue Owner-Membership finden
  const newOwnerIndex = memberships.findIndex(
    (m) => m.tournamentId === tournamentId && m.userId === newOwnerId
  );

  if (newOwnerIndex < 0) {
    return { success: false, error: 'Ziel-User ist nicht Mitglied' };
  }

  const newOwnerMembership = memberships[newOwnerIndex];

  if (newOwnerMembership.role !== 'co-admin') {
    return { success: false, error: 'Ownership kann nur an Co-Admins übertragen werden' };
  }

  const now = new Date().toISOString();

  // Alter Owner wird Co-Admin
  memberships[ownerIndex] = {
    ...ownerMembership,
    role: 'co-admin',
    updatedAt: now,
  };

  // Neuer Owner
  memberships[newOwnerIndex] = {
    ...newOwnerMembership,
    role: 'owner',
    updatedAt: now,
  };

  saveMemberships(memberships);

  return {
    success: true,
    oldOwnerMembership: memberships[ownerIndex],
    newOwnerMembership: memberships[newOwnerIndex],
  };
};

/**
 * Gibt alle Co-Admins eines Turniers zurück
 *
 * @param tournamentId - Turnier-ID
 * @returns Array von Co-Admin Memberships
 */
export const getCoAdmins = (tournamentId: string): TournamentMembership[] => {
  const memberships = getMemberships();
  return memberships.filter((m) => m.tournamentId === tournamentId && m.role === 'co-admin');
};
