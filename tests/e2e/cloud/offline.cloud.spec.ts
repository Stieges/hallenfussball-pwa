/**
 * tests/e2e/cloud/offline.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 4.
 *
 * Brief: helper geht offline und trägt zwei Tore ein; Sync-Status zeigt ausstehende Einträge;
 * helper geht online, `waitForSync`, owner sieht beide. **Voraussichtlich `test.fail()`, wegen
 * Direktschreibung. Belegen.**
 *
 * Belegt (siehe Report für die vollständigen Konsolen-/Postgres-Fehlermeldungen):
 *   1. `src/core/contexts/RepositoryContext.tsx:85` -- `liveMatchRepository` ist bei einer echten
 *      Cloud-Session immer `SupabaseLiveMatchRepository` direkt (NICHT durch `OfflineRepository`/
 *      die MutationQueue gewrappt, anders als `tournamentRepository` zwei Zeilen darüber). Ein
 *      Tor scheitert offline deshalb sofort am Netzwerkfehler, landet NIE in einer Warteschlange.
 *   2. `sync-status` (`SyncStatusBar`, Task T3) wird nirgends erreichbar gerendert: `AdminHeader`
 *      bekommt `showSyncStatus`/`tournamentId` an KEINER der beiden Aufrufstellen in
 *      `TournamentAdminCenter.tsx` übergeben (`showSyncStatus` defaultet auf `false`,
 *      `src/features/tournament-admin/components/AdminHeader.tsx:126`) -- der Schritt "Sync-Status
 *      zeigt ausstehende Einträge" ist damit strukturell nicht nachweisbar, unabhängig von 1.
 *   3. Zusätzlich (siehe `two-devices.cloud.spec.ts`-Kopfkommentar, Fehler A): selbst ein ONLINE
 *      eingetragenes Tor erreicht `match_events` nicht (ungültige UUID). Betrifft diesen Test
 *      indirekt -- sobald helper wieder online ist, würde der Sync (gäbe es ihn) am selben Fehler
 *      scheitern.
 */

import { test, expect } from './fixtures';
import { ensureMatchRunning, enterGoal, waitForSync } from './helpers';
import { E2E_LIVE_CUP_ID } from './testData';

test('helper geht offline, trägt zwei Tore ein, geht online -- owner sieht beide', async ({ asRole, browser }) => {
  // Siehe Kopfkommentar: drei unabhängig belegte Gründe, warum das heute nicht funktioniert.
  test.fail();

  const ownerPage = await asRole('owner');
  await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
  await ownerPage.waitForLoadState('networkidle');
  await ensureMatchRunning(ownerPage);
  const ownerHomeScore = ownerPage.locator('[data-testid="score-home"]');
  const before = Number(await ownerHomeScore.textContent());

  // Eigener Context für helper (statt asRole()): braucht direkten Zugriff auf `context()`, um
  // `setOffline(true)` aufzurufen -- asRole() gibt nur die Page zurück.
  const helperContext = await browser.newContext({
    storageState: 'playwright/.auth/helper.json',
  });
  const helperPage = await helperContext.newPage();
  await helperPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
  await helperPage.waitForLoadState('networkidle');
  await expect(helperPage.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });
  const helperHomeScore = helperPage.locator('[data-testid="score-home"]');

  await helperContext.setOffline(true);

  await enterGoal(helperPage, 'home');
  await enterGoal(helperPage, 'home');

  // Gewolltes Verhalten: beide Tore stehen lokal als "ausstehend" -- sync-status zeigt 2
  // ausstehende Einträge (Brief). Strukturell nicht nachweisbar (Grund 2 oben), aber die
  // Erwartung bleibt formuliert.
  await expect(helperPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '2', {
    timeout: 5000,
  });
  await expect(helperHomeScore).toHaveText(String(before + 2));

  await helperContext.setOffline(false);
  await waitForSync(helperPage);

  await expect(ownerHomeScore).toHaveText(String(before + 2), { timeout: 5000 });

  await helperContext.close();
});
