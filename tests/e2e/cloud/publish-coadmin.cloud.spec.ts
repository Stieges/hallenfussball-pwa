/**
 * tests/e2e/cloud/publish-coadmin.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 6.
 *
 * ABWEICHUNG vom Brief-Wortlaut (bewusst, siehe Report "Bedenken"): Der Brief verlangt "coadmin
 * veröffentlicht den Entwurf-Cup (bzw. zieht den Public-Cup zurück)". `testData.ts`/
 * `scripts/e2e-seed.ts` (Task T2) geben coadmin aber NUR eine Mitgliedschaft im Live-Cup --
 * weder Entwurf-Cup noch Public-Cup haben einen Co-Admin-Eintrag (beide gehören ausschließlich
 * `owner`). coadmin kann strukturell nicht auf ein Turnier zugreifen, in dem er kein Mitglied
 * ist (RLS). Dieser Spec prüft deshalb denselben Mechanismus (die Veröffentlichen-/
 * Sichtbarkeits-RPC `make_tournament_public`/`make_tournament_private` verlangt den Eigentümer,
 * bekannter Befund N1) am Live-Cup, dem einzigen Turnier, in dem coadmin tatsächlich Mitglied
 * ist -- `rolePermissions.json` gibt co-admin das Recht `tournamentSettings` (zu dem laut
 * `permissions.ts#canManageTournament` die Sichtbarkeit gehört), die RPC prüft aber hart
 * `auth.uid() = owner_id`, unabhängig von `role_permissions`.
 */

import { execSync } from 'node:child_process';
import { test, expect } from './fixtures';
import { E2E_LIVE_CUP_ID } from './testData';

interface LocalServiceRole {
  url: string;
  serviceRoleKey: string;
}

function getLocalServiceRole(): LocalServiceRole {
  const raw = execSync('supabase status -o json', { encoding: 'utf8' });
  const status = JSON.parse(raw) as Record<string, unknown>;
  const url = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (typeof url !== 'string' || typeof serviceRoleKey !== 'string') {
    throw new Error('`supabase status -o json` liefert kein API_URL/SERVICE_ROLE_KEY -- läuft der lokale Stack?');
  }
  return { url, serviceRoleKey };
}

/** Liest `is_public` des Live-Cup direkt aus der DB (Service-Role, umgeht RLS/App-Cache). */
async function getLiveCupIsPublic(): Promise<boolean> {
  const { url, serviceRoleKey } = getLocalServiceRole();
  const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${E2E_LIVE_CUP_ID}&select=is_public`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!res.ok) {
    throw new Error(`tournaments-Abfrage fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ is_public: boolean }>;
  if (rows.length === 0) {
    throw new Error(`Live-Cup (${E2E_LIVE_CUP_ID}) nicht gefunden.`);
  }
  return rows[0].is_public;
}

test('coadmin macht den Live-Cup öffentlich -- Änderung erreicht die DB nicht (N1, belegt)', async ({ asRole }) => {
  // Bekannter Befund N1 (Brief): die Veröffentlichen-RPC verlangt heute den Eigentümer, der
  // Co-Admin nutzt einen Offline-Fallback (src/core/repositories/OfflineRepository.ts:691-730,
  // `makeTournamentPublic()`). Gewolltes Verhalten (co-admin hat `tournamentSettings`, siehe
  // Kopfkommentar): die Änderung landet in der DB. Heute nicht der Fall -- als `test.fail()`
  // markiert.
  test.fail();

  expect(await getLiveCupIsPublic()).toBe(false); // Live-Cup ist laut Seed privat.

  const page = await asRole('coadmin');
  await page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/admin/visibility`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('🔒 Privat', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByText('🔗 Mit Link teilbar', { exact: true }).click();

  // Der DB-Zustand (Service-Role, RLS-unabhängig) ist der einzig verlässliche Beweis -- die
  // Oberfläche kann durch den Offline-Fallback fälschlich Erfolg anzeigen (lokaler Zustand),
  // ohne dass sich an der Cloud etwas geändert hat.
  await expect.poll(() => getLiveCupIsPublic(), { timeout: 5000 }).toBe(true);
});
