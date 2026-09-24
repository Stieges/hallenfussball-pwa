/**
 * tests/e2e/cloud/roles.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 2.
 *
 * **Generiert aus `rolePermissions.json`** (Brief-Vorgabe: "nicht handgeschrieben"): die
 * erwartete Sichtbarkeit von `danger-zone-delete`/`invite-create-button`/
 * `cockpit-readonly-banner` wird für jede Rolle aus der EINEN Rechte-Quelle
 * (`src/features/auth/permissions/rolePermissions.json`, dieselbe Datei, die
 * `src/features/auth/utils/permissions.ts#hasPermission()` zur Laufzeit auswertet) berechnet,
 * nicht als literale Erwartung pro Rolle hingeschrieben. Ändert sich die JSON, ändert sich die
 * erwartete Assertion automatisch mit -- die Mutationsprobe (siehe Report) beweist das, indem sie
 * genau DIESEN Mechanismus rot werden lässt.
 *
 * Live-Cup-Mitarbeiter-Tabelle (`testData.ts#E2E_LIVE_CUP_COLLABORATORS`, Task T2): owner,
 * coadmin (co-admin), helper (collaborator), trainer, viewer -- alle "accepted". `revoked` ist
 * ebenfalls Mitglied, aber mit `declined_at` gesetzt (widerrufen) und wird hier separat geprüft.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures';
import type { LoggedInRole } from './fixtures';
import { E2E_LIVE_CUP_ID, E2E_LIVE_CUP_TITLE } from './testData';

// Playwright/Node lädt `.json` hier nicht per statischem Default-Import (Import-Attribut
// "type: json" nötig, uneinheitlich zwischen Node-Versionen) -- `readFileSync` + `JSON.parse`
// ist der portable Weg, den auch andere Node-Skripte dieses Repos nutzen. Dieselbe Datei wie
// `src/features/auth/utils/permissions.ts` -- EINE Quelle, kein zweiter Wert gepflegt.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROLE_PERMISSIONS_PATH = path.join(
  __dirname, '..', '..', '..', 'src', 'features', 'auth', 'permissions', 'rolePermissions.json'
);
const rolePermissionsJson = JSON.parse(readFileSync(ROLE_PERMISSIONS_PATH, 'utf8')) as {
  roles: Record<string, string[]>;
};

// =============================================================================
// AUS DER JSON ABGELEITET (kein Hardcoding der Rollen-Erwartungen)
// =============================================================================

/** Rollen-Schlüssel wie in `rolePermissions.json#roles` (deckungsgleich mit permissions.ts). */
type JsonRole = 'co-admin' | 'collaborator' | 'trainer' | 'viewer';
type RoleUnderTest = JsonRole | 'owner';

/** Verbindet jede zu prüfende Rolle mit dem passenden Testnutzer aus `testData.ts#E2E_USERS`. */
const ROLE_TO_USER_KEY: Record<RoleUnderTest, LoggedInRole> = {
  owner: 'owner',
  'co-admin': 'coadmin',
  collaborator: 'helper',
  trainer: 'trainer',
  viewer: 'viewer',
};

const ALL_ROLES: RoleUnderTest[] = ['owner', 'co-admin', 'collaborator', 'trainer', 'viewer'];

/**
 * Spiegelt `hasPermission()` aus `src/features/auth/utils/permissions.ts` für Testzwecke:
 * owner hat immer alle Rechte (dort fest verankert, nicht in der JSON), jede andere Rolle nur
 * die in `rolePermissionsJson.roles[role]` gelisteten.
 */
function hasPermission(role: RoleUnderTest, permission: string): boolean {
  if (role === 'owner') {
    return true;
  }
  return rolePermissionsJson.roles[role]?.includes(permission) ?? false;
}

// =============================================================================
// JE ROLLE: role-badge, Löschen-Bereich, Einladen, Cockpit
// =============================================================================

for (const role of ALL_ROLES) {
  const userKey = ROLE_TO_USER_KEY[role];
  const canDelete = hasPermission(role, 'deleteTournament');
  const canInvite = hasPermission(role, 'manageMembers');
  const canWrite = hasPermission(role, 'writeMatchData');

  test.describe(`Rolle ${role}`, () => {
    test(`role-badge zeigt "${role}"`, async ({ asRole }) => {
      const page = await asRole(userKey);
      await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/admin/team-helpers`);
      await page.waitForLoadState('networkidle');

      // R7/RLS (collaborators_select_v3): jede Nicht-Owner-Rolle sieht in `tournament_collaborators`
      // NUR die eigene Zeile (user_id = auth.uid()) -- die eigene role-badge ist also immer die
      // EINZIGE in member-list, unabhängig davon, ob die Rolle die Mitglieder-Verwaltung sehen darf.
      const memberList = page.locator('[data-testid="member-list"]');
      await expect(memberList).toBeVisible({ timeout: 15000 });
      const myBadge = memberList.locator('[data-testid="role-badge"]').first();
      await expect(myBadge).toBeVisible({ timeout: 15000 });
      await expect(myBadge).toHaveAttribute('data-role', role);
    });

    test(`Löschen-Bereich (danger-zone-delete): ${canDelete ? 'sichtbar' : 'nicht sichtbar'} (deleteTournament=${canDelete})`, async ({ asRole }) => {
      const page = await asRole(userKey);
      await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/admin/danger-zone`);
      await page.waitForLoadState('networkidle');

      const deleteButton = page.locator('[data-testid="danger-zone-delete"]');
      if (canDelete) {
        await expect(deleteButton).toBeVisible({ timeout: 15000 });
      } else {
        // Andere Danger-Zone-Aktionen (z.B. Spielplan neu generieren) bleiben sichtbar --
        // NUR der Löschen-Button ist owner-only (siehe DangerZone/index.tsx `canDelete`-Gate).
        await expect(page.getByText('Kritische Aktionen', { exact: false }).first()).toBeVisible({ timeout: 15000 });
        await expect(deleteButton).toHaveCount(0);
      }
    });

    test(`Einladen (invite-create-button): ${canInvite ? 'sichtbar' : 'nicht sichtbar'} (manageMembers=${canInvite})`, async ({ asRole }) => {
      const page = await asRole(userKey);
      await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/admin/team-helpers`);
      await page.waitForLoadState('networkidle');

      const inviteButton = page.locator('[data-testid="invite-create-button"]');
      if (canInvite) {
        await expect(inviteButton).toBeVisible({ timeout: 15000 });
      } else {
        await expect(page.locator('[data-testid="member-list"]')).toBeVisible({ timeout: 15000 });
        await expect(inviteButton).toHaveCount(0);
      }
    });

    test(`Cockpit: ${canWrite ? 'bedienbar' : 'gesperrt (cockpit-readonly-banner)'} (writeMatchData=${canWrite})`, async ({ asRole }) => {
      const page = await asRole(userKey);
      // TAB_PATHS (tournamentTabUtils.ts) bildet den "management"-Tab auf das URL-Segment "live" ab.
      await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await page.waitForLoadState('networkidle');

      const readOnlyBanner = page.locator('[data-testid="cockpit-readonly-banner"]');
      const statusBadge = page.locator('[data-testid="match-status-badge"]');
      await expect(statusBadge).toBeVisible({ timeout: 15000 }); // Cockpit lädt in jedem Fall (laufendes Spiel im Seed)

      if (canWrite) {
        await expect(readOnlyBanner).toHaveCount(0);
        await expect(page.locator('[data-testid="match-pause-button"], [data-testid="match-start-button"]')).toBeVisible();
      } else {
        await expect(readOnlyBanner).toBeVisible({ timeout: 15000 });
      }
    });
  });
}

// =============================================================================
// WIDERRUFEN / FREMDE (Brief: "revoked und stranger sehen den Live-Cup nicht")
// =============================================================================

test.describe('Widerruf / Fremde', () => {
  for (const userKey of ['revoked', 'stranger'] as const) {
    test(`${userKey} sieht den Live-Cup nicht (Dashboard, Direktlink)`, async ({ asRole }) => {
      const page = await asRole(userKey);

      await page.goto('/#/');
      await page.waitForLoadState('networkidle');
      await expect(page.locator(`[data-testid="tournament-card-${E2E_LIVE_CUP_ID}"]`)).toHaveCount(0);

      await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(E2E_LIVE_CUP_TITLE, { exact: true })).toHaveCount(0);
    });
  }
});
