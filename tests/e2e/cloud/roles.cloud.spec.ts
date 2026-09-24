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
 * erwartete Assertion automatisch mit.
 *
 * Fixrunde 1 (I5, Ruling T): Eine reine UI-Assertion allein hat KEIN unabhängiges Orakel --
 * sowohl der Test als auch die App lesen `rolePermissions.json` zur Laufzeit vom selben Ort
 * (`npm run dev`, kein Build-Schritt dazwischen), eine gültige Rechte-Änderung verschiebt beide
 * gemeinsam, der Test bliebe grün (geprüft, siehe Report). Jede der drei Rechte-Prüfungen
 * (Löschen, Einladen, Cockpit) ruft deshalb ZUSÄTZLICH die Server-RPC
 * `has_tournament_permission(tournament_id, permission)` MIT DEM ECHTEN JWT der jeweiligen Rolle
 * auf (aus dem von `cloud-setup` gespeicherten storageState gelesen, kein erneuter Login nötig)
 * und vergleicht sie mit der JSON-Erwartung. Die RPC liest `public.role_permissions`, eine
 * TABELLE aus einer Migration -- NICHT die Live-JSON-Datei. Eine Änderung nur an der JSON (ohne
 * neue Migration) bringt damit JSON-Erwartung und Server-Antwort auseinander: genau die Drift,
 * die der `$comment` von `rolePermissions.json` verbietet. Belegt per Mutationsprobe (Report).
 * `has_tournament_permission` ist für `authenticated` UND `anon` per GRANT EXECUTE aufrufbar
 * (`20260924_002_central_role_permissions.sql:318`) -- der im Brief vorgesehene Rückfall auf
 * einen echten RLS-Schreibversuch war deshalb nicht nötig.
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
import { getLocalServiceRoleClient } from './helpers';
import { E2E_LIVE_CUP_ID, E2E_LIVE_CUP_TITLE, E2E_STRANGER_CUP_ID, E2E_STRANGER_CUP_TITLE } from './testData';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Playwright/Node lädt `.json` hier nicht per statischem Default-Import (Import-Attribut
// "type: json" nötig, uneinheitlich zwischen Node-Versionen) -- `readFileSync` + `JSON.parse`
// ist der portable Weg, den auch andere Node-Skripte dieses Repos nutzen. Dieselbe Datei wie
// `src/features/auth/utils/permissions.ts` -- EINE Quelle, kein zweiter Wert gepflegt.
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
// ZWEITES ORAKEL: Server-RPC mit dem echten JWT der Rolle (I5/Ruling T)
// =============================================================================

const AUTH_DIR = path.join(__dirname, '..', '..', '..', 'playwright', '.auth');

/**
 * Liest den bereits von `cloud-setup` (`auth.setup.ts`) gespeicherten Supabase-Access-Token aus
 * `playwright/.auth/<rolle>.json` -- derselbe storageState, den `asRole()` für den Browser-
 * Context nutzt. Kein zweiter Login: der Token ist bereits da und (`jwt_expiry=3600`,
 * `supabase/config.toml`) für die Dauer eines Testlaufs gültig.
 */
function getStoredAccessToken(role: LoggedInRole): string {
  const raw = JSON.parse(readFileSync(path.join(AUTH_DIR, `${role}.json`), 'utf8')) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  const item = raw.origins?.[0]?.localStorage?.find((entry) => entry.name === 'sb-127-auth-token');
  if (!item) {
    throw new Error(
      `getStoredAccessToken: kein "sb-127-auth-token" in playwright/.auth/${role}.json gefunden -- lief cloud-setup?`
    );
  }
  const session = JSON.parse(item.value) as { access_token?: unknown };
  if (typeof session.access_token !== 'string') {
    throw new Error(`getStoredAccessToken: access_token für Rolle "${role}" fehlt oder ist kein String.`);
  }
  return session.access_token;
}

/**
 * Ruft `has_tournament_permission(tournament_id, permission)` MIT dem JWT der Rolle auf (nicht
 * Service-Role -- die RPC soll exakt das sehen, was auch die App-Session dieser Rolle sieht).
 * `apikey` ist trotzdem der ANON-Key (PostgREST verlangt ihn für jede Anfrage, unabhängig vom
 * `Authorization`-Bearer-Token, das die eigentliche Rolle bestimmt).
 */
async function serverHasTournamentPermission(
  role: LoggedInRole,
  tournamentId: string,
  permission: string
): Promise<boolean> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const accessToken = getStoredAccessToken(role);
  const res = await fetch(`${url}/rest/v1/rpc/has_tournament_permission`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_tournament_id: tournamentId, p_permission: permission }),
  });
  if (!res.ok) {
    throw new Error(`has_tournament_permission(${role}, ${permission}) fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as boolean;
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
      // NUR die eigene Zeile (user_id = auth.uid()) -- für owner (sieht ALLE Zeilen) adressiert
      // M5 das über den "(Du)"-Marker (MemberList.tsx#isMe) gezielt die eigene Zeile, statt
      // `.first()` auf die DOM-Reihenfolge zu verlassen.
      const memberList = page.locator('[data-testid="member-list"]');
      await expect(memberList).toBeVisible({ timeout: 15000 });
      const myRow = memberList.locator('[data-testid^="member-row-"]', { hasText: '(Du)' });
      await expect(myRow).toBeVisible({ timeout: 15000 });
      const myBadge = myRow.locator('[data-testid="role-badge"]');
      await expect(myBadge).toHaveAttribute('data-role', role);
    });

    test(`Löschen-Bereich (danger-zone-delete): ${canDelete ? 'sichtbar' : 'nicht sichtbar'} (deleteTournament=${canDelete})`, async ({ asRole }) => {
      const serverCanDelete = await serverHasTournamentPermission(userKey, E2E_LIVE_CUP_ID, 'deleteTournament');
      expect(serverCanDelete).toBe(canDelete); // Zweites Orakel (I5): Server-RPC vs. JSON-Erwartung.

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
      const serverCanInvite = await serverHasTournamentPermission(userKey, E2E_LIVE_CUP_ID, 'manageMembers');
      expect(serverCanInvite).toBe(canInvite); // Zweites Orakel (I5).

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
      const serverCanWrite = await serverHasTournamentPermission(userKey, E2E_LIVE_CUP_ID, 'writeMatchData');
      expect(serverCanWrite).toBe(canWrite); // Zweites Orakel (I5).

      const page = await asRole(userKey);
      // TAB_PATHS (tournamentTabUtils.ts) bildet den "management"-Tab auf das URL-Segment "live" ab.
      await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await page.waitForLoadState('networkidle');

      const readOnlyBanner = page.locator('[data-testid="cockpit-readonly-banner"]');
      const statusBadge = page.locator('[data-testid="match-status-badge"]');
      await expect(statusBadge).toBeVisible({ timeout: 15000 }); // Cockpit lädt in jedem Fall (laufendes Spiel im Seed)

      // M4: Verdrahtung bis zum tatsächlichen Bedienelement, nicht nur bis zum Banner --
      // goal-button-home trägt das echte disabled-Attribut (TeamBlock/index.tsx).
      const goalButton = page.locator('[data-testid="goal-button-home"]');
      if (canWrite) {
        await expect(readOnlyBanner).toHaveCount(0);
        await expect(page.locator('[data-testid="match-pause-button"], [data-testid="match-start-button"]')).toBeVisible();
        await expect(goalButton).toBeEnabled();
      } else {
        await expect(readOnlyBanner).toBeVisible({ timeout: 15000 });
        await expect(goalButton).toBeDisabled();
      }
    });
  });
}

// =============================================================================
// WIDERRUFEN / FREMDE (Brief: "revoked und stranger sehen den Live-Cup nicht")
// =============================================================================

test.describe('Widerruf / Fremde', () => {
  test('revoked sieht den Live-Cup nicht (Dashboard, Direktlink)', async ({ asRole }) => {
    const page = await asRole('revoked');

    // I7: positiver Anker ZUERST -- beweist, dass die Seite fertig geladen UND der Nutzer
    // angemeldet ist, bevor die Abwesenheit des Live-Cup geprüft wird. Ohne das wäre der Test
    // auch grün, wenn die Seite noch lädt, einen Fehler zeigt oder der Nutzer (C1!) gar nicht
    // angemeldet ist -- C1 hat belegt, dass Letzteres real vorkommt.
    await page.goto('/#/');
    await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`[data-testid="tournament-card-${E2E_LIVE_CUP_ID}"]`)).toHaveCount(0);

    // Direktlink: revoked ist zwar (widerrufenes) Mitglied, RLS lässt ihn trotzdem nicht rein --
    // "Turnier nicht gefunden" ist derselbe positive Anker wie in public-view.cloud.spec.ts.
    await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(E2E_LIVE_CUP_TITLE, { exact: true })).toHaveCount(0);
  });

  test('stranger sieht den Live-Cup nicht (Dashboard, Direktlink)', async ({ asRole }) => {
    const page = await asRole('stranger');

    // I7: positiver Anker -- stranger ist Eigentümer des Fremd-Cup, DESSEN Karte muss sichtbar
    // sein, bevor die Abwesenheit des Live-Cup etwas beweist (sonst wäre "lädt noch"/"nicht
    // angemeldet" ebenfalls unauffällig grün, siehe C1).
    await page.goto('/#/');
    await expect(page.locator(`[data-testid="tournament-card-${E2E_STRANGER_CUP_ID}"]`)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(E2E_STRANGER_CUP_TITLE, { exact: true })).toBeVisible();
    await expect(page.locator(`[data-testid="tournament-card-${E2E_LIVE_CUP_ID}"]`)).toHaveCount(0);

    await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(E2E_LIVE_CUP_TITLE, { exact: true })).toHaveCount(0);
  });
});
