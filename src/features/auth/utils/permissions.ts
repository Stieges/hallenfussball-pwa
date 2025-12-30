/**
 * Permissions - Berechtigungs-Checks basierend auf Rollen
 *
 * Implementiert die Berechtigungs-Matrix aus dem Konzept.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 2.4
 */

import type { TournamentRole, GlobalRole } from '../types/auth.types';

// ============================================
// TOURNAMENT MANAGEMENT
// ============================================

/**
 * Kann das Turnier verwalten (Einstellungen, Spielplan, etc.)
 * Erlaubt: owner, co-admin
 */
export const canManageTournament = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

/**
 * Kann das Turnier löschen
 * Erlaubt: nur owner
 */
export const canDeleteTournament = (role: TournamentRole): boolean => {
  return role === 'owner';
};

/**
 * Kann Einladungen erstellen
 * Erlaubt: owner, co-admin
 */
export const canCreateInvitations = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

// ============================================
// RESULTS & SCORES
// ============================================

/**
 * Kann Ergebnisse für ein Match eingeben
 *
 * - owner, co-admin, collaborator: alle Matches
 * - trainer: nur Matches mit eigenen Teams
 * - viewer: keine
 *
 * @param role - Turnier-Rolle des Users
 * @param userTeamIds - Teams die dem User zugewiesen sind (für Trainer)
 * @param matchTeamIds - Teams die am Match teilnehmen [homeTeamId, awayTeamId]
 */
export const canEditResults = (
  role: TournamentRole,
  userTeamIds: string[],
  matchTeamIds: string[]
): boolean => {
  // Owner, Co-Admin und Collaborator können alle Ergebnisse eingeben
  if (role === 'owner' || role === 'co-admin' || role === 'collaborator') {
    return true;
  }

  // Trainer kann nur Ergebnisse für eigene Teams eingeben
  if (role === 'trainer') {
    return matchTeamIds.some((teamId) => userTeamIds.includes(teamId));
  }

  // Viewer kann keine Ergebnisse eingeben
  return false;
};

/**
 * Kann den Spielplan bearbeiten (Zeiten, Felder, Reihenfolge)
 * Erlaubt: owner, co-admin
 */
export const canEditSchedule = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

// ============================================
// TEAM MANAGEMENT
// ============================================

/**
 * Kann alle Teams bearbeiten (Namen, Logo, etc.)
 * Erlaubt: owner, co-admin
 */
export const canEditAllTeams = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

/**
 * Kann den Kader eines spezifischen Teams bearbeiten
 * (Spielernamen, Trikotnummern, Spieler hinzufügen/entfernen)
 *
 * - owner, co-admin: alle Teams
 * - trainer: nur eigene Teams
 *
 * @param role - Turnier-Rolle des Users
 * @param userTeamIds - Teams die dem User zugewiesen sind
 * @param targetTeamId - Team das bearbeitet werden soll
 */
export const canEditTeamRoster = (
  role: TournamentRole,
  userTeamIds: string[],
  targetTeamId: string
): boolean => {
  // Owner und Co-Admin können alle Teams bearbeiten
  if (role === 'owner' || role === 'co-admin') {
    return true;
  }

  // Trainer kann nur eigene Teams bearbeiten
  if (role === 'trainer') {
    return userTeamIds.includes(targetTeamId);
  }

  return false;
};

/**
 * Kann Team-Metadaten ändern (Name, Logo)
 * Nur owner, co-admin - NICHT Trainer!
 */
export const canEditTeamMetadata = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

// ============================================
// MEMBER MANAGEMENT
// ============================================

/**
 * Kann Mitglieder-Rollen ändern
 *
 * - owner: kann alle ändern (außer sich selbst)
 * - co-admin: kann ändern (außer owner und co-admin → owner)
 *
 * @param myRole - Eigene Turnier-Rolle
 * @param targetRole - Aktuelle Rolle des Ziel-Users
 */
export const canChangeRole = (
  myRole: TournamentRole,
  targetRole: TournamentRole
): boolean => {
  // Viewer, Collaborator, Trainer können keine Rollen ändern
  if (myRole !== 'owner' && myRole !== 'co-admin') {
    return false;
  }

  // Owner kann alle ändern außer sich selbst (owner)
  if (myRole === 'owner') {
    return targetRole !== 'owner';
  }

  // Co-Admin kann keine Änderungen an Owner oder anderen Co-Admins machen
  // An diesem Punkt ist myRole garantiert 'co-admin' (andere wurden oben ausgefiltert)
  return targetRole !== 'owner' && targetRole !== 'co-admin';
};

/**
 * Kann einen User zu einer bestimmten Rolle ändern
 *
 * @param myRole - Eigene Turnier-Rolle
 * @param targetCurrentRole - Aktuelle Rolle des Ziel-Users
 * @param newRole - Neue gewünschte Rolle
 */
export const canSetRoleTo = (
  myRole: TournamentRole,
  targetCurrentRole: TournamentRole,
  newRole: TournamentRole
): boolean => {
  // Erst prüfen ob überhaupt Änderung erlaubt
  if (!canChangeRole(myRole, targetCurrentRole)) {
    return false;
  }

  // Nur Owner kann jemanden zum Co-Admin machen
  if (newRole === 'co-admin' && myRole !== 'owner') {
    return false;
  }

  // Niemand kann jemanden zum Owner machen (nur via transferOwnership)
  if (newRole === 'owner') {
    return false;
  }

  return true;
};

/**
 * Kann ein Mitglied entfernen
 *
 * - owner: kann alle entfernen außer sich selbst
 * - co-admin: kann entfernen außer owner und co-admins
 */
export const canRemoveMember = (
  myRole: TournamentRole,
  targetRole: TournamentRole
): boolean => {
  return canChangeRole(myRole, targetRole);
};

/**
 * Kann Ownership übertragen
 * Nur owner kann Ownership an einen Co-Admin übertragen
 */
export const canTransferOwnership = (role: TournamentRole): boolean => {
  return role === 'owner';
};

// ============================================
// VIEW PERMISSIONS
// ============================================

/**
 * Kann das Turnier ansehen
 * Alle Rollen können ansehen
 */
export const canViewTournament = (_role: TournamentRole): boolean => {
  return true; // Alle Rollen
};

/**
 * Kann den Spielplan sehen
 */
export const canViewSchedule = (_role: TournamentRole): boolean => {
  return true; // Alle Rollen
};

/**
 * Kann Tabellen sehen
 */
export const canViewStandings = (_role: TournamentRole): boolean => {
  return true; // Alle Rollen
};

/**
 * Kann Mitglieder-Liste sehen
 * Erlaubt: owner, co-admin
 */
export const canViewMembers = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

/**
 * Kann Einladungs-Links sehen
 * Erlaubt: owner, co-admin
 */
export const canViewInvitations = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

// ============================================
// GLOBAL PERMISSIONS
// ============================================

/**
 * Kann neue Turniere erstellen
 * Erlaubt: user, admin (nicht guest)
 */
export const canCreateTournament = (globalRole: GlobalRole): boolean => {
  return globalRole === 'user' || globalRole === 'admin';
};

/**
 * Ist ein globaler Administrator
 */
export const isGlobalAdmin = (globalRole: GlobalRole): boolean => {
  return globalRole === 'admin';
};

/**
 * Ist ein Gast (nicht angemeldet)
 */
export const isGuest = (globalRole: GlobalRole): boolean => {
  return globalRole === 'guest';
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Gibt alle Rollen zurück die ein User vergeben kann
 *
 * @param myRole - Eigene Turnier-Rolle
 * @returns Array von vergabbaren Rollen
 */
export const getAssignableRoles = (myRole: TournamentRole): TournamentRole[] => {
  if (myRole === 'owner') {
    return ['co-admin', 'trainer', 'collaborator', 'viewer'];
  }

  if (myRole === 'co-admin') {
    return ['trainer', 'collaborator', 'viewer'];
  }

  return [];
};

/**
 * Prüft ob eine Rolle höher ist als eine andere
 * owner > co-admin > trainer > collaborator > viewer
 */
export const isHigherRole = (roleA: TournamentRole, roleB: TournamentRole): boolean => {
  const hierarchy: TournamentRole[] = ['viewer', 'collaborator', 'trainer', 'co-admin', 'owner'];
  return hierarchy.indexOf(roleA) > hierarchy.indexOf(roleB);
};

/**
 * Prüft ob eine Rollenänderung ein "Downgrade" ist
 */
export const isDowngrade = (currentRole: TournamentRole, newRole: TournamentRole): boolean => {
  return isHigherRole(currentRole, newRole);
};
