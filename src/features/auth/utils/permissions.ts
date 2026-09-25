/**
 * Permissions - Berechtigungs-Checks basierend auf Rollen
 *
 * R5b (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md): die Rechte stehen
 * jetzt an EINER Stelle -- src/features/auth/permissions/rolePermissions.json -- und werden hier
 * zur Laufzeit über hasPermission() ausgewertet. Die DB spiegelt dieselbe JSON in der Tabelle
 * public.role_permissions plus der Funktion has_tournament_permission()
 * (supabase/migrations/20260924_002_central_role_permissions.sql). Ein Recht ändern heißt
 * künftig: eine Zeile in rolePermissions.json PLUS eine NEUE Migration mit INSERT (vergeben) bzw.
 * DELETE (entziehen) auf role_permissions -- korrigiert in Fixrunde 1 (N3): die ursprüngliche
 * Migrationsdatei ist nach dem Anwenden historisch und wird nie wieder ausgeführt. KEINE Policy
 * und KEINE der can…-Funktionen unten muss dafür angefasst werden, solange die Funktion selbst
 * nur hasPermission() befragt (siehe Funktion-→-Recht-Tabelle im Report).
 *
 * Der Eigentümer (role 'owner') hat IMMER alle Rechte -- fest in hasPermission() verankert, nicht
 * in der JSON (dort gibt es keine 'owner'-Zeile). Eine unbekannte/fehlende Rolle (Nicht-Mitglied)
 * hat nie ein Recht.
 *
 * Die bisherigen can…-Funktionen bleiben mit UNVERÄNDERTER Signatur als dünne Aliasse bestehen,
 * damit keine Aufrufstelle in der App angepasst werden muss.
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 2.4
 */

import { z } from 'zod';
import type { TournamentRole, GlobalRole } from '../types/auth.types';
import rolePermissionsJson from '../permissions/rolePermissions.json';

// ============================================
// ZENTRALE RECHTE-TABELLE (rolePermissions.json)
// ============================================

/**
 * Alle bekannten Rechte -- deckungsgleich mit den Spalten der Rechteliste im Brief und den
 * CHECK-Constraints von public.role_permissions. Kein `string`, kein `any` -- jeder Aufrufer von
 * hasPermission() muss einen dieser Literale verwenden, ein Tippfehler fällt beim Bauen auf.
 */
const PermissionSchema = z.enum([
  'writeMatchData',
  'correctEvents',
  'tournamentSettings',
  'teams',
  'restructure',
  'deleteTournament',
  'manageMembers',
  'leadMatches',
]);

export type Permission = z.infer<typeof PermissionSchema>;

/**
 * Bekannte Rollen aus role_permissions -- deckungsgleich mit dessen role-CHECK-Constraint
 * (bewusst OHNE 'owner', siehe hasPermission() unten und der JSON-Kopfkommentar).
 */
const RolePermissionsRoleSchema = z.enum(['co-admin', 'collaborator', 'trainer', 'viewer']);

/**
 * Fixrunde 1 (N4, task-R5b-review.md): Laufzeit-Validierung statt `as unknown as` -- ein
 * Tippfehler in rolePermissions.json (z.B. "restucture" statt "restructure", oder ein
 * unbekannter Rollen-Schlüssel) wirft jetzt beim Modul-Import eine ZodError, statt still auf
 * `false` zurückzufallen. Weil praktisch jeder Auth-Test dieses Modul importiert, wird ein
 * solcher Tippfehler sofort in Vitest sichtbar (rote Testdatei-Ladefehler, nicht nur eine
 * einzelne falsche Assertion). Bewusst `.parse()` statt `.safeParse()`: rolePermissions.json ist
 * eine gebündelte, zur Build-Zeit bekannte Konfigurationsdatei, kein Nutzereingabe-Fall -- ein
 * Validierungsfehler hier ist ein Entwickler-/Deploy-Fehler, der laut scheitern soll, statt still
 * (und potenziell mit falschen Rechten) weiterzulaufen.
 */
const RolePermissionsFileSchema = z.object({
  roles: z.record(RolePermissionsRoleSchema, z.array(PermissionSchema)),
});

const rolePermissionsFile = RolePermissionsFileSchema.parse(rolePermissionsJson);

/**
 * Rollen aus der JSON, je einmal als Set aufbereitet (O(1)-Lookup statt Array.includes() bei
 * jedem hasPermission()-Aufruf). 'owner' taucht in der JSON bewusst nicht auf, siehe
 * hasPermission() unten.
 */
const rolePermissionSets: Partial<Record<TournamentRole, ReadonlySet<Permission>>> = Object.fromEntries(
  Object.entries(rolePermissionsFile.roles).map(([role, permissions]) => [role, new Set(permissions)])
);

/**
 * Zentrale Rechteprüfung -- die EINE Stelle, auf der jede can…-Funktion unten aufbaut.
 *
 * - owner: immer true (fest verankert, nicht in der JSON -- siehe Kopfkommentar).
 * - co-admin/collaborator/trainer/viewer: true, wenn rolePermissions.json diese Rolle mit
 *   diesem Recht listet.
 * - jede andere/unbekannte Rolle (Nicht-Mitglied): immer false.
 *
 * Spiegelt has_tournament_permission() (DB) für die Turnier-Rolle des Aufrufers -- die DB prüft
 * zusätzlich, ob der Aufrufer überhaupt ein akzeptiertes Mitglied DIESES Turniers ist; das ist
 * hier bewusst nicht Teil der Signatur, weil die aufrufende UI-Schicht die Rolle bereits aus der
 * Mitgliedschaft des jeweiligen Turniers ableitet (myMembership.role), nie aus einer globalen
 * Rolle.
 */
export const hasPermission = (role: TournamentRole, permission: Permission): boolean => {
  if (role === 'owner') {
    return true;
  }
  return rolePermissionSets[role]?.has(permission) ?? false;
};

// ============================================
// TOURNAMENT MANAGEMENT
// ============================================

/**
 * Kann das Turnier verwalten (Einstellungen, Spielplan, etc.)
 * Erlaubt: owner, co-admin -- hasPermission(role, 'tournamentSettings').
 */
export const canManageTournament = (role: TournamentRole): boolean => {
  return hasPermission(role, 'tournamentSettings');
};

/**
 * Kann das Turnier löschen
 * Erlaubt: nur owner -- hasPermission(role, 'deleteTournament') (die Tabelle vergibt
 * deleteTournament an keine Rolle, nur der Eigentümer ist über hasPermission() fest verankert).
 */
export const canDeleteTournament = (role: TournamentRole): boolean => {
  return hasPermission(role, 'deleteTournament');
};

/**
 * Kann Einladungen erstellen
 *
 * Erlaubt: NUR owner -- hasPermission(role, 'manageMembers') (R5/M6: DB verlangt für
 * tournament_collaborators-INSERT/UPDATE/DELETE im Verwaltungszweig has_tournament_permission(
 * tournament_id, 'manageMembers') -- ein Co-Admin trifft dort 0 Zeilen, egal was die UI anbietet,
 * solange die Tabelle ihm dieses Recht nicht zuweist).
 */
export const canCreateInvitations = (role: TournamentRole): boolean => {
  return hasPermission(role, 'manageMembers');
};

// ============================================
// RESULTS & SCORES
// ============================================

/**
 * Kann Ergebnisse für ein Match eingeben (verbindlich, d.h. matches/match_events schreiben)
 * Erlaubt: owner, co-admin, collaborator -- hasPermission(role, 'writeMatchData').
 *
 * Daniels Konzept (task-R1-brief.md / rolePermissions.json): „Ein Trainer soll perspektivisch
 * ein Spiel seines Teams eintragen dürfen. Dieser Eintrag ist aber ein Vorschlag und kann von
 * der Turnierleitung übernommen werden. Der Wert der Turnierleitung hat immer Vorrang." Deshalb
 * schreibt ein Trainer heute NIE direkt in verbindliche Daten (matches/match_events) -- weder in
 * der Datenbank (RLS) noch hier in der UI. Der künftige Vorschlagsweg ist ein GETRENNTER, noch zu
 * bauender Mechanismus -- nicht Teil dieser Funktion.
 *
 * @param role - Turnier-Rolle des Users
 * @param _userTeamIds - Teams die dem User zugewiesen sind (für Trainer). Aktuell UNGENUTZT, da
 *   Trainer keinen direkten Schreibzugriff mehr haben -- bewusst NICHT aus der Signatur entfernt
 *   (Präfix `_` nur zur Lint-Konformität, siehe `argsIgnorePattern` in eslint.config.js): der
 *   künftige Vorschlagsweg braucht genau diese Information, und Aufrufer (z.B.
 *   ManagementTab.checkCanEditMatch) übergeben sie bereits.
 * @param _matchTeamIds - Teams die am Match teilnehmen [homeTeamId, awayTeamId]. Ebenfalls
 *   aktuell ungenutzt, siehe _userTeamIds.
 */
export const canEditResults = (
  role: TournamentRole,
  _userTeamIds: string[],
  _matchTeamIds: string[]
): boolean => {
  return hasPermission(role, 'writeMatchData');
};

/**
 * Kann den Spielplan bearbeiten (Zeiten, Felder, Reihenfolge) -- UND Teams/Spiele anlegen bzw.
 * entfernen (R5b, neues Recht 'restructure').
 * Erlaubt: owner, co-admin -- hasPermission(role, 'restructure').
 */
export const canEditSchedule = (role: TournamentRole): boolean => {
  return hasPermission(role, 'restructure');
};

// ============================================
// TEAM MANAGEMENT
// ============================================

/**
 * Kann alle Teams bearbeiten (Namen, Logo, etc.) -- BESTEHENDE Teams, nicht Anlegen/Entfernen
 * (dafür: canEditSchedule/'restructure').
 * Erlaubt: owner, co-admin, collaborator -- hasPermission(role, 'teams').
 */
export const canEditAllTeams = (role: TournamentRole): boolean => {
  return hasPermission(role, 'teams');
};

/**
 * Kann den Kader eines spezifischen Teams bearbeiten
 * (Spielernamen, Trikotnummern, Spieler hinzufügen/entfernen)
 *
 * - owner, co-admin: alle Teams (hasPermission(role, 'restructure') -- co-admin und owner sind
 *   exakt die Rollen, die auch den Spielplan umbauen dürfen; collaborator bekommt dieses Recht
 *   NICHT, obwohl er 'teams' [Name/Logo bestehender Teams] hat -- Kaderpflege ist damit bewusst
 *   an dieselbe Grenze gebunden wie H4/M3, nicht an 'teams')
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
  if (hasPermission(role, 'restructure')) {
    return true;
  }

  if (role === 'trainer') {
    return userTeamIds.includes(targetTeamId);
  }

  return false;
};

/**
 * Kann Team-Metadaten ändern (Name, Logo)
 * Nur owner, co-admin - NICHT Trainer, NICHT Collaborator (dieselbe Grenze wie
 * canEditTeamRoster) -- hasPermission(role, 'restructure').
 */
export const canEditTeamMetadata = (role: TournamentRole): boolean => {
  return hasPermission(role, 'restructure');
};

// ============================================
// MEMBER MANAGEMENT
// ============================================

/**
 * Kann Mitglieder-Rollen ändern
 *
 * Erlaubt: NUR owner (hasPermission(myRole, 'manageMembers')), und auch der nicht für sich
 * selbst (kein Downgrade/Upgrade der eigenen Owner-Rolle über diesen Pfad -- dafür gibt es
 * canTransferOwnership).
 *
 * @param myRole - Eigene Turnier-Rolle
 * @param targetRole - Aktuelle Rolle des Ziel-Users
 */
export const canChangeRole = (
  myRole: TournamentRole,
  targetRole: TournamentRole
): boolean => {
  if (!hasPermission(myRole, 'manageMembers')) {
    return false;
  }

  // Owner kann alle ändern außer sich selbst (owner)
  return targetRole !== 'owner';
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
  // Erst prüfen ob überhaupt Änderung erlaubt (canChangeRole ist owner-only via hasPermission --
  // "newRole === 'co-admin' && myRole !== 'owner'" unten ist seitdem unerreichbar, bleibt aber
  // als explizite Dokumentation der Regel stehen statt sie stillschweigend nur über
  // canChangeRole mitzuvererben).
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
 * Erlaubt: NUR owner (dieselbe Grenze wie canChangeRole -- siehe dort).
 */
export const canRemoveMember = (
  myRole: TournamentRole,
  targetRole: TournamentRole
): boolean => {
  return canChangeRole(myRole, targetRole);
};

/**
 * Kann Ownership übertragen
 * Nur owner kann Ownership an einen Co-Admin übertragen. Kein Eintrag in rolePermissions.json
 * (Ownership-Übertragung ist kein "Recht" der Tabelle, sondern untrennbar an die Rolle 'owner'
 * selbst gebunden -- bleibt deshalb ein literaler Rollen-Vergleich, nicht hasPermission()).
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
 * Erlaubt: owner, co-admin. Kein Eintrag in rolePermissions.json -- Lese-Rechte sind nicht Teil
 * der Rechteliste aus dem Brief (die regelt nur Schreibzugriffe), bleibt deshalb ein literaler
 * Rollen-Vergleich.
 */
export const canViewMembers = (role: TournamentRole): boolean => {
  return role === 'owner' || role === 'co-admin';
};

/**
 * Kann Einladungs-Links sehen
 * Erlaubt: owner, co-admin (siehe canViewMembers -- dieselbe Begründung).
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
 * NUR owner darf überhaupt Rollen vergeben (hasPermission(myRole, 'manageMembers')) -- ein
 * co-admin gehört seit R5/M6 NICHT mehr dazu, sonst würde diese Funktion Rollen als "vergebbar"
 * ausweisen, die canChangeRole/canSetRoleTo für denselben Aufrufer bereits verweigern.
 *
 * @param myRole - Eigene Turnier-Rolle
 * @returns Array von vergabbaren Rollen
 */
export const getAssignableRoles = (myRole: TournamentRole): TournamentRole[] => {
  if (hasPermission(myRole, 'manageMembers')) {
    return ['co-admin', 'trainer', 'collaborator', 'viewer'];
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
