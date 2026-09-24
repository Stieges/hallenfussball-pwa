/**
 * permissions.ts gegen die EINE Rollentabelle (src/features/auth/__tests__/roleMatrix.json).
 *
 * Task R2 (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R2-brief.md): die UI muss
 * derselben Tabelle folgen wie die RLS-Policies aus R1 (scripts/rls-role-matrix.sh, gegen
 * echtes Postgres bewiesen). Dieser Test prüft JEDE Zeile der JSON gegen die entsprechenden
 * Funktionen in ../permissions.ts — nicht gegen eine zweite, separat gepflegte Tabelle.
 *
 * Warum `writeMatchData` UND `correctEvents` beide gegen `canEditResults` geprüft werden:
 * In roleMatrix.json sind die beiden Spalten für JEDE Zeile identisch (owner/co-admin/
 * collaborator: beide true; trainer/viewer/non-member: beide false). Die UI kennt (noch)
 * keine gesonderte "Ereignisse korrigieren/löschen"-Funktion getrennt von "Ergebnis eingeben"
 * — beides läuft über denselben Schreibpfad (matches UPDATE / match_events INSERT+UPDATE+DELETE,
 * siehe scripts/rls-role-matrix.sh). Der Test hält deshalb `canEditResults` explizit gegen
 * BEIDE Spalten und prüft zusätzlich die Invariante, dass sie pro Zeile übereinstimmen — bricht
 * das jemals auseinander (roleMatrix.json bekäme unterschiedliche Werte für eine Rolle), macht
 * DIESER Test sichtbar, dass permissions.ts dann eine zweite Funktion braucht.
 */
import { describe, it, expect } from 'vitest';
import {
  canEditResults,
  canManageTournament,
  canCreateInvitations,
  canEditAllTeams,
  canDeleteTournament,
  canChangeRole,
  canRemoveMember,
} from '../permissions';
import type { TournamentRole } from '../../types/auth.types';
import roleMatrixJson from '../../__tests__/roleMatrix.json';

interface RoleMatrixRow {
  id: string;
  label: string;
  role: TournamentRole | null;
  membership: string;
  authMode: string;
  note?: string;
  writeMatchData: boolean;
  correctEvents: boolean;
  tournamentSettings: boolean;
  teams: boolean;
  deleteTournament: boolean;
  manageMembers: boolean;
}

// Fixture für canChangeRole/canRemoveMember (manageMembers-Spalte): beide nehmen eine
// Ziel-Rolle als zweiten Parameter. 'viewer' ist ein Ziel, das JEDE myRole grundsätzlich
// ändern/entfernen dürfte, wenn sie überhaupt Mitglieder verwalten darf (canChangeRole lehnt
// nur beim Ziel 'owner' zusätzlich ab, unabhängig von myRole) — die Spalte misst also wirklich
// "darf diese Rolle überhaupt Mitglieder verwalten", nicht eine Sonderregel für ein bestimmtes
// Ziel.
const MANAGE_MEMBERS_TARGET_ROLE: TournamentRole = 'viewer';

interface RoleMatrixFile {
  rows: RoleMatrixRow[];
}

const roleMatrix = roleMatrixJson as unknown as RoleMatrixFile;

// Fixtures für canEditResults: Der Trainer-Fixture überlappt BEWUSST mit dem eigenen Team
// (userTeamIds enthält genau die Team-ID aus matchTeamIds). Die alte, jetzt entfernte Logik
// (`matchTeamIds.some((teamId) => userTeamIds.includes(teamId))`) hätte das als "eigenes Team"
// erkannt und true zurückgegeben — mit dieser Überlappung fängt die Mutationsprobe unten
// (siehe eigener Testfall) eine Rückkehr zu dieser Logik zuverlässig ab, egal ob jemand die
// Bedingung wieder einbaut.
const TRAINER_TEAM_ID = 'team-trainer-own';
const trainerUserTeamIds = [TRAINER_TEAM_ID];
const matchTeamIdsIncludingTrainerTeam = [TRAINER_TEAM_ID, 'team-other'];
const genericMatchTeamIds = ['team-x', 'team-y'];

describe('permissions.ts — Rollentabelle (roleMatrix.json)', () => {
  it('roleMatrix.json ist intern konsistent: writeMatchData === correctEvents pro Zeile', () => {
    // Dokumentiert die Voraussetzung dafür, dass canEditResults für beide Spalten stehen darf.
    for (const row of roleMatrix.rows) {
      expect(row.correctEvents, `Zeile "${row.id}"`).toBe(row.writeMatchData);
    }
  });

  it.each(roleMatrix.rows)(
    'canEditResults($#) folgt writeMatchData/correctEvents für Zeile "$id"',
    (row) => {
      if (row.role === null) {
        // "Nicht-Mitglied" hat keine TournamentRole — TypeScript verbietet, canEditResults
        // dafür überhaupt aufzurufen (die Funktion erwartet role: TournamentRole, keine
        // "kein Mitglied"-Variante). Das ist keine Lücke: ManagementTab.checkCanEditMatch
        // ruft canEditResults nur auf, wenn eine Mitgliedschaft (myMembership) existiert —
        // ein Nicht-Mitglied kommt real also nie hier an. Die erwarteten Werte (false) sind
        // trotzdem Teil der Tabelle und werden hier dokumentarisch bestätigt.
        expect(row.writeMatchData).toBe(false);
        expect(row.correctEvents).toBe(false);
        return;
      }

      const matchTeamIds = row.role === 'trainer' ? matchTeamIdsIncludingTrainerTeam : genericMatchTeamIds;
      const userTeamIds = row.role === 'trainer' ? trainerUserTeamIds : [];

      const got = canEditResults(row.role, userTeamIds, matchTeamIds);

      expect(got, `Zeile "${row.id}" (writeMatchData)`).toBe(row.writeMatchData);
      expect(got, `Zeile "${row.id}" (correctEvents)`).toBe(row.correctEvents);
    }
  );

  it.each(roleMatrix.rows)(
    'canManageTournament($#) folgt tournamentSettings für Zeile "$id"',
    (row) => {
      if (row.role === null) {
        expect(row.tournamentSettings).toBe(false);
        return;
      }
      expect(canManageTournament(row.role), `Zeile "${row.id}"`).toBe(row.tournamentSettings);
    }
  );

  it.each(roleMatrix.rows)(
    'canEditAllTeams($#) folgt teams für Zeile "$id"',
    (row) => {
      if (row.role === null) {
        expect(row.teams).toBe(false);
        return;
      }
      expect(canEditAllTeams(row.role), `Zeile "${row.id}"`).toBe(row.teams);
    }
  );

  it.each(roleMatrix.rows)(
    'canDeleteTournament($#) folgt deleteTournament für Zeile "$id"',
    (row) => {
      if (row.role === null) {
        expect(row.deleteTournament).toBe(false);
        return;
      }
      expect(canDeleteTournament(row.role), `Zeile "${row.id}"`).toBe(row.deleteTournament);
    }
  );

  // R5/M6: canCreateInvitations war vorher fälschlich an tournamentSettings gebunden (dieselbe
  // owner/co-admin-Grenze wie canManageTournament) — das behauptete eine UI↔DB-Übereinstimmung,
  // die der Harness nie geprüft hat (final-review.md, Abschnitt M6: collaborators_insert_v3
  // verlangt user_owns_tournament(), ein Co-Admin trifft dort 0 Zeilen). Jetzt gegen die neue,
  // eigene Spalte manageMembers geprüft — zusammen mit canChangeRole/canRemoveMember, die
  // dieselbe owner-only-Grenze durchsetzen.
  it.each(roleMatrix.rows)(
    'canCreateInvitations($#) folgt manageMembers für Zeile "$id"',
    (row) => {
      if (row.role === null) {
        expect(row.manageMembers).toBe(false);
        return;
      }
      expect(canCreateInvitations(row.role), `Zeile "${row.id}"`).toBe(row.manageMembers);
    }
  );

  it.each(roleMatrix.rows)(
    'canChangeRole($#, viewer) folgt manageMembers für Zeile "$id"',
    (row) => {
      if (row.role === null) {
        expect(row.manageMembers).toBe(false);
        return;
      }
      expect(
        canChangeRole(row.role, MANAGE_MEMBERS_TARGET_ROLE),
        `Zeile "${row.id}"`
      ).toBe(row.manageMembers);
    }
  );

  it.each(roleMatrix.rows)(
    'canRemoveMember($#, viewer) folgt manageMembers für Zeile "$id"',
    (row) => {
      if (row.role === null) {
        expect(row.manageMembers).toBe(false);
        return;
      }
      expect(
        canRemoveMember(row.role, MANAGE_MEMBERS_TARGET_ROLE),
        `Zeile "${row.id}"`
      ).toBe(row.manageMembers);
    }
  );

  describe('Mutationsprobe: Trainer-Ausnahme darf nicht zurückkehren', () => {
    it('canEditResults(trainer, ...) ist false, SELBST WENN der Trainer Teamherr des Matches ist', () => {
      // Genau der Fall, den die alte Logik erlaubte (matchTeamIds.some(...)). Dreht man
      // canEditResults für 'trainer' testweise zurück auf
      // `return matchTeamIds.some((teamId) => userTeamIds.includes(teamId));`,
      // muss DIESER Test (und der data-driven Test oben für Zeile "trainer") fehlschlagen,
      // weil die Fixtures hier absichtlich überlappen (siehe Kommentar oben an den Fixtures).
      const result = canEditResults('trainer', trainerUserTeamIds, matchTeamIdsIncludingTrainerTeam);
      expect(result).toBe(false);
    });
  });
});
