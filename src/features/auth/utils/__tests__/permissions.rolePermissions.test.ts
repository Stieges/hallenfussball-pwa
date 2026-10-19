/**
 * permissions.ts gegen die EINE Rechtetabelle (src/features/auth/permissions/rolePermissions.json).
 *
 * R5b (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md): Die Rechte stehen
 * jetzt an einer Stelle -- dieser Test prüft ZELLE FÜR ZELLE, dass hasPermission() und jede
 * can…-Funktion GENAU das liefern, was rolePermissions.json für die jeweilige Rolle/Recht-
 * Kombination sagt. `expectedFor()` unten LIEST die JSON selbst (unabhängig von hasPermission()),
 * damit dieser Test nicht nur beweist "die Funktion ruft sich selbst korrekt auf", sondern eine
 * echte Regression fängt -- sowohl eine falsche JSON-Zeile als auch eine falsche Verdrahtung
 * einer can…-Funktion auf das falsche Recht.
 *
 * Vorgänger dieses Tests (bis R5b): permissions.roleMatrix.test.ts gegen
 * src/features/auth/__tests__/roleMatrix.json (Zeilen mit Booleans je Spalte). Die JSON wurde
 * nach src/features/auth/permissions/rolePermissions.json verschoben und zur Laufzeit-Quelle von
 * permissions.ts gemacht (statt nur eine Test-Fixture zu sein) -- das Format ist jetzt
 * "Rolle -> Array erlaubter Rechte" statt "Zeile -> Boolean je Spalte", siehe Kopfkommentar der
 * JSON.
 */
import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canEditResults,
  canManageTournament,
  canCreateInvitations,
  canEditAllTeams,
  canEditSchedule,
  canEditTeamRoster,
  canEditTeamMetadata,
  canDeleteTournament,
  canChangeRole,
  canRemoveMember,
  getAssignableRoles,
  type Permission,
} from '../permissions';
import type { TournamentRole } from '../../types/auth.types';
import rolePermissionsJson from '../../permissions/rolePermissions.json';

interface RolePermissionsFile {
  roles: Record<string, Permission[]>;
}

const rolePermissions = rolePermissionsJson as unknown as RolePermissionsFile;

const ALL_PERMISSIONS: Permission[] = [
  'writeMatchData',
  'correctEvents',
  'tournamentSettings',
  'teams',
  'restructure',
  'deleteTournament',
  'manageMembers',
  'leadMatches',
  // A-11 (brief-A-11.md R-A11-1): die fuenf MVP-Rechte.
  'manageSchedule',
  'manageLifecycle',
  'manageScreens',
  'manageHelpers',
  'readDisplay',
];

// Rollen aus der JSON (co-admin, collaborator, trainer, viewer) + 'owner', der bewusst NICHT in
// der JSON steht (siehe Kopfkommentar dort: der Eigentümer ist fest in hasPermission() verankert).
const ROLES_IN_TABLE = Object.keys(rolePermissions.roles) as TournamentRole[];
const ALL_ROLES: TournamentRole[] = ['owner', ...ROLES_IN_TABLE];

/**
 * Unabhängige Ground-Truth: liest rolePermissions.json direkt, OHNE hasPermission() zu benutzen.
 * 'owner' ist hart auf true verdrahtet (deckungsgleich mit dem Kommentar in der JSON und in
 * hasPermission() selbst -- eine Änderung an EINER der beiden Stellen, die nicht zur anderen
 * passt, lässt jede Zeile unten fehlschlagen).
 */
function expectedFor(role: TournamentRole, permission: Permission): boolean {
  if (role === 'owner') {
    return true;
  }
  return (rolePermissions.roles[role] ?? []).includes(permission);
}

const cells = ALL_ROLES.flatMap((role) =>
  ALL_PERMISSIONS.map((permission) => ({ role, permission }))
);

describe('hasPermission() — jede Zelle der Rechtetabelle', () => {
  it.each(cells)('hasPermission($role, $permission)', ({ role, permission }) => {
    expect(hasPermission(role, permission)).toBe(expectedFor(role, permission));
  });

  it('eine unbekannte Rolle (kein Mitglied) hat nie ein Recht', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission('not-a-real-role' as TournamentRole, permission)).toBe(false);
    }
  });

  // A-11 (Baustein Regel 3: umgeschrieben, nicht gelöscht). Vorher: "writeMatchData und correctEvents stimmen je
  // Rolle überein". Seit A-11 (C-RECHTE-KORREKTUR, @HE-042 „ein beendetes Spiel korrigieren -> nur Turnierleitung“)
  // hat der Helfer writeMatchData OHNE correctEvents; canEditResults folgt allein writeMatchData (Spielbetrieb über
  // append_match_events). Was bleibt: Korrigieren setzt Eintragen voraus.
  it('C-RECHTE-KORREKTUR: correctEvents setzt writeMatchData voraus, der Helfer hat writeMatchData ohne correctEvents', () => {
    for (const role of ALL_ROLES) {
      if (hasPermission(role, 'correctEvents')) {
        expect(hasPermission(role, 'writeMatchData'), `Rolle "${role}"`).toBe(true);
      }
    }
    expect(hasPermission('collaborator', 'writeMatchData')).toBe(true);
    expect(hasPermission('collaborator', 'correctEvents')).toBe(false);
  });

  // A-11 R-A11-1 (Brief-Tabelle, unabhängig von der JSON): die MVP-Rechte je Rolle.
  it.each([
    ['manageSchedule', true, false],
    ['manageLifecycle', true, false],
    ['manageScreens', true, false],
    ['manageHelpers', true, false],
    ['readDisplay', false, false],
    ['teams', true, false],
    ['correctEvents', true, false],
    ['writeMatchData', true, true],
  ] as const)('@ZP-040 @LZ-022 @ZM-019 @HE-042: %s -- Co-Admin %s, Helfer %s', (permission, coAdmin, helper) => {
    expect(hasPermission('owner', permission)).toBe(true);
    expect(hasPermission('co-admin', permission)).toBe(coAdmin);
    expect(hasPermission('collaborator', permission)).toBe(helper);
    expect(hasPermission('trainer', permission)).toBe(false);
    expect(hasPermission('viewer', permission)).toBe(false);
  });
});

// Fixtures für canEditResults: Der Trainer-Fixture überlappt BEWUSST mit dem eigenen Team
// (userTeamIds enthält genau die Team-ID aus matchTeamIds). Die alte, längst entfernte Logik
// (`matchTeamIds.some((teamId) => userTeamIds.includes(teamId))`) hätte das als "eigenes Team"
// erkannt und true zurückgegeben -- mit dieser Überlappung fängt die Mutationsprobe unten
// (eigener Testfall) eine Rückkehr zu dieser Logik zuverlässig ab.
const TRAINER_TEAM_ID = 'team-trainer-own';
const trainerUserTeamIds = [TRAINER_TEAM_ID];
const matchTeamIdsIncludingTrainerTeam = [TRAINER_TEAM_ID, 'team-other'];
const genericMatchTeamIds = ['team-x', 'team-y'];

describe('can…-Funktionen — jede Zelle gegen die unabhängig gelesene JSON', () => {
  it.each(ALL_ROLES)('canManageTournament(%s) folgt tournamentSettings', (role) => {
    expect(canManageTournament(role)).toBe(expectedFor(role, 'tournamentSettings'));
  });

  it.each(ALL_ROLES)('canDeleteTournament(%s) folgt deleteTournament', (role) => {
    expect(canDeleteTournament(role)).toBe(expectedFor(role, 'deleteTournament'));
  });

  it.each(ALL_ROLES)('canCreateInvitations(%s) folgt manageMembers', (role) => {
    expect(canCreateInvitations(role)).toBe(expectedFor(role, 'manageMembers'));
  });

  it.each(ALL_ROLES)('canEditResults(%s) folgt writeMatchData', (role) => {
    const matchTeamIds = role === 'trainer' ? matchTeamIdsIncludingTrainerTeam : genericMatchTeamIds;
    const userTeamIds = role === 'trainer' ? trainerUserTeamIds : [];
    expect(canEditResults(role, userTeamIds, matchTeamIds)).toBe(expectedFor(role, 'writeMatchData'));
  });

  it.each(ALL_ROLES)('canEditSchedule(%s) folgt restructure', (role) => {
    expect(canEditSchedule(role)).toBe(expectedFor(role, 'restructure'));
  });

  it.each(ALL_ROLES)('canEditAllTeams(%s) folgt teams', (role) => {
    expect(canEditAllTeams(role)).toBe(expectedFor(role, 'teams'));
  });

  it.each(ALL_ROLES)('canEditTeamMetadata(%s) folgt restructure', (role) => {
    expect(canEditTeamMetadata(role)).toBe(expectedFor(role, 'restructure'));
  });

  it.each(ALL_ROLES)('canEditTeamRoster(%s, fremdes Team) folgt restructure', (role) => {
    // "Fremdes Team" hier: userTeamIds ist leer, targetTeamId gehört dem User nicht -- nur
    // owner/co-admin (restructure) dürfen ein Team bearbeiten, das ihnen nicht zugewiesen ist.
    expect(canEditTeamRoster(role, [], 'some-other-team')).toBe(expectedFor(role, 'restructure'));
  });

  it('canEditTeamRoster(trainer, eigenes Team) ist true, unabhängig von restructure', () => {
    expect(canEditTeamRoster('trainer', trainerUserTeamIds, TRAINER_TEAM_ID)).toBe(true);
  });

  it('canEditTeamRoster(trainer, fremdes Team) ist false', () => {
    expect(canEditTeamRoster('trainer', trainerUserTeamIds, 'team-other')).toBe(false);
  });

  it.each(ALL_ROLES)('canChangeRole(%s, viewer) folgt manageMembers', (role) => {
    // 'viewer' als Ziel-Rolle: JEDE myRole dürfte sie grundsätzlich ändern, wenn sie überhaupt
    // Mitglieder verwalten darf (canChangeRole lehnt nur beim Ziel 'owner' zusätzlich ab,
    // unabhängig von myRole) -- die Spalte misst also wirklich "darf diese Rolle überhaupt
    // Mitglieder verwalten", nicht eine Sonderregel für ein bestimmtes Ziel.
    expect(canChangeRole(role, 'viewer')).toBe(expectedFor(role, 'manageMembers'));
  });

  it.each(ALL_ROLES)('canRemoveMember(%s, viewer) folgt manageMembers', (role) => {
    expect(canRemoveMember(role, 'viewer')).toBe(expectedFor(role, 'manageMembers'));
  });

  it.each(ALL_ROLES)('getAssignableRoles(%s) ist genau dann leer, wenn manageMembers fehlt', (role) => {
    const assignable = getAssignableRoles(role);
    if (expectedFor(role, 'manageMembers')) {
      expect(assignable).toEqual(['co-admin', 'trainer', 'collaborator', 'viewer']);
    } else {
      expect(assignable).toEqual([]);
    }
  });
});

describe('Mutationsprobe: Trainer-Ausnahme darf nicht zurückkehren', () => {
  it('canEditResults(trainer, ...) ist false, SELBST WENN der Trainer Teamherr des Matches ist', () => {
    // Genau der Fall, den die alte Logik erlaubte (matchTeamIds.some(...)). Dreht man
    // canEditResults für 'trainer' testweise zurück auf
    // `return matchTeamIds.some((teamId) => userTeamIds.includes(teamId));`,
    // muss DIESER Test (und der data-driven Test oben für 'trainer') fehlschlagen, weil die
    // Fixtures hier absichtlich überlappen (siehe Kommentar oben an den Fixtures).
    const result = canEditResults('trainer', trainerUserTeamIds, matchTeamIdsIncludingTrainerTeam);
    expect(result).toBe(false);
  });
});
