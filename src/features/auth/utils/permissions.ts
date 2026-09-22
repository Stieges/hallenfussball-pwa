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
 * Kann Ergebnisse für ein Match eingeben (verbindlich, d.h. matches/match_events schreiben)
 *
 * - owner, co-admin, collaborator: alle Matches
 * - trainer: NEIN — siehe Begründung unten
 * - viewer: keine
 *
 * Daniels Konzept (task-R1-brief.md / roleMatrix.json, Zeile "trainer"):
 * „Ein Trainer soll perspektivisch ein Spiel seines Teams eintragen dürfen. Dieser Eintrag
 * ist aber ein Vorschlag und kann von der Turnierleitung übernommen werden. Der Wert der
 * Turnierleitung hat immer Vorrang."
 *
 * Deshalb schreibt ein Trainer heute NIE direkt in verbindliche Daten (matches/match_events) —
 * weder in der Datenbank (RLS, R1) noch hier in der UI. Ein Trainer-Eintrag wäre sonst
 * ununterscheidbar von einem verbindlichen Eintrag der Turnierleitung und könnte deren Wert
 * überschreiben, statt ihm unterlegen zu sein. Der künftige Vorschlagsweg (Trainer schlägt vor,
 * Turnierleitung übernimmt) ist ein GETRENNTER, noch zu bauender Mechanismus (eigene Tabelle/
 * Status, kein direktes UPDATE auf matches/match_events) — nicht Teil dieser Änderung.
 *
 * @param role - Turnier-Rolle des Users
 * @param _userTeamIds - Teams die dem User zugewiesen sind (für Trainer). Aktuell UNGENUTZT,
 *   da Trainer keinen direkten Schreibzugriff mehr haben — bewusst NICHT aus der Signatur
 *   entfernt (Präfix `_` nur zur Lint-Konformität, siehe `argsIgnorePattern` in eslint.config.js):
 *   der künftige Vorschlagsweg braucht genau diese Information (welches Team darf der Trainer
 *   vorschlagen), und Aufrufer (z.B. ManagementTab.checkCanEditMatch) übergeben sie bereits.
 *   Sie jetzt zu entfernen hieße, sie beim Bau des Vorschlagswegs wieder einzuführen und alle
 *   Call-Sites erneut anzufassen.
 * @param _matchTeamIds - Teams die am Match teilnehmen [homeTeamId, awayTeamId]. Ebenfalls
 *   aktuell ungenutzt (siehe _userTeamIds oben) — der künftige Vorschlagsweg braucht auch
 *   diese Information, um einen Trainer-Vorschlag dem richtigen Match zuzuordnen.
 */
export const canEditResults = (
  role: TournamentRole,
  _userTeamIds: string[],
  _matchTeamIds: string[]
): boolean => {
  // Owner, Co-Admin und Collaborator können alle Ergebnisse eingeben
  if (role === 'owner' || role === 'co-admin' || role === 'collaborator') {
    return true;
  }

  // Trainer, Viewer und alle übrigen Rollen: kein direkter Schreibzugriff (siehe JSDoc oben).
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
